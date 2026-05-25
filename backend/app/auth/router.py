from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LoginResponse, Token, UserInfo
from app.utils.security import create_access_token, verify_and_update_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = UserRepository(db).get_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    valid, new_hash = verify_and_update_password(payload.password, user.password_hash)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Silently upgrade the stored hash if passlib produced a cheaper one
    # (e.g. old round-12 hashes become round-8 after the first successful login).
    if new_hash:
        user.password_hash = new_hash
        db.commit()

    token = create_access_token({"sub": user.id, "role": user.role})
    return LoginResponse(user=UserInfo.from_orm(user), token=Token(access_token=token))
