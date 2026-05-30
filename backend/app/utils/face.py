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
from fastapi import HTTPException, UploadFile
from insightface.app import FaceAnalysis

from app.config import get_settings

settings = get_settings()
_log = logging.getLogger(__name__)

# ── InsightFace singletons ───────────────────────────────────────────────────
_face_app: Optional[FaceAnalysis] = None
_arcface_app: Optional[FaceAnalysis] = None  # recognition-only, no SCRFD
_rec_model = None


def get_face_app() -> FaceAnalysis:
    """Full pipeline (SCRFD + ArcFace) — used for enrollment and mark_full_frame."""
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_s",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def get_arcface_app() -> FaceAnalysis:
    """ArcFace-only instance — no SCRFD loaded, used for mark_crops."""
    global _arcface_app
    if _arcface_app is None:
        _arcface_app = FaceAnalysis(
            name="buffalo_s",
            allowed_modules=["recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _arcface_app.prepare(ctx_id=0, det_size=(112, 112))
    return _arcface_app


def get_rec_model():
    """Return the ArcFace recognition model from the recognition-only app.

    Resolved once and cached for the process lifetime. Used by
    embedding_from_crop() — no SCRFD involved.
    """
    global _rec_model
    if _rec_model is None:
        app = get_arcface_app()
        for taskname, model in getattr(app, "models", {}).items():
            if callable(getattr(model, "get_feat", None)):
                _rec_model = model
                _log.info("ArcFace model resolved from task '%s'", taskname)
                break
        if _rec_model is None:
            raise RuntimeError("ArcFace recognition model not found")
    return _rec_model


def embedding_from_crop(
    img: np.ndarray,
    kps: Optional[list] = None,
) -> Optional[np.ndarray]:
    """Extract a 512-dim ArcFace embedding from a face crop.

    kps: 5-point landmarks [[x,y]×5] in crop-local coordinates, as detected
         by the browser's SCRFD.  Used to align the face before ArcFace so
         the embedding matches the aligned embeddings stored at enrollment.
         Falls back to a plain 112×112 resize when kps is None (less accurate).
    """
    try:
        if kps is not None:
            from insightface.utils import face_align
            kps_array = np.array(kps, dtype=np.float32)   # (5, 2)
            aligned = face_align.norm_crop(img, kps_array)
        else:
            aligned = cv2.resize(img, (112, 112))
        feats = get_rec_model().get_feat([aligned])
        return feats[0].astype(np.float32)
    except Exception as exc:
        _log.warning("Direct ArcFace inference failed: %s", exc)
        return None


# ── ONNX keepalive ────────────────────────────────────────────────────────────
_keepalive_thread: Optional[threading.Thread] = None


def start_face_keepalive() -> None:
    """Keep ONNX thread pool warm to avoid 7-second re-wake penalty on Windows."""
    global _keepalive_thread
    if _keepalive_thread is not None:
        return

    _scrfd_dummy   = np.zeros((64, 64, 3),   dtype=np.uint8)
    _arcface_dummy = np.zeros((112, 112, 3), dtype=np.uint8)

    def _heartbeat() -> None:
        rec_model = get_rec_model()  # already resolved and cached by warmup
        while True:
            time.sleep(0.4)
            try:
                # Keep full-pipeline SCRFD warm (used for enrollment + mark_full_frame)
                get_face_app().get(_scrfd_dummy, max_num=1)
            except Exception:
                pass
            try:
                # Keep ArcFace-only model warm (used for mark_crops)
                rec_model.get_feat([_arcface_dummy])
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
