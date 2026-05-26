from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.user import PasswordResetRequest, UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return UserService(db).create_user(payload, current_user)


@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return UserService(db).list_users(skip=skip, limit=limit)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return UserService(db).update_user(user_id, payload, current_user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return UserService(db).delete_user(user_id, current_user)


@router.post("/users/photo", response_model=UserResponse)
def upload_photo(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return UserService(db).upload_photo(student_id, file)


@router.post("/students/photo", response_model=UserResponse)
def upload_student_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).upload_student_photo(file, current_user)


@router.post("/reset-password")
def reset_password(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return UserService(db).reset_password(payload, current_user)


@router.post("/change-password", response_model=UserResponse)
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UserService(db).change_password(current_password, new_password, current_user)


@router.post("/bulk-upload")
def bulk_upload_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return UserService(db).bulk_upload(file, current_user)
