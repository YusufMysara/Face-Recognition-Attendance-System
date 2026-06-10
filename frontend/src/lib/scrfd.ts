/**
 * SCRFD-500M face detector running in the browser via ONNX Runtime Web.
 *
 * Model:  det_500m.onnx  (buffalo_s detection model from InsightFace)
 * Input:  float32[1, 3, 640, 640]  normalised as (x - 127.5) / 128
 * Outputs (inspected via Python onnxruntime):
 *   scores: '443' [12800,1]  '468' [3200,1]  '493' [800,1]   (strides 8, 16, 32)
 *   bboxes: '446' [12800,4]  '471' [3200,4]  '496' [800,4]
 * Box format: distance2bbox — each bbox row is [dl, dt, dr, db] meaning
 *   x1 = anchor_cx - dl*stride,  y1 = anchor_cy - dt*stride
 *   x2 = anchor_cx + dr*stride,  y2 = anchor_cy + db*stride
 */

import * as ort from 'onnxruntime-web';

// ── Constants ─────────────────────────────────────────────────────────────────
const INPUT_SIZE     = 640;
const STRIDES        = [8, 16, 32] as const;
const NUM_ANCHORS    = 2;
const SCORE_NAMES    = ['443', '468', '493'] as const;
const BBOX_NAMES     = ['446', '471', '496'] as const;
const KPS_NAMES      = ['449', '474', '499'] as const;
const SCORE_THRESH   = 0.30;  // lowered from 0.45 — catches far/small faces
const NMS_THRESH     = 0.4;

// ── Public types ──────────────────────────────────────────────────────────────
export interface ScrfdDetection {
  /** Bounding box in original video pixel space. */
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** 5 facial keypoints in video pixels: [leftEye, rightEye, nose, leftMouth, rightMouth]. */
  kps: { x: number; y: number }[];
}

// ── Detector class ────────────────────────────────────────────────────────────
export class SCRFDDetector {
  private session: ort.InferenceSession | null = null;
  /** Reused canvas to avoid allocating one per frame. */
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas     = document.createElement('canvas');
    this.canvas.width  = INPUT_SIZE;
    this.canvas.height = INPUT_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async load(modelUrl: string): Promise<void> {
    // Serve WASM binaries from /public/ort-wasm/ (no CDN download needed).
    ort.env.wasm.wasmPaths = '/ort-wasm/';

    this.session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  get isLoaded(): boolean {
    return this.session !== null;
  }

  async detect(video: HTMLVideoElement): Promise<ScrfdDetection[]> {
    if (!this.session) return [];

    const origW = video.videoWidth;
    const origH = video.videoHeight;
    if (!origW || !origH) return [];

    // ── Preprocess ────────────────────────────────────────────────────────────
    this.ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const { data } = this.ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

    const pixels    = INPUT_SIZE * INPUT_SIZE;
    const inputData = new Float32Array(3 * pixels);
    for (let i = 0; i < pixels; i++) {
      inputData[i]           = (data[i * 4]     - 127.5) / 128.0; // R
      inputData[pixels + i]  = (data[i * 4 + 1] - 127.5) / 128.0; // G
      inputData[pixels*2+i]  = (data[i * 4 + 2] - 127.5) / 128.0; // B
    }

    const tensor  = new ort.Tensor('float32', inputData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await this.session.run({ 'input.1': tensor });

    // ── Post-process ──────────────────────────────────────────────────────────
    const scaleX    = origW / INPUT_SIZE;
    const scaleY    = origH / INPUT_SIZE;
    const candidates: ScrfdDetection[] = [];

    for (let si = 0; si < STRIDES.length; si++) {
      const stride = STRIDES[si];
      const featH  = INPUT_SIZE / stride;
      const featW  = INPUT_SIZE / stride;

      const scores = outputs[SCORE_NAMES[si]].data as Float32Array;
      const bboxes = outputs[BBOX_NAMES[si]].data  as Float32Array;
      const kpss   = outputs[KPS_NAMES[si]].data   as Float32Array;

      for (let row = 0; row < featH; row++) {
        for (let col = 0; col < featW; col++) {
          for (let an = 0; an < NUM_ANCHORS; an++) {
            const idx   = (row * featW + col) * NUM_ANCHORS + an;
            const score = scores[idx];
            if (score < SCORE_THRESH) continue;

            const cx = col * stride;
            const cy = row * stride;
            const bi = idx * 4;

            // distance2bbox decoding
            const x1 = (cx - bboxes[bi]     * stride) * scaleX;
            const y1 = (cy - bboxes[bi + 1] * stride) * scaleY;
            const x2 = (cx + bboxes[bi + 2] * stride) * scaleX;
            const y2 = (cy + bboxes[bi + 3] * stride) * scaleY;

            // keypoint decoding: anchor_center + offset * stride
            const ki = idx * 10;
            const kps: { x: number; y: number }[] = [];
            for (let k = 0; k < 5; k++) {
              kps.push({
                x: (cx + kpss[ki + k * 2]     * stride) * scaleX,
                y: (cy + kpss[ki + k * 2 + 1] * stride) * scaleY,
              });
            }

            candidates.push({
              box: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
              score,
              kps,
            });
          }
        }
      }
    }

    return nms(candidates, NMS_THRESH);
  }
}

// ── NMS ───────────────────────────────────────────────────────────────────────

function iou(a: ScrfdDetection, b: ScrfdDetection): number {
  const ax2 = a.box.x + a.box.width,  ay2 = a.box.y + a.box.height;
  const bx2 = b.box.x + b.box.width,  by2 = b.box.y + b.box.height;
  const ix1 = Math.max(a.box.x, b.box.x), iy1 = Math.max(a.box.y, b.box.y);
  const ix2 = Math.min(ax2, bx2),         iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const aArea = a.box.width * a.box.height;
  const bArea = b.box.width * b.box.height;
  return inter / (aArea + bArea - inter + 1e-6);
}

function nms(dets: ScrfdDetection[], threshold: number): ScrfdDetection[] {
  dets.sort((a, b) => b.score - a.score);
  const suppressed = new Uint8Array(dets.length);
  const keep: ScrfdDetection[] = [];

  for (let i = 0; i < dets.length; i++) {
    if (suppressed[i]) continue;
    keep.push(dets[i]);
    for (let j = i + 1; j < dets.length; j++) {
      if (!suppressed[j] && iou(dets[i], dets[j]) > threshold) suppressed[j] = 1;
    }
  }
  return keep;
}
