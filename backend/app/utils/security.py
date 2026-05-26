from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import re

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException

from app.config import get_settings

# rounds=8 → ~25 ms per hash (default 12 → ~350 ms).
# Existing hashes store their own cost factor inside the hash string, so
# already-stored passwords still verify correctly — only new passwords use 8.
# Stale hashes are transparently re-hashed to 8 rounds on next successful login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=8)
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def verify_and_update_password(plain_password: str, hashed_password: str):
    """Verify a password and return (is_valid, new_hash_or_None).

    If the stored hash was produced with an older / more expensive cost factor,
    passlib returns a freshly-computed hash using the current rounds (8).
    The caller should persist new_hash when it is not None.
    """
    return pwd_context.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def validate_password_strength(password: str) -> None:
    """
    Validate password strength requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    if not re.search(r'[A-Z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")

    if not re.search(r'[a-z]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")

    if not re.search(r'\d', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit")

    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

