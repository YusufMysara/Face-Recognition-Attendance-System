import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.attendance import router as attendance_router
from app.config import get_settings
from app.courses import router as courses_router
from app.database import Base, engine
from app.sessions import router as sessions_router
from app.users import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

settings = get_settings()


# Set to True once warmup inference completes.
_models_ready = False


def _warmup():
    """Prime every ONNX session so the first real request is fast.

    Black-dummy detection passes warm SCRFD but never call ArcFace (no face is
    detected in a black image).  We follow up with direct get_feat() calls on
    each recognition model so ArcFace is fully compiled and cache-hot too.
    """
    global _models_ready
    import numpy as np
    from app.utils.face import get_face_app, get_face_app_crops

    # ── Phase 1: warm SCRFD (detection) via full-pipeline calls ──────────────
    sizes = [(320, 320), (224, 224), (112, 112), (480, 360)]
    logger.info("Warming up InsightFace SCRFD detection models…")
    for h, w in sizes:
        dummy = np.zeros((h, w, 3), dtype=np.uint8)
        get_face_app().get(dummy)
        get_face_app_crops().get(dummy)

    # ── Phase 2: warm ArcFace recognition models directly ────────────────────
    # SCRFD finds no faces in black images → ArcFace's ONNX session was never
    # called above.  Call get_feat() directly with a 112×112 dummy to compile
    # the graph and load weights into CPU cache before the first real request.
    logger.info("Warming up ArcFace recognition models (direct get_feat calls)…")
    arcface_dummy = np.zeros((112, 112, 3), dtype=np.uint8)
    for app_instance in [get_face_app(), get_face_app_crops()]:
        for taskname, model in getattr(app_instance, "models", {}).items():
            if taskname == "detection":
                continue
            get_feat = getattr(model, "get_feat", None)
            if callable(get_feat):
                try:
                    for _ in range(3):   # 3 passes ensure full JIT path coverage
                        get_feat([arcface_dummy])
                    logger.info("  ✓ warmed ArcFace task '%s'", taskname)
                except Exception as exc:
                    logger.warning("  ArcFace warmup skipped for '%s': %s", taskname, exc)

    _models_ready = True
    logger.info("InsightFace warm-up complete — all models ready.")

    from app.utils.face import start_face_keepalive
    start_face_keepalive()
    logger.info("ONNX keepalive started (SCRFD + ArcFace heartbeat every 400 ms).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run warmup in a daemon thread so the server starts accepting requests
    # immediately — login, user management, etc. are all available right away.
    # The /ready endpoint returns false until warmup finishes, letting the
    # frontend know when the face-recognition pipeline is ready.
    import threading
    t = threading.Thread(target=_warmup, daemon=True, name="insightface-warmup")
    t.start()
    yield


app = FastAPI(title="Face Recognition Attendance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins.split(",") if settings.cors_allowed_origins else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ready")
def ready():
    """Returns whether the InsightFace models have finished warming up."""
    return {"ready": _models_ready}


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(courses_router)
app.include_router(sessions_router)
app.include_router(attendance_router)
