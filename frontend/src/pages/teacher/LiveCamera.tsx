import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SCRFDDetector, type ScrfdDetection } from "@/lib/scrfd";

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
  systemApi,
} from "@/lib/api";

// ── Constants ────────────────────────────────────────────────────────────────
/** SCRFD-500M ONNX model served from /public/models/. */
const MODEL_URL = "/models/scrfd_500m.onnx";

// ── Types ─────────────────────────────────────────────────────────────────────
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

/** One recognition result returned by /attendance/mark-crops. */
interface RecognitionResult {
  face_index: number;
  student_id: number | null;
  student_name: string | null;
  score: number;
  /** bbox in video natural pixels — attached on the frontend from SCRFD detections. */
  box: { x: number; y: number; width: number; height: number };
}

/**
 * A face that has been recognised with high confidence and is held in the
 * frontend cache so we don't re-send it to the backend every cycle.
 */
interface ConfirmedFace {
  /** Face centre in video pixels — updated each detection frame so we track movement. */
  cx: number;
  cy: number;
  result: RecognitionResult;
  /** Date.now() when this entry was last confirmed by the backend. */
  confirmedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Find the recognition result whose centre is closest to the given box.
 * Returns null if nothing is within 120 video-pixels.
 */
function matchRecognition(
  box: { x: number; y: number; width: number; height: number },
  results: RecognitionResult[],
): RecognitionResult | null {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let nearest: RecognitionResult | null = null;
  let nearestDist = 120;
  for (const r of results) {
    const rcx = r.box.x + r.box.width / 2;
    const rcy = r.box.y + r.box.height / 2;
    const dist = Math.sqrt((cx - rcx) ** 2 + (cy - rcy) ** 2);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = r;
    }
  }
  return nearest;
}

