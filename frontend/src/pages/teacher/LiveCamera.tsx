import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as faceapi from "@vladmandic/face-api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseSelectionModal } from "@/components/modals/CourseSelectionModal";
import {
  AlertCircle,
  Camera,
  CameraOff,
  Loader2,
  RotateCcw,
  ScanFace,
  Square,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  attendanceApi,
  coursesApi,
  handleApiError,
  sessionsApi,
} from "@/lib/api";

// ── face-api.js config ───────────────────────────────────────────────────────
// SSD MobileNet V1 is designed for multi-scale detection — it natively handles
// faces at various distances without any upscaling tricks.
const FACEAPI_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

/** Minimum ms between successive recognition API calls. */
const RECOGNITION_COOLDOWN_MS = 1_500;

// ── Types ───────────────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the scale + offset needed to map a point from the video's natural
 * pixel space into the canvas pixel space, assuming the video uses
 * object-fit: cover inside its container.
 */
function getObjectFitCoverTransform(video: HTMLVideoElement) {
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.max(cw / vw, ch / vh);
  return {
    scale,
    offsetX: (cw - vw * scale) / 2,
    offsetY: (ch - vh * scale) / 2,
    canvasW: cw,
    canvasH: ch,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function LiveCamera() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Existing session / course state ──────────────────────────────────────
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

  // ── face-api / detection state ────────────────────────────────────────────
  const [detectorReady, setDetectorReady] = useState(false);
  const [facesNow, setFacesNow] = useState(0);         // faces in current frame
  const [isRecognizing, setIsRecognizing] = useState(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Canvas rendered on top of the video for live bounding-box overlays. */
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  /** Hidden canvas used only to capture a JPEG frame for the backend. */
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Detection refs ────────────────────────────────────────────────────────
  const animFrameRef = useRef<number | null>(null);
  const detectionActiveRef = useRef(false);
  const lastRecognitionRef = useRef(0);
  const isRecognizingRef = useRef(false);

  /** Mirror of currentSession kept up-to-date for use inside the rAF loop. */
  const currentSessionRef = useRef<Session | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const sessionId = searchParams.get("session_id");
  const courseId = searchParams.get("course_id");

  // ── Initialise face-api on mount ─────────────────────────────────────────
  useEffect(() => {
    initFaceDetector();
    loadCameraDevices();

    return () => {
      // Cleanup on unmount
      detectionActiveRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const initFaceDetector = async () => {
    try {
      // SSD MobileNet V1 — best accuracy across a range of face sizes/distances
      await faceapi.nets.ssdMobilenetv1.loadFromUri(FACEAPI_MODEL_URL);
      setDetectorReady(true);
    } catch (err) {
      console.error("face-api failed to load model:", err);
    }
  };

  // ── Load camera device list ───────────────────────────────────────────────
  const loadCameraDevices = async () => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter((d) => d.kind === "videoinput");

      // If labels are empty we don't yet have permission — request briefly
      if (videoDevices.length > 0 && !videoDevices[0].label) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter((d) => d.kind === "videoinput");
      }

      setCameraDevices(videoDevices);
      if (videoDevices.length > 0) setSelectedCameraId(videoDevices[0].deviceId);
    } catch {
      setCameraDevices([]);
    }
  };

  // ── Session / course loading ──────────────────────────────────────────────
  useEffect(() => {
    loadSessionData();
    loadCourses();
  }, [sessionId]);

  useEffect(() => {
    if (courseId && courses.length > 0 && !currentSession && !startingSession) {
      handleStartNewSession(courseId);
    }
  }, [courseId, courses, currentSession, startingSession]);

  const loadCourses = async () => {
    try {
      setCourses(await coursesApi.list());
    } catch (err) {
      console.error("Error loading courses:", err);
    }
  };

  const loadSessionData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (sessionId) {
        const sid = parseInt(sessionId);
        let sessionData = await sessionsApi.get(sid);

        if (sessionData.status === "submitted") {
          toast.error("This session has already been submitted");
          navigate(`/teacher/session/${sid}/review`);
          return;
        }
        if (sessionData.status === "closed") {
          await attendanceApi.retake(sid);
          sessionData = await sessionsApi.get(sid);
          toast.success("Session reopened for retake — attendance cleared");
        }

        setCurrentSession(sessionData);

        if (sessionData.course_id) {
          const courseData = await coursesApi.get(sessionData.course_id);
          setCourses((prev) =>
            prev.find((c) => c.id === courseData.id) ? prev : [...prev, courseData]
          );
        }
      }
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = async (cid: string) => {
    try {
      setStartingSession(true);
      const response = await sessionsApi.start(parseInt(cid));
      toast.success("Session started");
      setCurrentSession(response);
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

  // ── Camera toggle ─────────────────────────────────────────────────────────
  const handleToggleCamera = async () => {
    if (!currentSession) {
      toast.error("Please start a session first");
      return;
    }
    if (currentSession.status !== "open") {
      toast.error("Session is not active");
      return;
    }

    if (!isCameraActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          },
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setIsCameraActive(true);
      } catch (err: any) {
        toast.error(`Camera error: ${err.message ?? err}`);
      }
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setDetectedStudents([]);
    }
  };

  // ── Start / stop the detection loop when camera state changes ────────────
  useEffect(() => {
    if (isCameraActive && detectorReady) {
      detectionActiveRef.current = true;
      animFrameRef.current = requestAnimationFrame(detectionLoop);
    } else {
      detectionActiveRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // Clear overlay
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        overlay.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
      }
      setFacesNow(0);
    }
  }, [isCameraActive, detectorReady]);

  // ── Core detection loop ───────────────────────────────────────────────────
  // Async: awaits each face-api detection, then schedules the next frame.
  // This naturally runs at the model's throughput (~15-30 fps on GPU) without
  // queueing multiple detections on top of each other.
  // All mutable state is accessed through refs so the callback is stable.
  const detectionLoop = useCallback(async () => {
    if (!detectionActiveRef.current) return;

    const video   = videoRef.current;
    const overlay = overlayCanvasRef.current;

    if (
      !video || !overlay ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.paused
    ) {
      animFrameRef.current = requestAnimationFrame(() => void detectionLoop());
      return;
    }

    // Keep the overlay canvas sized to the video's rendered CSS pixels
    const transform = getObjectFitCoverTransform(video);
    if (!transform) {
      animFrameRef.current = requestAnimationFrame(() => void detectionLoop());
      return;
    }
    const { scale, offsetX, offsetY, canvasW, canvasH } = transform;
    if (overlay.width !== canvasW || overlay.height !== canvasH) {
      overlay.width  = canvasW;
      overlay.height = canvasH;
    }

    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // ── face-api SSD MobileNet detection ────────────────────────────────────
    // SSD MobileNet V1 uses a feature-pyramid network and handles multiple
    // scales natively — no manual upscaling needed.
    const detections = await faceapi.detectAllFaces(
      video,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );

    setFacesNow(detections.length);

    if (detections.length > 0) {
      drawBoundingBoxes(ctx, detections, scale, offsetX, offsetY);

      const now = performance.now();
      if (
        now - lastRecognitionRef.current > RECOGNITION_COOLDOWN_MS &&
        !isRecognizingRef.current
      ) {
        lastRecognitionRef.current = now;
        sendForRecognition(detections);
      }
    }

    if (detectionActiveRef.current) {
      animFrameRef.current = requestAnimationFrame(() => void detectionLoop());
    }
  }, []); // stable — all deps go through refs

  // ── Draw bounding boxes ───────────────────────────────────────────────────
  function drawBoundingBoxes(
    ctx: CanvasRenderingContext2D,
    detections: faceapi.FaceDetection[],
    scale: number,
    offsetX: number,
    offsetY: number,
  ) {
    detections.forEach((det) => {
      const { x: ox, y: oy, width, height } = det.box;
      const x = ox * scale + offsetX;
      const y = oy * scale + offsetY;
      const w = width  * scale;
      const h = height * scale;

      // Solid border
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Corner accents
      const c = Math.min(w, h) * 0.22;
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      // Top-left
      ctx.beginPath(); ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c); ctx.stroke();

      // Confidence badge above box
      const label = `${(det.score * 100).toFixed(0)}%`;
      ctx.font = "bold 11px monospace";
      const textW = ctx.measureText(label).width + 8;
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.roundRect(x, y - 20, textW, 18, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 4, y - 6);
    });
  }

  // ── Send frame to backend for recognition ─────────────────────────────────
  const sendForRecognition = useCallback(async (detections: faceapi.FaceDetection[]) => {
    const session = currentSessionRef.current;
    if (!session || !videoRef.current || !captureCanvasRef.current) return;
    if (isRecognizingRef.current) return;

    isRecognizingRef.current = true;
    setIsRecognizing(true);

    try {
      const video = videoRef.current;
      const capture = captureCanvasRef.current;
      capture.width = video.videoWidth;
      capture.height = video.videoHeight;
      const ctx = capture.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      // Convert face-api bounding boxes → face_recognition format:
      // [top, right, bottom, left]  (all in natural video pixels)
      const faceLocations = detections.map((d) => {
        const { x, y, width, height } = d.box;
        return [
          Math.max(0, Math.round(y)),                            // top
          Math.min(video.videoWidth,  Math.round(x + width)),   // right
          Math.min(video.videoHeight, Math.round(y + height)),  // bottom
          Math.max(0, Math.round(x)),                            // left
        ];
      });

      const blob = await new Promise<Blob | null>((res) =>
        capture.toBlob(res, "image/jpeg", 0.85)
      );
      if (!blob) return;

      const response = await attendanceApi.mark(session.id, blob, faceLocations);

      if (response.attendance?.length > 0) {
        const incoming: DetectedStudent[] = response.attendance.map((a: any) => ({
          id: a.student_id,
          name: a.student_name ?? `Student ${a.student_id}`,
          timestamp: a.timestamp ?? new Date().toISOString(),
          status: "detected" as const,
        }));

        setDetectedStudents((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const unique = incoming.filter((s) => !seen.has(s.id));
          if (unique.length > 0) {
            toast.success(`${unique.length} student(s) marked present`);
          }
          return [...prev, ...unique].slice(-10);
        });
      }
    } catch (err) {
      console.error("Recognition error:", err);
    } finally {
      isRecognizingRef.current = false;
      setIsRecognizing(false);
    }
  }, []); // stable — all deps go through refs

  // ── Loading / no-session screens ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="content-container flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!currentSession) {
    if (courseId && startingSession) {
      return (
        <div className="content-container flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Starting session…</p>
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
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting…</>
            ) : (
              <><Camera className="w-4 h-4 mr-2" />Start Session</>
            )}
          </Button>
        </Card>
        <CourseSelectionModal
          open={showCourseModal}
          onOpenChange={setShowCourseModal}
          courses={courses.map((c) => ({ id: String(c.id), name: c.name, code: `COURSE-${c.id}` }))}
          onStart={handleStartNewSession}
        />
      </div>
    );
  }

  // ── Main camera interface ─────────────────────────────────────────────────
  const currentCourse = courses.find((c) => c.id === currentSession.course_id);

  return (
    <div className="content-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Live Camera</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-muted-foreground">Real-time face recognition for attendance</p>
          <Badge variant="default" className="ml-auto">
            {currentCourse?.name ?? "Unknown Course"}
          </Badge>
          <Badge variant={currentSession.status === "open" ? "default" : "secondary"}>
            Session: {currentSession.status}
          </Badge>
        </div>
      </div>

      {currentSession.status !== "open" && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This session is closed. Recognition is disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Camera feed ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="p-6 rounded-xl shadow-md">

            {/* Video + overlay container */}
            <div
              className="w-full bg-black rounded-lg mb-4 overflow-hidden"
              style={{ height: "384px", position: "relative" }}
            >
              {/* Live video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: isCameraActive ? "block" : "none" }}
              />

              {/* Bounding-box overlay (pointer-events: none so clicks pass through) */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ display: isCameraActive ? "block" : "none" }}
              />

              {/* Hidden capture canvas */}
              <canvas ref={captureCanvasRef} className="hidden" />

              {/* Status badges on top of feed */}
              {isCameraActive && (
                <>
                  {/* Active indicator */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Badge className="bg-green-600 text-white">
                      <Camera className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                    {isRecognizing && (
                      <Badge className="bg-blue-600 text-white">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Recognizing…
                      </Badge>
                    )}
                  </div>

                  {/* Face count badge */}
                  {facesNow > 0 && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-600 text-white">
                        <ScanFace className="w-3 h-3 mr-1" />
                        {facesNow} face{facesNow !== 1 ? "s" : ""} detected
                      </Badge>
                    </div>
                  )}

                  {/* face-api model not ready yet */}
                  {!detectorReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center text-white">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Initialising face detector…</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Inactive placeholder */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {!detectorReady ? (
                      <>
                        <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Loading face detector…</p>
                      </>
                    ) : (
                      <>
                        <CameraOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400">Camera is not active</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Camera selector */}
            {cameraDevices.length > 1 && (
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Camera</label>
                <Select
                  value={selectedCameraId}
                  onValueChange={(v) => {
                    setSelectedCameraId(v);
                    if (isCameraActive) {
                      handleToggleCamera(); // stop
                      setTimeout(handleToggleCamera, 150); // restart with new device
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameraDevices.map((d, i) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 rounded-xl"
                variant={isCameraActive ? "destructive" : "default"}
                onClick={handleToggleCamera}
                disabled={currentSession.status !== "open" || !detectorReady}
              >
                {isCameraActive ? (
                  <><CameraOff className="w-4 h-4 mr-2" />Stop Camera</>
                ) : (
                  <><Camera className="w-4 h-4 mr-2" />Start Camera</>
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

        {/* ── Recognition status panel ────────────────────────────────────── */}
        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Recognition Status</h2>
          </div>

          {!isCameraActive ? (
            <p className="text-center text-muted-foreground py-8">
              {detectorReady
                ? "Start the camera to begin face recognition"
                : "Loading face detector…"}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Live scanning indicator */}
              <div
                className={`p-4 rounded-lg border ${
                  facesNow > 0
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      facesNow > 0 ? "bg-green-500" : "bg-yellow-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      facesNow > 0 ? "text-green-800" : "text-yellow-800"
                    }`}
                  >
                    {facesNow > 0
                      ? `${facesNow} face${facesNow !== 1 ? "s" : ""} in frame`
                      : "Looking for faces…"}
                  </span>
                </div>
                <p
                  className={`text-xs ${
                    facesNow > 0 ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  {isRecognizing
                    ? "Identifying student…"
                    : facesNow > 0
                    ? "Matching against enrolled students"
                    : "Point the camera at student faces"}
                </p>
              </div>

              {/* Detected students list */}
              {detectedStudents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">
                    Marked Present ({detectedStudents.length}):
                  </h3>
                  {detectedStudents.slice(-5).map((s) => (
                    <div
                      key={`${s.id}-${s.timestamp}`}
                      className="p-2 rounded bg-muted text-sm"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs bg-green-600">
                            Present
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Session info footer */}
          <div className="mt-6 pt-6 border-t border-border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session:</span>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Detector:</span>
              <Badge variant={detectorReady ? "default" : "secondary"}>
                {detectorReady ? "Ready" : "Loading…"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
