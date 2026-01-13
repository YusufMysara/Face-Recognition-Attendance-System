from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import router as auth_router
from app.attendance import router as attendance_router
from app.courses import router as courses_router
from app.database import Base, engine, SessionLocal
from app.models import User
from app.sessions import router as sessions_router
from app.users import router as admin_router
from app.utils.security import get_password_hash

Base.metadata.create_all(bind=engine)

# Run initial migration
with engine.connect() as conn:
    with open('migrations/001_initial.sql', 'r') as f:
        sql = f.read()
    conn.execute(text(sql))
    conn.commit()

# Run password_changed migration
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0"))
        conn.commit()
except Exception as e:
    if "duplicate column name" not in str(e):
        raise

# Seed admin user
db = SessionLocal()
try:
    existing = db.query(User).filter_by(email="admin@example.com").first()
    if not existing:
        admin = User(
            name="Super Admin",
            email="admin@example.com",
            role="admin",
            password_hash=get_password_hash("Admin123!"),
        )
        db.add(admin)
        db.commit()
        print("Admin created: admin@example.com / Admin123!")
    else:
        print("Admin already exists")
finally:
    db.close()

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

