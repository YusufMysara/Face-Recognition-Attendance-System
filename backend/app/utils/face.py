import json
import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import HTTPException, UploadFile
from insightface.app import FaceAnalysis

from app.config import get_settings

settings = get_settings()

# ── InsightFace singleton ────────────────────────────────────────────────────
# Loaded once at startup; buffalo_s = SCRFD (detection) + ArcFace R34 (recognition).
# Tries GPU first, falls back to CPU automatically via onnxruntime providers.
_face_app: Optional[FaceAnalysis] = None


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_s",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        # det_size=(640,640) gives good accuracy for both near and far faces
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


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


# ── Public API ───────────────────────────────────────────────────────────────

def extract_face_embedding(file: UploadFile) -> tuple[str, str]:
    """
    Save the uploaded photo, detect the largest face with InsightFace,
    and return (saved_path, json_embedding_string).
    Embedding is a 512-dim ArcFace vector (L2-normalised).
    """
    upload_dir = ensure_upload_dir()
    file_path = upload_dir / file.filename
    content = file.file.read()
    with open(file_path, "wb") as buf:
        buf.write(content)

    img = _load_image_bgr(str(file_path))
    app = get_face_app()
    faces = app.get(img)

    if not faces:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="No face detected in photo")

    # Pick the largest (most prominent) face in case multiple are present
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding: np.ndarray = face.embedding  # shape (512,), L2-normalised

    return str(file_path), json.dumps(embedding.tolist())
