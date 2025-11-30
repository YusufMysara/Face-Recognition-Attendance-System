import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Users, Square, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CourseSelectionModal } from "@/components/modals/CourseSelectionModal";
import { useToast } from "@/hooks/use-toast";
import { sessionsApi, coursesApi, attendanceApi } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ActiveSession {
  id: string;
  course: string;
  started_at: string;
  status: string;
}

export default function LiveCamera() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const sessionId = searchParams.get("session_id");
  const courseId = searchParams.get("course_id");

  // Mock courses
  const mockCourses = [
    { id: "1", name: "Computer Science 101", code: "CS101" },
    { id: "2", name: "Mathematics 201", code: "MATH201" },
    { id: "3", name: "Physics 101", code: "PHY101" },
  ];

  const detectedStudents = [
    { name: "John Doe", confidence: "98%", status: "Verified" },
    { name: "Jane Smith", confidence: "95%", status: "Verified" },
    { name: "Bob Johnson", confidence: "92%", status: "Pending" },
  ];

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    setLoading(true);
    try {
      if (sessionId) {
        // Fetch session details
        const session = await sessionsApi.getSession(sessionId);
        
        if (session.status === "ongoing") {
          setCurrentSession(session);
        } else {
          toast({
            title: "Session Closed",
            description: "This session has ended. Please start a new session.",
            variant: "destructive",
          });
        }
      } else {
        // Fetch active sessions for teacher
        const teacherId = "teacher_123"; // Replace with actual teacher ID
        const sessions = await sessionsApi.getTeacherSessions(teacherId, "ongoing");
        setActiveSessions(sessions || []);
      }
    } catch (error) {
      console.error("Error loading session data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = async (courseId: string, sessionName?: string) => {
    try {
      // Check for existing ongoing session for this course
      const teacherId = "teacher_123";
      const existingSessions = await sessionsApi.getTeacherSessions(teacherId, "ongoing");
      const conflictingSession = existingSessions?.find((s: any) => s.course_id === courseId);
      
      if (conflictingSession) {
        toast({
          title: "Session Already Active",
          description: "There is an ongoing session for this course. Please resume it instead.",
          variant: "destructive",
        });
        return;
      }

      const response = await sessionsApi.startSession({
        course_id: courseId,
        teacher_id: teacherId,
        session_name: sessionName,
      });

      if (response.session_id) {
        toast({
          title: "Session Started",
          description: "Session started successfully.",
        });
        navigate(`/teacher/camera?session_id=${response.session_id}&course_id=${courseId}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowCourseModal(false);
    }
  };

  const handleResumeSession = (session: ActiveSession) => {
    navigate(`/teacher/camera?session_id=${session.id}`);
    setCurrentSession(session);
  };

  const handleEndSession = async () => {
    if (!currentSession) return;
    
    // Navigate to session review page
    navigate(`/teacher/session/${currentSession.id}/review?course_id=${courseId}`);
  };

  const handleToggleCamera = () => {
    if (!currentSession) {
      toast({
        title: "No Active Session",
        description: "Please start a session first.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentSession.status !== "ongoing") {
      toast({
        title: "Session Closed",
        description: "This session is closed. Start a new session.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCameraActive(!isCameraActive);
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // No session selected - show active sessions and start new option
  if (!currentSession) {
    return (
      <div className="content-container">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Live Camera</h1>
          <p className="text-muted-foreground">Real-time face recognition for attendance</p>
        </div>

        {activeSessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => (
                <Card key={session.id} className="p-4 rounded-xl shadow-md">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{session.course}</h3>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(session.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => handleResumeSession(session)}
                  >
                    Resume Session
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card className="p-8 rounded-xl shadow-md text-center">
          <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Active Session</h3>
          <p className="text-muted-foreground mb-6">
            Start a new session to begin taking attendance with the camera
          </p>
          <Button
            size="lg"
            className="rounded-xl"
            onClick={() => setShowCourseModal(true)}
          >
            Start New Session
          </Button>
        </Card>

        <CourseSelectionModal
          open={showCourseModal}
          onOpenChange={setShowCourseModal}
          courses={mockCourses}
          onStart={handleStartNewSession}
        />
      </div>
    );
  }

  // Session active - show camera interface
  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Live Camera</h1>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground">Real-time face recognition for attendance</p>
          <Badge variant="default" className="ml-auto">
            {currentSession.course}
          </Badge>
        </div>
      </div>

      {currentSession.status !== "ongoing" && (
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
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
              {isCameraActive ? (
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-background flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-muted-foreground">Camera feed active...</p>
                    <div className="mt-4 w-48 h-48 mx-auto border-4 border-primary rounded-lg animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <CameraOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Camera is not active</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 rounded-xl"
                variant={isCameraActive ? "destructive" : "default"}
                onClick={handleToggleCamera}
                disabled={currentSession.status !== "ongoing"}
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
            <h2 className="text-xl font-semibold">Detected Students</h2>
          </div>

          {!isCameraActive ? (
            <p className="text-center text-muted-foreground py-8">
              Start the camera to detect students
            </p>
          ) : (
            <div className="space-y-3">
              {detectedStudents.map((student, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{student.name}</span>
                    <Badge variant={student.status === "Verified" ? "default" : "secondary"}>
                      {student.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {student.confidence}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Detected:</span>
                <span className="font-semibold">{isCameraActive ? detectedStudents.length : 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verified:</span>
                <span className="font-semibold text-success">
                  {isCameraActive ? detectedStudents.filter(s => s.status === "Verified").length : 0}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
