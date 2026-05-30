import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.auth import router as auth_router
from app.attendance import router as attendance_router
from app.config import get_settings
from app.courses import router as courses_router
from app.database import Base, engine
from app.limiter import limiter
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
    import time
    import numpy as np
    from app.utils.face import embedding_from_crop, get_face_app, get_rec_session

    # ── Phase 1: warm SCRFD (used for enrollment + mark_full_frame) ──────────
    sizes = [(320, 320), (224, 224), (112, 112), (480, 360)]
    logger.info("Warming up SCRFD detection model…")
    for h, w in sizes:
        dummy = np.zeros((h, w, 3), dtype=np.uint8)
        get_face_app().get(dummy)

    # ── Phase 2: warm ArcFace ONNX session (used for mark_crops) ─────────────
    # SCRFD finds no faces in black images so the ArcFace model inside
    # get_face_app() was never triggered above.  Warm it via direct get_feat()
    # calls.  Also load and warm the standalone ArcFace session used by
    # embedding_from_crop() so the first live request has no cold-start delay.
    logger.info("Warming up ArcFace recognition models…")
    arcface_dummy_insight = np.zeros((112, 112, 3), dtype=np.uint8)
    for taskname, model in getattr(get_face_app(), "models", {}).items():
        if taskname == "detection":
            continue
        get_feat = getattr(model, "get_feat", None)
        if callable(get_feat):
            try:
                for _ in range(3):
                    get_feat([arcface_dummy_insight])
                logger.info("  ✓ warmed InsightFace ArcFace task '%s'", taskname)
            except Exception as exc:
                logger.warning("  InsightFace ArcFace warmup skipped: %s", exc)

    # Load the ArcFace ONNX session and run enough passes to fully initialise
    # the Windows ONNX Runtime thread pool.  3 back-to-back passes are not
    # enough — the pool initialises lazily and the first real inference still
    # blocks for ~7-15 s.  Running batches with short pauses forces the pool
    # to fully wake up before any user request arrives.
    # Warm the full embedding_from_crop() pipeline — alignment + ONNX inference.
    # Calling session.run() directly in previous attempts skipped the skimage
    # import inside _align_crop(), causing a 5-10 s first-request freeze on
    # Windows when scipy/skimage initialised lazily.  Using the real function
    # with realistic keypoints exercises every code path the live requests use.
    dummy_img = np.zeros((112, 112, 3), dtype=np.uint8)
    dummy_kps = [          # sensible 5-point face layout for a non-trivial warp
        [38.0, 52.0],
        [74.0, 52.0],
        [56.0, 72.0],
        [44.0, 90.0],
        [68.0, 90.0],
    ]
    for _ in range(5):
        embedding_from_crop(dummy_img, dummy_kps)

    # Verify the model produces a valid 512-dim output before unlocking the UI.
    test_result = embedding_from_crop(dummy_img, dummy_kps)
    if test_result is None or test_result.shape != (512,):
        logger.error("ArcFace self-test FAILED — recognition will not work")
    else:
        logger.info("  ✓ ArcFace self-test passed (512-dim embedding confirmed)")

    # Start keepalive BEFORE marking ready so it is already pumping by the
    # time the frontend unlocks and the first recognition request arrives.
    from app.utils.face import start_face_keepalive
    start_face_keepalive()
    logger.info("ONNX keepalive started.")

    _models_ready = True
    logger.info("InsightFace warm-up complete — all models ready.")


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

# Rate-limiting state and 429 handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
