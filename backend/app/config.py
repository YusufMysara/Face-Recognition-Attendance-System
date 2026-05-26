import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = Field(default="Face Recognition Attendance API")
    secret_key: str = Field(alias="JWT_SECRET")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    database_url: str = Field(alias="DATABASE_URL")
    upload_dir: str = Field(default="backend/uploads", alias="UPLOAD_DIR")
    cors_allowed_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")
    # Super-admin identity — override via SUPER_ADMIN_EMAIL env var if needed
    super_admin_email: str = Field(default="admin@example.com", alias="SUPER_ADMIN_EMAIL")
    super_admin_name: str = Field(default="Super Admin", alias="SUPER_ADMIN_NAME")

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

