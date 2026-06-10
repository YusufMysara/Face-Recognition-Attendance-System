from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", populate_by_name=True)

    secret_key: str = Field(alias="JWT_SECRET")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    database_url: str = Field(alias="DATABASE_URL")
    upload_dir: str = Field(default="backend/uploads", alias="UPLOAD_DIR")
    cors_allowed_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")


@lru_cache
def get_settings() -> Settings:
    return Settings()

