/**
 * Dual-mode face liveness tracker.
 *
 * Close faces (≥ MIN_LIVENESS_PX in LiveCamera):
 *   EAR-based blink detection via MediaPipe landmarks.
 *   Threshold is adaptive: baseline × BLINK_RATIO, calibrated per person.
 *
 * Far faces (< MIN_LIVENESS_PX):
 *   Motion-based detection via frame-to-frame luminance difference (MAD).
 *   Real faces have micro-movements from breathing and natural sway.
 *   Static photos are pixel-perfect still — MAD stays near zero.
 *
 * States
 *   "checking" — accumulating baseline or waiting for liveness signal
 *   "live"     — blink or motion confirmed → send to backend
 *   "spoof"    — full window elapsed with no liveness signal → reject
 */

// ── EAR (close face) constants ────────────────────────────────────────────────
/** Frames to build the open-eye EAR baseline before blink checking starts. */
const BASELINE_FRAMES  = 15;
/** Threshold = open-eye baseline × this ratio (universal across people). */
const BLINK_RATIO      = 0.85;
/** Frames before an EAR-mode spoof verdict. */
const EAR_HISTORY_SIZE = 60;
/** Minimum consecutive frames with EAR below threshold to count as a blink. */
const BLINK_MIN_FRAMES = 1;
/** A blink can't last longer than this (hand/shadow over face). */
const BLINK_MAX_FRAMES = 8;

// ── Motion (far face) constants ───────────────────────────────────────────────
/** Mean absolute luminance difference (0–255) between frames to count as motion. */
const MOTION_THRESH    = 8.0;
/** Frames before a motion-mode spoof verdict. */
const MOTION_SAMPLES   = 25;
/** Minimum samples before evaluating the motion verdict (guards against jitter spikes). */
const MOTION_MIN_EVAL  = 5;

// ── Shared constants ──────────────────────────────────────────────────────────
const MATCH_DIST    = 100;
const GRACE_FRAMES  = 3;

export type LivenessState = "checking" | "live" | "spoof";

export interface EarSample {
  left:  number;
  right: number;
}

interface FaceTrack {
  cx: number;
  cy: number;
  /** EAR history for close-face mode. */
  earHistory:      EarSample[];
  blinkDetected:   boolean;
  /** Pixel buffer from the previous frame — used to compute MAD for far faces. */
  prevPixels:      Uint8ClampedArray | null;
  /** Per-frame MAD history for far-face motion mode. */
  motionHistory:   number[];
  motionDetected:  boolean;
  missed:          number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

/** Mean absolute luminance difference between two same-size RGBA pixel arrays. */
function computeMAD(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    const lb = b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
    sum += Math.abs(la - lb);
  }
  return sum / n;
}

function hasBlink(earHistory: EarSample[]): boolean {
  if (earHistory.length < BASELINE_FRAMES + BLINK_MIN_FRAMES) return false;
  const baseline = earHistory.slice(0, BASELINE_FRAMES);
  const threshL  = median(baseline.map(s => s.left))  * BLINK_RATIO;
  const threshR  = median(baseline.map(s => s.right)) * BLINK_RATIO;
  let run = 0;
  for (const s of earHistory.slice(BASELINE_FRAMES)) {
    const closed = s.left < threshL || s.right < threshR;
    if (closed) {
      run++;
    } else {
      if (run >= BLINK_MIN_FRAMES && run <= BLINK_MAX_FRAMES) return true;
      run = 0;
    }
  }
  return run >= BLINK_MIN_FRAMES && run <= BLINK_MAX_FRAMES;
}

// ── Tracker ───────────────────────────────────────────────────────────────────

export class BlinkLivenessTracker {
  private tracks: FaceTrack[] = [];

