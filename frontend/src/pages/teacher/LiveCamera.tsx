import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, CameraOff, Users, Square, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CourseSelectionModal } from "@/components/modals/CourseSelectionModal";
import { toast } from "sonner";
import { sessionsApi, coursesApi, attendanceApi, handleApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
}

interface Session {
  id: number;
  course_id: number;
  teacher_id: number;
  started_at: string;
  ended_at?: string;
  status: string;
}

interface DetectedStudent {
  id: number;
  name: string;
  timestamp: string;
  status: "detected";
}

export default function LiveCamera() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Ensure video element is ready
  useEffect(() => {
    console.log("Video element mounted:", !!videoRef.current);
  }, []);

  // Load available cameras (without requesting permission)
  useEffect(() => {
    loadCameraDevices();
  }, []);

  const loadCameraDevices = async () => {
    try {
      // Check if we have camera permission by trying to enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      // Filter out devices without proper labels (usually means no permission)
      const accessibleDevices = videoDevices.filter(device => device.label || device.deviceId);

      if (accessibleDevices.length === 0 && videoDevices.length > 0) {
        // We have devices but no labels, try to get permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately

          // Now enumerate again with permission
          const devicesWithPermission = await navigator.mediaDevices.enumerateDevices();
          const videoDevicesWithPermission = devicesWithPermission.filter(device => device.kind === 'videoinput');
          setCameraDevices(videoDevicesWithPermission);

          if (videoDevicesWithPermission.length > 0 && !selectedCameraId) {
            setSelectedCameraId(videoDevicesWithPermission[0].deviceId);
          }
        } catch (permissionErr) {
          console.error("Camera permission denied:", permissionErr);
          setCameraDevices([]);
        }
      } else {
        // We already have accessible devices
        setCameraDevices(accessibleDevices);
        if (accessibleDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(accessibleDevices[0].deviceId);
        }
      }
    } catch (err) {
      console.error("Error loading camera devices:", err);
      setCameraDevices([]);
    }
  };

  const sessionId = searchParams.get("session_id");
  const courseId = searchParams.get("course_id");

  useEffect(() => {
    loadSessionData();
    loadCourses();
  }, [sessionId]);

  // Auto-start session if course_id is provided in URL
  useEffect(() => {
    if (courseId && courses.length > 0 && !currentSession && !startingSession) {
      console.log("Auto-starting session for course:", courseId);
      handleStartNewSession(courseId);
    }
  }, [courseId, courses, currentSession, startingSession]);

  // Debug logging for state changes
  useEffect(() => {
    console.log("State update - isCameraActive:", isCameraActive, "currentSession:", currentSession?.id);
    console.log("Video ref current:", !!videoRef.current);
    if (videoRef.current) {
      console.log("Video srcObject:", !!videoRef.current.srcObject);
      console.log("Video readyState:", videoRef.current.readyState);
      console.log("Video paused:", videoRef.current.paused);
    }
  }, [isCameraActive, currentSession]);

  const loadCourses = async () => {
    try {
      const coursesData = await coursesApi.list();
      setCourses(coursesData);
    } catch (err) {
      console.error("Error loading courses:", err);
    }
  };

  const loadSessionData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (sessionId) {
        // Load existing session data to resume it
        const sessionIdNum = parseInt(sessionId);
        let sessionData = await sessionsApi.get(sessionIdNum);

        // Check if session is submitted (can't reopen submitted sessions)
        if (sessionData.status === "submitted") {
          toast.error("This session has already been submitted");
          navigate(`/teacher/session/${sessionIdNum}/review`);
          return;
        }

        // If session is closed, retake it (clears all attendance and reopens)
        if (sessionData.status === "closed") {
          console.log("Retaking closed session - clearing attendance and reopening");
          await attendanceApi.retake(sessionIdNum);
          // Reload session data after retake
          sessionData = await sessionsApi.get(sessionIdNum);
          toast.success("Session reopened for retake - all attendance cleared");
        }

        console.log("Resuming session:", sessionData);
        setCurrentSession(sessionData);

        // Load course data for the session
        if (sessionData.course_id) {
          const courseData = await coursesApi.get(sessionData.course_id);
          // Find the course in our loaded courses or add it
          setCourses(prevCourses => {
            const existing = prevCourses.find(c => c.id === courseData.id);
            if (!existing) {
              return [...prevCourses, courseData];
            }
            return prevCourses;
          });
        }
      }
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = async (courseId: string) => {
    console.log("Starting session for course:", courseId);
    try {
      setStartingSession(true);
      const courseIdNum = parseInt(courseId);

      // Check if there's already an active session for this course
      // We can't easily check this with the current API, so we'll proceed
      // In a real implementation, you'd want to check for active sessions

      console.log("Calling sessionsApi.start with courseId:", courseIdNum);
      const response = await sessionsApi.start(courseIdNum);
      console.log("Session started successfully:", response);

      toast.success("Session started successfully");
      setCurrentSession(response);
      console.log("Session created with status:", response.status);
      setShowCourseModal(false);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setStartingSession(false);
    }
  };

  const handleEndSession = async () => {
    if (!currentSession) return;

    try {
      await sessionsApi.end(currentSession.id);
      navigate(`/teacher/session/${currentSession.id}/review`);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleToggleCamera = async () => {
    console.log("=== CAMERA TOGGLE CLICKED ===");
    console.log("Camera toggle clicked, currentSession:", currentSession);
    if (!currentSession) {
      console.log("No current session, showing error");
      toast.error("Please start a session first");
      return;
    }

    console.log("Session status:", currentSession.status);

    if (currentSession.status !== "open") {
      console.log("Session not active, returning");
      toast.error("Session is not active");
      return;
    }

    console.log("About to check isCameraActive:", isCameraActive);
    if (!isCameraActive) {
      console.log("Entering camera start block");
      try {
        console.log("Requesting camera access...");
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined
          }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera access granted, stream:", stream);

        if (videoRef.current) {
          console.log("Setting video srcObject");
          console.log("Video element exists:", !!videoRef.current);
          console.log("Stream tracks:", stream.getTracks().length);
          videoRef.current.srcObject = stream;
          console.log("Video srcObject set successfully");

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = async () => {
            console.log("Video metadata loaded, attempting to play");
            console.log("Video dimensions:", videoRef.current!.videoWidth, "x", videoRef.current!.videoHeight);
            try {
              await videoRef.current!.play(); // Explicitly play the video
              console.log("Video started playing successfully");
              console.log("Video readyState:", videoRef.current!.readyState);
              console.log("Video paused:", videoRef.current!.paused);
              streamRef.current = stream;
              setIsCameraActive(true);
            } catch (playError) {
              console.error("Failed to play video:", playError);
              toast.error("Failed to start video playback");
            }
          };

          // Also try to play immediately in case metadata is already loaded
          setTimeout(async () => {
            if (videoRef.current && !isCameraActive) {
              try {
                console.log("Fallback: trying to play video immediately");
                await videoRef.current.play();
                console.log("Fallback play successful");
                streamRef.current = stream;
                setIsCameraActive(true);
              } catch (e) {
                console.log("Fallback play failed, waiting for metadata");
              }
            }
          }, 100);
        } else {
          console.error("Video element not available!");
          toast.error("Video element not ready, please try again");
        }
      } catch (err) {
        console.error("Camera access error:", err);
        toast.error(`Failed to access camera: ${err.message || err}`);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsCameraActive(false);
      setDetectedStudents([]);
    }
  };

  const captureAndRecognize = async () => {
    if (!currentSession || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        const response = await attendanceApi.mark(currentSession.id, blob);
        console.log("Recognition response:", response);

        // Process the detected students from the response
        if (response.attendance && response.attendance.length > 0) {
          const newDetections: DetectedStudent[] = response.attendance.map((attendance: any) => ({
            id: attendance.student_id,
            name: attendance.student_name || `Student ${attendance.student_id}`,
            timestamp: attendance.timestamp || new Date().toISOString(),
            status: "detected" as const,
          }));

          // Add new detections to the list, avoiding duplicates
          setDetectedStudents(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNewDetections = newDetections.filter(s => !existingIds.has(s.id));
            return [...prev, ...uniqueNewDetections].slice(-10); // Keep last 10 detections
          });

          // Show success message with number of detections
          if (newDetections.length > 0) {
            toast.success(`${newDetections.length} student(s) detected and marked present`);
          }
        }
      } catch (err) {
        console.error("Recognition error:", err);
        // Don't show error toast for every failed recognition attempt
      }
    }, 'image/jpeg', 0.8);
  };

  // Capture frames when camera is active
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCameraActive && currentSession) {
      interval = setInterval(captureAndRecognize, 3000); // Capture every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCameraActive, currentSession]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // No session selected - show start new session option
  if (!currentSession) {
    if (loading || (courseId && startingSession)) {
      return (
        <div className="content-container">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                {courseId ? "Starting session..." : "Loading..."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // If we have a course_id from URL, show loading while auto-starting
    if (courseId) {
      return (
        <div className="content-container">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Starting session for selected course...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="content-container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Live Camera</h1>
          <p className="text-muted-foreground">Real-time face recognition for attendance</p>
        </div>

        <Card className="p-8 rounded-xl shadow-md text-center">
          <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Start New Session</h3>
          <p className="text-muted-foreground mb-6">
            Select a course to begin taking attendance with face recognition
          </p>
          <Button
            size="lg"
            className="rounded-xl"
            onClick={() => setShowCourseModal(true)}
            disabled={startingSession}
          >
            {startingSession ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                Start Session
              </>
            )}
          </Button>
        </Card>

        <CourseSelectionModal
          open={showCourseModal}
          onOpenChange={setShowCourseModal}
          courses={courses.map(c => ({ id: String(c.id), name: c.name, code: `COURSE-${c.id}` }))}
          onStart={handleStartNewSession}
        />
      </div>
    );
  }

  // Session active - show camera interface
  const currentCourse = courses.find(c => c.id === currentSession.course_id);

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Live Camera</h1>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground">Real-time face recognition for attendance</p>
          <Badge variant="default" className="ml-auto">
            {currentCourse?.name || "Unknown Course"}
          </Badge>
          {currentSession && (
            <Badge variant={currentSession.status === "open" ? "default" : "secondary"}>
              Session: {currentSession.status}
            </Badge>
          )}
        </div>
      </div>

      {currentSession.status !== "open" && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This session is closed. Recognition is disabled. Please start a new session.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6 rounded-xl shadow-md">
            <div className="w-full h-96 bg-black rounded-lg mb-4 relative overflow-hidden" style={{ minHeight: '384px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                width="640"
                height="480"
                className={`w-full h-full object-cover cursor-pointer ${isCameraActive ? '' : 'hidden'}`}
                style={{
                  backgroundColor: 'black',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onClick={async () => {
                  if (videoRef.current && videoRef.current.paused) {
                    try {
                      await videoRef.current.play();
                      console.log("Video started on click");
                    } catch (e) {
                      console.error("Failed to play video on click:", e);
                    }
                  }
                }}
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              {isCameraActive ? (
                <>
                  <div className="absolute top-4 right-4">
                    <Badge variant="default" className="bg-green-500">
                      <Camera className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  {/* Debug info */}
                  <div className="absolute bottom-4 left-4 text-white text-xs bg-black bg-opacity-50 p-2 rounded">
                    Camera: {isCameraActive ? 'ON' : 'OFF'} | Video: {videoRef.current ? 'REF OK' : 'REF NULL'}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <CameraOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Camera is not active</p>
                  </div>
                </div>
              )}
            </div>

            {cameraDevices.length > 1 && (
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Select Camera</label>
                <Select
                  value={selectedCameraId}
                  onValueChange={(value) => {
                    setSelectedCameraId(value);
                    // If camera is active, restart it with new device
                    if (isCameraActive) {
                      handleToggleCamera(); // Stop current camera
                      setTimeout(() => handleToggleCamera(), 100); // Start with new camera
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameraDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${cameraDevices.indexOf(device) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 rounded-xl"
                variant={isCameraActive ? "destructive" : "default"}
                onClick={handleToggleCamera}
                disabled={currentSession?.status !== "open"}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl"
                onClick={handleEndSession}
              >
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Recognition Status</h2>
          </div>

          {!isCameraActive ? (
            <p className="text-center text-muted-foreground py-8">
              Start the camera to begin face recognition
            </p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800">Scanning for faces...</span>
                </div>
                <p className="text-xs text-green-600">
                  Camera is active and detecting faces every 3 seconds
                  {detectedStudents.length > 0 && ` • ${detectedStudents.length} student(s) detected`}
                </p>
              </div>

              {detectedStudents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Detections:</h3>
                  {detectedStudents.slice(-5).map((student, i) => (
                    <div key={`${student.id}-${student.timestamp}`} className="p-2 rounded bg-muted text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{student.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            Detected
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(student.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Status:</span>
                <Badge variant={currentSession.status === "open" ? "default" : "secondary"}>
                  {currentSession.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Camera:</span>
                <Badge variant={isCameraActive ? "default" : "secondary"}>
                  {isCameraActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
