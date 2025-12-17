import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = Field(default="Face Recognition Attendance API")
    secret_key: str = Field(default=os.environ.get("JWT_SECRET", "super-secret"))
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    database_url: str = Field(
        default=os.environ.get(
            "DATABASE_URL", "sqlite:///./face_recognition_attendance.db"
        )
    )
    upload_dir: str = Field(default=os.environ.get("UPLOAD_DIR", "backend/uploads"))

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