/** Draw boxes for all SCRFD detections, colouring recognised ones green. */
function drawDetectionBoxes(
  ctx: CanvasRenderingContext2D,
  detections: ScrfdDetection[],
  recognitionResults: RecognitionResult[],
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  detections.forEach((det) => {
    const b = det.box;
    const match = matchRecognition(b, recognitionResults);

    const x = b.x * scale + offsetX;
    const y = b.y * scale + offsetY;
    const w = b.width * scale;
    const h = b.height * scale;

    const recognized  = match?.student_id != null;
    const borderColor = recognized ? "#22c55e" : "#94a3b8";
    const accentColor = recognized ? "#4ade80" : "#cbd5e1";
    const labelBg     = recognized ? "#16a34a" : "#475569";
    const label       = recognized ? match!.student_name! : "Unknown";

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const c = Math.min(w, h) * 0.22;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x,       y + c); ctx.lineTo(x,       y);       ctx.lineTo(x + c,   y);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-c,   y);     ctx.lineTo(x+w,     y);       ctx.lineTo(x+w,     y + c);   ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,       y+h-c); ctx.lineTo(x,       y+h);     ctx.lineTo(x + c,   y+h);     ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-c,   y+h);   ctx.lineTo(x+w,     y+h);     ctx.lineTo(x+w,     y+h-c);   ctx.stroke();

    ctx.font = "bold 11px monospace";
    const textW = ctx.measureText(label).width + 8;
    ctx.fillStyle = labelBg;
    ctx.beginPath();
    ctx.roundRect(x, y - 20, textW, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 4, y - 6);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveCamera() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Session / course state ────────────────────────────────────────────────
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

  // ── Recognition state ─────────────────────────────────────────────────────
  const [modelLoaded, setModelLoaded] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [facesNow, setFacesNow] = useState(0);
  const [recognizedNow, setRecognizedNow] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Loop refs ─────────────────────────────────────────────────────────────
  // Both loops are continuous chains — next iteration starts as soon as the
  // previous one finishes (+ 100ms pause for recognition), so there's no
  // "missed tick" wait time.
  const detectLoopRef  = useRef<number | null>(null);
  const isDetectingRef = useRef(false); // prevents overlapping SCRFD calls

  // ── Flag refs ─────────────────────────────────────────────────────────────
  const cameraActiveRef   = useRef(false);
  const isRecognizingRef  = useRef(false);
  const modelLoadedRef    = useRef(false);

  // ── Data refs (read inside interval callbacks) ────────────────────────────
  const latestDetectionsRef  = useRef<ScrfdDetection[]>([]);
  const lastRecognitionRef   = useRef<RecognitionResult[]>([]);
  const detectorRef          = useRef<SCRFDDetector | null>(null);
  const currentSessionRef    = useRef<Session | null>(null);
  /**
   * Cache of faces already confirmed by the backend with high confidence.
   * Faces in this cache are shown instantly without a backend round-trip.
   * Entries are evicted when the face moves out of frame or TTL expires.
   */
  const confirmedFacesRef    = useRef<ConfirmedFace[]>([]);
  useEffect(() => { currentSessionRef.current = currentSession; }, [currentSession]);

  const sessionId = searchParams.get("session_id");
  const courseId  = searchParams.get("course_id");

  // ── Load SCRFD-500M model once ────────────────────────────────────────────
  useEffect(() => {
    const det = new SCRFDDetector();
    detectorRef.current = det;
    det
      .load(MODEL_URL)
      .then(() => {
        modelLoadedRef.current = true;
        setModelLoaded(true);
      })
      .catch((err) => console.error("Failed to load SCRFD model:", err));
  }, []);

  // ── Poll backend /ready until InsightFace warmup completes ───────────────
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        const ready = await systemApi.isReady();
        if (ready) {
          if (!cancelled) setBackendReady(true);
          return;
        }
        // Wait 2 seconds before polling again
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  // ── Mount: load cameras; cleanup on unmount ────────────────────────────────
  useEffect(() => {
    loadCameraDevices();
    return () => {
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const loadCameraDevices = async () => {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter((d) => d.kind === "videoinput");
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

  // ── Session / course loading ───────────────────────────────────────────────
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

  // ── Detection loop (SCRFD + ONNX Runtime Web, continuous rAF loop) ────────
  // Runs as fast as SCRFD can process — no fixed interval, so entering the
  // frame is detected within one inference cycle (~50–100 ms) every time.
  const detectFaces = useCallback(async () => {
    if (!modelLoadedRef.current || !cameraActiveRef.current) return;
    const video   = videoRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !overlay) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.paused) return;

    const detections = await detectorRef.current!.detect(video);

    if (!cameraActiveRef.current) return; // camera stopped while awaiting

    latestDetectionsRef.current = detections;
    setFacesNow(detections.length);

    // Draw boxes immediately using cached recognition labels
    const transform = getObjectFitCoverTransform(video);
    if (!transform) return;
    const { scale, offsetX, offsetY, canvasW, canvasH } = transform;
    if (overlay.width !== canvasW || overlay.height !== canvasH) {
      overlay.width  = canvasW;
      overlay.height = canvasH;
    }
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawDetectionBoxes(ctx, detections, lastRecognitionRef.current, scale, offsetX, offsetY);
  }, []);

  // ── Recognition cache constants ───────────────────────────────────────────
  // A face confirmed with score ≥ CACHE_CONFIRM_THRESH is stored in
  // confirmedFacesRef and served instantly on subsequent frames without
  // hitting the backend.  The entry is re-checked after CACHE_TTL_MS ms
  // or when the face moves more than CACHE_MATCH_DIST_PX pixels.
  const CACHE_CONFIRM_THRESH = 0.45;   // min score to cache (backend threshold is 0.35)
  const CACHE_MATCH_DIST_PX  = 100;    // max centre movement (video px) to still match
  const CACHE_TTL_MS         = 15_000; // re-verify a cached face every 15 s

  // ── Recognition loop (InsightFace backend) ────────────────────────────────
  const recognizeFaces = useCallback(async () => {
    if (isRecognizingRef.current || !cameraActiveRef.current) return;

    const detections = latestDetectionsRef.current;
    const session    = currentSessionRef.current;
    const video      = videoRef.current;

    // No faces detected by SCRFD → clear everything and skip backend call
    if (!detections.length || !session || !video) {
      lastRecognitionRef.current = [];
      confirmedFacesRef.current  = [];
      setRecognizedNow(0);
      return;
    }

    isRecognizingRef.current = true;
    setIsRecognizing(true);

    try {
      const t0  = performance.now();
      const now = Date.now();

      // ── Evict cache entries whose face has left the frame ─────────────────
      confirmedFacesRef.current = confirmedFacesRef.current.filter((cf) =>
        detections.some((det) => {
          const dx = (det.box.x + det.box.width  / 2) - cf.cx;
          const dy = (det.box.y + det.box.height / 2) - cf.cy;
          return Math.sqrt(dx * dx + dy * dy) < CACHE_MATCH_DIST_PX * 1.5;
        }),
      );

      // ── Split detections: served from cache vs. needs backend ─────────────
      const toRecognize: ScrfdDetection[]   = [];
      const cachedResults: RecognitionResult[] = [];

      for (const det of detections) {
        const cx = det.box.x + det.box.width  / 2;
        const cy = det.box.y + det.box.height / 2;

        const hit = confirmedFacesRef.current.find((cf) => {
          const dx = cx - cf.cx;
          const dy = cy - cf.cy;
          return (
            Math.sqrt(dx * dx + dy * dy) < CACHE_MATCH_DIST_PX &&
            now - cf.confirmedAt < CACHE_TTL_MS
          );
        });

        if (hit) {
          hit.cx = cx; // track movement
          hit.cy = cy;
          cachedResults.push({ ...hit.result, box: det.box });
        } else {
          toRecognize.push(det);
        }
      }

      // All faces already confirmed → update overlay instantly, skip backend
      if (!toRecognize.length) {
        lastRecognitionRef.current = cachedResults;
        setRecognizedNow(cachedResults.filter((r) => r.student_id !== null).length);
        return;
      }

      // ── Phase 1: draw crops for unrecognised detections synchronously ─────
      const canvases: HTMLCanvasElement[] = [];
      const boxes: RecognitionResult["box"][] = [];

      for (const det of toRecognize) {
        const { x, y, width, height } = det.box;
        const pad = 0.25;
        const cx2 = Math.max(0, Math.round(x - width  * pad));
        const cy2 = Math.max(0, Math.round(y - height * pad));
        const cw  = Math.min(video.videoWidth  - cx2, Math.round(width  * (1 + 2 * pad)));
        const ch  = Math.min(video.videoHeight - cy2, Math.round(height * (1 + 2 * pad)));
        if (cw < 20 || ch < 20) continue;

        const canvas = document.createElement("canvas");
        canvas.width  = cw;
        canvas.height = ch;
        canvas.getContext("2d")!.drawImage(video, cx2, cy2, cw, ch, 0, 0, cw, ch);
        canvases.push(canvas);
        boxes.push(det.box);
      }

      if (!canvases.length) return;

      // ── Phase 2: encode all canvases to JPEG synchronously ────────────────
      // toDataURL() is synchronous — the main thread never yields so SCRFD
      // can't interrupt between crops (~5 ms total vs ~1600 ms with toBlob).
      const crops: Blob[] = canvases.map((canvas) => {
        const dataURL = canvas.toDataURL("image/jpeg", 0.75);
        const base64  = dataURL.slice("data:image/jpeg;base64,".length);
        const binary  = atob(base64);
        const bytes   = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: "image/jpeg" });
      });
      const tCrop = performance.now();
      console.log(`[timing] crop×${crops.length}: ${(tCrop - t0).toFixed(1)} ms`);

      if (!crops.length) return;

      const tReq = performance.now();
      const response = await attendanceApi.markCrops(session.id, crops);
      const tRes = performance.now();
      console.log(`[timing] HTTP round-trip: ${(tRes - tReq).toFixed(1)} ms`);
      console.log(`[timing] total: ${(tRes - t0).toFixed(1)} ms`);

      if (!cameraActiveRef.current) return;

      const newResults: RecognitionResult[] = (response.recognized ?? []).map((r: any) => ({
        ...r,
        box: boxes[r.face_index] ?? boxes[0],
      }));

      // ── Update confirmed-faces cache with high-confidence results ──────────
      for (const r of newResults) {
        const cached = r.student_id !== null && r.score >= CACHE_CONFIRM_THRESH;
        console.log(
          `[recognition] face ${r.face_index} ` +
          `(${Math.round(r.box.width)}×${Math.round(r.box.height)}px): ` +
          `${r.student_name ?? "Unknown"} | score=${r.score.toFixed(3)}` +
          (cached ? " → cached ✓" : ""),
        );

        if (cached) {
          const cx = r.box.x + r.box.width  / 2;
          const cy = r.box.y + r.box.height / 2;
          const existing = confirmedFacesRef.current.find((cf) => {
            const dx = cx - cf.cx;
            const dy = cy - cf.cy;
            return Math.sqrt(dx * dx + dy * dy) < CACHE_MATCH_DIST_PX;
          });
          if (existing) {
            existing.cx          = cx;
            existing.cy          = cy;
            existing.result      = r;
            existing.confirmedAt = now;
          } else {
            confirmedFacesRef.current.push({ cx, cy, result: r, confirmedAt: now });
          }
        }
      }

      // Merge cached + new results for the overlay
      const allResults = [...cachedResults, ...newResults];
      lastRecognitionRef.current = allResults;
      setRecognizedNow(allResults.filter((r) => r.student_id !== null).length);

      // Update detected-students list (new matches only)
      const matched = allResults.filter((r) => r.student_id !== null);
      if (matched.length > 0) {
        const incoming: DetectedStudent[] = matched.map((r) => ({
          id: r.student_id!,
          name: r.student_name!,
          timestamp: new Date().toISOString(),
          status: "detected" as const,
        }));
        setDetectedStudents((prev) => {
          const seen   = new Set(prev.map((s) => s.id));
          const unique = incoming.filter((s) => !seen.has(s.id));
          if (unique.length > 0) toast.success(`${unique.length} student(s) marked present`);
          return [...prev, ...unique].slice(-10);
        });
      }
    } catch (err) {
      console.error("Recognition error:", err);
    } finally {
      isRecognizingRef.current = false;
      setIsRecognizing(false);
    }
  }, []);

  // ── Camera toggle ──────────────────────────────────────────────────────────
  const handleToggleCamera = async () => {
    if (!currentSession)                        { toast.error("Please start a session first"); return; }
    if (currentSession.status !== "open")       { toast.error("Session is not active");       return; }

    if (!isCameraActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:    { ideal: 1280 },
            height:   { ideal: 720  },
            deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          },
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        cameraActiveRef.current = true;
        setIsCameraActive(true);

        // Detection: continuous rAF loop — runs a new SCRFD inference as soon
        // as the previous one finishes, so face appearance is detected in one
        // inference cycle (~50–100 ms) regardless of when in the cycle you appear.
        const runDetectLoop = () => {
          if (!cameraActiveRef.current) return;
          if (!isDetectingRef.current) {
            isDetectingRef.current = true;
            detectFaces().finally(() => { isDetectingRef.current = false; });
          }
          detectLoopRef.current = requestAnimationFrame(runDetectLoop);
        };
        detectLoopRef.current = requestAnimationFrame(runDetectLoop);

        // Recognition: continuous chain — next request starts 100ms after the
        // previous one finishes, so the gap = backend_time + 100ms instead of
        // being rounded up to the nearest 500ms tick.
        const runRecognizeLoop = async () => {
          while (cameraActiveRef.current) {
            await recognizeFaces();
            // Small pause so the browser can breathe between requests
            await new Promise((r) => setTimeout(r, 100));
          }
        };
        runRecognizeLoop();
      } catch (err: any) {
        toast.error(`Camera error: ${err.message ?? err}`);
      }
    } else {
      // Stop immediately — in-flight callbacks will bail on cameraActiveRef check
      cameraActiveRef.current  = false;
      isRecognizingRef.current = false;
      isDetectingRef.current   = false;

      if (detectLoopRef.current) { cancelAnimationFrame(detectLoopRef.current); detectLoopRef.current = null; }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;

      // Clear overlay
      const overlay = overlayCanvasRef.current;
      if (overlay) overlay.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);

      latestDetectionsRef.current = [];
      lastRecognitionRef.current  = [];
      confirmedFacesRef.current   = [];

      setIsCameraActive(false);
      setIsRecognizing(false);
      setDetectedStudents([]);
      setFacesNow(0);
      setRecognizedNow(0);
    }
  };

  // ── Loading / no-session screens ───────────────────────────────────────────
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

  // ── Main camera interface ──────────────────────────────────────────────────
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
          <AlertDescription>This session is closed. Recognition is disabled.</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Camera feed ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="p-6 rounded-xl shadow-md">
            {/* Video + overlay container */}
            <div
              className="w-full bg-black rounded-lg mb-4 overflow-hidden"
              style={{ height: "384px", position: "relative" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ display: isCameraActive ? "block" : "none" }}
              />

              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ display: isCameraActive ? "block" : "none" }}
              />

              {/* Status badges */}
              {isCameraActive && (
                <>
                  {/* Top-right: live / recognizing */}
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

                  {/* Top-left: detected / recognized counters */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <Badge className={facesNow > 0 ? "bg-yellow-500 text-white" : "bg-gray-600 text-white"}>
                      <ScanFace className="w-3 h-3 mr-1" />
                      Detected: {facesNow}
                    </Badge>
                    <Badge className={recognizedNow > 0 ? "bg-green-600 text-white" : "bg-gray-600 text-white"}>
                      <Users className="w-3 h-3 mr-1" />
                      Recognized: {recognizedNow}
                    </Badge>
                  </div>
                </>
              )}

              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <CameraOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Camera is not active</p>
                    {!modelLoaded && (
                      <p className="text-gray-500 text-sm mt-2 flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading detection model…
                      </p>
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
                      handleToggleCamera();
                      setTimeout(handleToggleCamera, 150);
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
                disabled={currentSession.status !== "open" || (!isCameraActive && !backendReady)}
                title={!backendReady && !isCameraActive ? "Waiting for backend models to finish loading…" : undefined}
              >
                {isCameraActive ? (
                  <><CameraOff className="w-4 h-4 mr-2" />Stop Camera</>
                ) : !backendReady ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Backend loading…</>
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

        {/* ── Recognition status panel ──────────────────────────────────────── */}
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
              <div
                className={`p-4 rounded-lg border ${
                  facesNow > 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
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
                <p className={`text-xs ${facesNow > 0 ? "text-green-600" : "text-yellow-600"}`}>
                  {isRecognizing
                    ? "Identifying students…"
                    : facesNow > 0
                    ? "Matching against enrolled students"
                    : "Point the camera at student faces"}
                </p>
              </div>

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
              <span className="text-muted-foreground">Detection:</span>
              <Badge variant={modelLoaded ? "default" : "secondary"}>
                {modelLoaded ? "SCRFD ✓" : "Loading…"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recognition:</span>
              <Badge variant={backendReady ? "default" : "secondary"}>
                {backendReady ? "InsightFace ✓" : (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Warming up…
                  </span>
                )}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
