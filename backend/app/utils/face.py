import json
import logging
import os
import threading
import time
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
# Two instances:
#   _face_app       – full-frame pipeline, det_size=(640,640)
#                     used for photo upload / embedding extraction.
#   _face_app_crops – crops pipeline, det_size=(320,320)
#                     used for /mark-crops: input images are already tight
#                     face crops (~150-300 px), so a smaller det tensor is
#                     sufficient and roughly 4× faster than 640×640.
_face_app: Optional[FaceAnalysis] = None
_face_app_crops: Optional[FaceAnalysis] = None


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_s",
            # Load only what we need: detection (SCRFD) + recognition (ArcFace).
            # Skipping landmark_3d_68, landmark_2d_106, and genderage cuts the
            # per-face model pipeline from 5 models to 2, eliminating ~3 cold-start
            # penalties and roughly halving inference time per detected face.
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
        # 320×320 is plenty for face crops; 4× fewer pixels → ~2–3× faster
        _face_app_crops.prepare(ctx_id=0, det_size=(320, 320))
    return _face_app_crops


# ── ONNX keepalive ────────────────────────────────────────────────────────────
# On Windows, ONNX Runtime's OpenMP thread pool parks idle threads after a
# very short timeout (can be < 10 ms).  Re-waking parked threads costs ~7 s
# for the crops pipeline, turning every second crop in the same request into a
# cold-start.  A background heartbeat inference every 400 ms prevents parking.

_keepalive_thread: Optional[threading.Thread] = None


def start_face_keepalive() -> None:
    """Start (once) the background thread that keeps ONNX threads warm.

    Previous black-dummy approach: SCRFD runs (~30 ms) but ArcFace is never
    called (no faces in a black image) → ArcFace weights stay cold → every
    real request pays ~870 ms to reload ArcFace into CPU cache.

    This version calls SCRFD via the full pipeline (black dummy, ~30 ms) AND
    calls ArcFace's get_feat() directly with a 112×112 dummy (~30 ms).
    Both models stay cache-hot.  Total duty cycle: ~60 ms / 400 ms = 15%.
    """
    global _keepalive_thread
    if _keepalive_thread is not None:
        return

    _scrfd_dummy   = np.zeros((64, 64, 3),   dtype=np.uint8)
    _arcface_dummy = np.zeros((112, 112, 3), dtype=np.uint8)

    def _heartbeat() -> None:
        # Grab a reference to the recognition model once the crops pipeline
        # is initialised (it should already be ready after warmup).
        rec_model = None
        app = get_face_app_crops()
        for taskname, model in getattr(app, "models", {}).items():
            if taskname != "detection" and callable(getattr(model, "get_feat", None)):
                rec_model = model
                _log.info("Keepalive: found ArcFace model under task '%s'", taskname)
                break

        while True:
            time.sleep(0.4)  # 400 ms — well below the thread-park threshold
            # Keep SCRFD warm
            try:
                get_face_app_crops().get(_scrfd_dummy, max_num=1)
            except Exception:
                pass
            # Keep ArcFace warm (direct call avoids running SCRFD a second time)
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
