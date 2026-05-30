import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import HTTPException, UploadFile
from insightface.app import FaceAnalysis

from app.config import get_settings

settings = get_settings()
_log = logging.getLogger(__name__)

# ── InsightFace full-pipeline singleton (SCRFD + ArcFace) ────────────────────
# Used for photo enrollment and mark_full_frame only.
_face_app: Optional[FaceAnalysis] = None


def get_face_app() -> FaceAnalysis:
    """SCRFD + ArcFace pipeline — used for enrollment and mark_full_frame."""
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_s",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


# ── Direct ArcFace ONNX session (no InsightFace, no SCRFD) ───────────────────
# Used for mark_crops — crops are pre-detected by the browser's SCRFD so we
# only need the recognition model.  Loading it via onnxruntime directly avoids
# InsightFace's FaceAnalysis assertion that requires a detection model.
_rec_session: Optional[ort.InferenceSession] = None

# Standard 5-point landmark targets for ArcFace 112×112 alignment.
_ARCFACE_DST = np.array([
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
], dtype=np.float32)


def get_rec_session() -> ort.InferenceSession:
    """Return the ArcFace ONNX session, loading it from disk on first call."""
    global _rec_session
    if _rec_session is None:
        model_path = (
            Path.home() / ".insightface" / "models" / "buffalo_s" / "w600k_mbf.onnx"
        )
        if not model_path.exists():
            raise FileNotFoundError(
                f"ArcFace model not found at {model_path}. "
                "Run the server once with InsightFace to download it."
            )
        _rec_session = ort.InferenceSession(
            str(model_path),
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _log.info("ArcFace ONNX session loaded: %s", model_path.name)
    return _rec_session


def _align_crop(img: np.ndarray, kps: np.ndarray, size: int = 112) -> np.ndarray:
    """Affine-warp img so that kps align to the ArcFace standard 5-point template."""
    from skimage import transform as trans
    tform = trans.SimilarityTransform()
    tform.estimate(kps, _ARCFACE_DST)
    M = tform.params[:2, :]
    return cv2.warpAffine(img, M, (size, size), borderValue=0.0)


def embedding_from_crop(
    img: np.ndarray,
    kps: Optional[list] = None,
) -> Optional[np.ndarray]:
    """Extract a 512-dim ArcFace embedding directly from a face crop.

    kps: 5-point landmarks [[x,y]×5] in crop-local coordinates sent by the
         browser alongside each JPEG crop.  Used to align the face to the same
         112×112 pose used during enrollment so the embeddings are comparable.
         Falls back to a plain center-resize when kps is None (less accurate).
    """
    try:
        if kps is not None:
            aligned = _align_crop(img, np.array(kps, dtype=np.float32))
        else:
            aligned = cv2.resize(img, (112, 112))

        # Preprocess: BGR→RGB, normalize to [-1, 1], NCHW float32
        blob = aligned[:, :, ::-1].astype(np.float32)
        blob = (blob - 127.5) / 127.5
        blob = blob.transpose(2, 0, 1)[np.newaxis, :]  # (1, 3, 112, 112)

        session = get_rec_session()
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: blob})
        return outputs[0][0].astype(np.float32)
    except Exception as exc:
        _log.warning("ArcFace inference failed: %s", exc)
        return None


# ── ONNX keepalive ────────────────────────────────────────────────────────────
_keepalive_thread: Optional[threading.Thread] = None


def start_face_keepalive() -> None:
    """Keep both ONNX thread pools warm to avoid cold-start latency on Windows."""
    global _keepalive_thread
    if _keepalive_thread is not None:
        return

    _scrfd_dummy = np.zeros((64, 64, 3), dtype=np.uint8)

    def _heartbeat() -> None:
        session    = get_rec_session()  # already loaded by warmup
        input_name = session.get_inputs()[0].name
        dummy_blob = np.zeros((1, 3, 112, 112), dtype=np.float32)

        while True:
            time.sleep(0.4)
            try:
                # Keep SCRFD warm (used for enrollment + mark_full_frame)
                get_face_app().get(_scrfd_dummy, max_num=1)
            except Exception:
                pass
            try:
                # Keep ArcFace ONNX session warm (used for mark_crops)
                session.run(None, {input_name: dummy_blob})
            except Exception:
                pass

    _keepalive_thread = threading.Thread(
        target=_heartbeat, daemon=True, name="onnx-keepalive"
    )
    _keepalive_thread.start()


# ── Helpers ──────────────────────────────────────────────────────────────────

def ensure_upload_dir() -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _load_image_bgr(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not read image file")
    return img


def bytes_to_bgr(data: bytes) -> np.ndarray:
    """Decode raw bytes (JPEG/PNG) into a BGR numpy array for InsightFace."""
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return img


def extract_face_embedding(file: UploadFile) -> tuple[str, str]:
    """
    Save the uploaded photo, detect the largest face, return (path, embedding_json).
    Embedding is a 512-dim ArcFace vector (L2-normalised).
    """
    upload_dir = ensure_upload_dir()

    _ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    raw_suffix = Path(file.filename or "").suffix.lower()
    suffix = raw_suffix if raw_suffix in _ALLOWED_EXTS else ".jpg"
    file_path = upload_dir / f"{uuid.uuid4().hex}{suffix}"

    content = file.file.read()
    with open(file_path, "wb") as buf:
        buf.write(content)

    img = _load_image_bgr(str(file_path))
    app = get_face_app()
    faces = app.get(img)

    if not faces:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="No face detected in photo")

    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding: np.ndarray = face.embedding

    return str(file_path), json.dumps(embedding.tolist())
