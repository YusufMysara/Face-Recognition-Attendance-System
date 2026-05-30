/**
 * Face landmark detector — MediaPipe FaceLandmarker (IMAGE mode).
 *
 * SCRFD detects face bounding boxes → we crop each face → pass the crop here.
 * MediaPipe finds the face in the crop and places 468 landmarks on it.
 * Landmarks come back normalised [0, 1] within the crop; we scale to video pixels.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

// 6-point EAR subsets from MediaPipe's 468-landmark mesh.
// Order: [outer-corner, upper-outer, upper-inner, inner-corner, lower-inner, lower-outer]
const LEFT_EYE_EAR  = [263, 387, 385, 362, 373, 380];
const RIGHT_EYE_EAR = [33,  160, 158, 133, 144, 153];

export interface EyeLandmarks {
  left:  { x: number; y: number }[];
  right: { x: number; y: number }[];
}

export function computeEAR(pts: { x: number; y: number }[]): number {
  const d = (a: typeof pts[0], b: typeof pts[0]) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  return (d(pts[1], pts[5]) + d(pts[2], pts[4])) / (2 * d(pts[0], pts[3]) + 1e-6);
}

export class LandmarkDetector {
  private landmarker: FaceLandmarker | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx:    CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx    = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async load(modelPath: string): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  }

  get isLoaded(): boolean { return this.landmarker !== null; }

  /** Synchronous — no await needed at the call site. */
  detect(
    video: HTMLVideoElement,
    box:   { x: number; y: number; width: number; height: number },
  ): EyeLandmarks | null {
    if (!this.landmarker) return null;

    const pad = 0.25;
    const sx  = Math.max(0, Math.round(box.x - box.width  * pad));
    const sy  = Math.max(0, Math.round(box.y - box.height * pad));
    const sw  = Math.min(video.videoWidth  - sx, Math.round(box.width  * (1 + 2 * pad)));
    const sh  = Math.min(video.videoHeight - sy, Math.round(box.height * (1 + 2 * pad)));
    if (sw < 20 || sh < 20) return null;

    // Upscale small crops so MediaPipe can detect far/small faces.
    // Landmarks come back in normalised [0,1] space so the coordinate
    // math back to video pixels is unchanged regardless of canvas size.
    const MIN_CANVAS = 128;
    const cw = Math.max(sw, MIN_CANVAS);
    const ch = Math.max(sh, MIN_CANVAS);
    this.canvas.width  = cw;
    this.canvas.height = ch;
    this.ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

    const result = this.landmarker.detect(this.canvas);
    if (!result.faceLandmarks?.length) return null;

    const all = result.faceLandmarks[0].map(lm => ({
      x: lm.x * sw + sx,
      y: lm.y * sh + sy,
    }));

    return {
      left:  LEFT_EYE_EAR.map(i => all[i]),
      right: RIGHT_EYE_EAR.map(i => all[i]),
    };
  }
}