  /**
   * Call once per SCRFD frame.
   * @param detections  Current bounding boxes.
   * @param earSamples  EAR values for close faces (null for far faces).
   * @param facePixels  32×32 RGBA pixel data for far faces (null for close faces).
   */
  update(
    detections:  ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
    earSamples?: ReadonlyArray<EarSample | null>,
    facePixels?: ReadonlyArray<Uint8ClampedArray | null>,
  ): void {
    const used = new Set<FaceTrack>();

    for (let di = 0; di < detections.length; di++) {
      const det = detections[di];
      const cx  = det.x + det.width  / 2;
      const cy  = det.y + det.height / 2;
      // Far faces have more SCRFD jitter — scale the match window with face size
      // so the same face isn't fragmented into multiple tracks.
      const matchDist = Math.max(MATCH_DIST, Math.max(det.width, det.height) * 1.5);

      let best: FaceTrack | null = null;
      let bestDist = matchDist;
      for (const t of this.tracks) {
        if (used.has(t)) continue;
        const d = Math.hypot(cx - t.cx, cy - t.cy);
        if (d < bestDist) { bestDist = d; best = t; }
      }

      if (!best) {
        best = {
          cx, cy,
          earHistory: [], blinkDetected: false,
          prevPixels: null, motionHistory: [], motionDetected: false,
          missed: 0,
        };
        this.tracks.push(best);
      }

      used.add(best);
      best.cx     = cx;
      best.cy     = cy;
      best.missed = 0;

      // ── EAR path (close face) ─────────────────────────────────────────────
      const ear = earSamples?.[di] ?? null;
      if (ear) {
        best.earHistory.push(ear);
        if (best.earHistory.length > EAR_HISTORY_SIZE) best.earHistory.shift();
        if (!best.blinkDetected) {
          best.blinkDetected = hasBlink(best.earHistory);
          if (best.blinkDetected) {
            console.log(
              `%c[liveness] ✓ BLINK → LIVE  L=${ear.left.toFixed(3)} R=${ear.right.toFixed(3)}  frames=${best.earHistory.length}`,
              'color:#22c55e; font-weight:bold',
            );
          }
        }
        if (best.earHistory.length % 15 === 0) {
          const h     = best.earHistory;
          const bl    = h.slice(0, Math.min(BASELINE_FRAMES, h.length));
          const baseL = median(bl.map(s => s.left));
          const baseR = median(bl.map(s => s.right));
          const post  = h.slice(BASELINE_FRAMES);
          const minL  = post.length ? Math.min(...post.map(s => s.left))  : baseL;
          const minR  = post.length ? Math.min(...post.map(s => s.right)) : baseR;
          console.log(
            `[liveness] EAR frames=${h.length}` +
            `  base L=${baseL.toFixed(3)} R=${baseR.toFixed(3)}` +
            `  thresh L=${(baseL * BLINK_RATIO).toFixed(3)} R=${(baseR * BLINK_RATIO).toFixed(3)}` +
            `  minPost L=${minL.toFixed(3)} R=${minR.toFixed(3)}`,
          );
        }
      }

      // ── Motion path (far face) ────────────────────────────────────────────
      const pixels = facePixels?.[di] ?? null;
      if (pixels) {
        if (best.prevPixels) {
          const mad = computeMAD(pixels, best.prevPixels);
          best.motionHistory.push(mad);
          if (!best.motionDetected && best.motionHistory.length >= MOTION_MIN_EVAL) {
            const medMAD = median(best.motionHistory.slice(-MOTION_MIN_EVAL));
            if (medMAD > MOTION_THRESH) {
              best.motionDetected = true;
              console.log(
                `%c[liveness] ✓ MOTION → LIVE  medMAD=${medMAD.toFixed(2)}  samples=${best.motionHistory.length}`,
                'color:#22c55e; font-weight:bold',
              );
            }
          }
          if (best.motionHistory.length % 10 === 0) {
            const maxMAD = Math.max(...best.motionHistory);
            console.log(
              `[liveness] MOTION frames=${best.motionHistory.length}` +
              `  maxMAD=${maxMAD.toFixed(2)}  thresh=${MOTION_THRESH}`,
            );
          }
        }
        best.prevPixels = pixels;
      }
    }

    for (const t of this.tracks) {
      if (!used.has(t)) t.missed++;
    }
    this.tracks = this.tracks.filter(t => used.has(t) || t.missed <= GRACE_FRAMES);
  }

  getState(det: { x: number; y: number; width: number; height: number }): LivenessState {
    const cx = det.x + det.width  / 2;
    const cy = det.y + det.height / 2;
    const matchDist = Math.max(MATCH_DIST, Math.max(det.width, det.height) * 1.5);

    const candidates = this.tracks.filter(
      t => Math.hypot(cx - t.cx, cy - t.cy) < matchDist,
    );
    if (!candidates.length) return "checking";

    // If ANY nearby track is live, the face is live — a brief new track
    // in "checking" state must not override an existing confirmed track.
    if (candidates.some(t => t.blinkDetected || t.motionDetected)) return "live";
    if (candidates.some(t =>
      t.earHistory.length    >= EAR_HISTORY_SIZE ||
      t.motionHistory.length >= MOTION_SAMPLES,
    )) return "spoof";
    return "checking";
  }

  reset(): void { this.tracks = []; }
}
