from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.attendance import router as attendance_router
from app.courses import router as courses_router
from app.database import Base, engine
from app.sessions import router as sessions_router
from app.users import router as admin_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Face Recognition Attendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(courses_router)
app.include_router(sessions_router)
app.include_router(attendance_router)

