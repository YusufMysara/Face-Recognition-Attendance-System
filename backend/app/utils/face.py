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
_face_app_crops: Optional[FaceAnalysis] = None


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_s",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def get_face_app_crops() -> FaceAnalysis:
    """Lighter InsightFace instance for recognising pre-cropped face images."""
    global _face_app_crops
    if _face_app_crops is None:
        _face_app_crops = FaceAnalysis(
            name="buffalo_s",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        _face_app_crops.prepare(ctx_id=0, det_size=(320, 320))
    return _face_app_crops


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
        rec_model = None
        app = get_face_app_crops()
        for taskname, model in getattr(app, "models", {}).items():
            if taskname != "detection" and callable(getattr(model, "get_feat", None)):
                rec_model = model
                _log.info("Keepalive: found ArcFace model under task '%s'", taskname)
                break

        while True:
            time.sleep(0.4)
            try:
                get_face_app_crops().get(_scrfd_dummy, max_num=1)
            except Exception:
                pass
            if rec_model is not None:
                try:
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
