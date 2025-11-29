import json
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database import get_db
from app.models import (
    Attendance,
    Course,
    Session as SessionModel,
    StudentCourse,
    User,
)
from app.schemas.user import (
    PasswordResetRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.utils.face import extract_face_embedding
from app.utils.security import get_password_hash

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        group=payload.group,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return db.query(User).all()


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.name:
        user.name = payload.name
    if payload.email:
        if (
            db.query(User)
            .filter(User.email == payload.email, User.id != user_id)
            .first()
        ):
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email
    if payload.group is not None:
        user.group = payload.group
    if payload.role:
        user.role = payload.role
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "student":
        (
            db.query(Attendance)
            .filter(Attendance.student_id == user_id)
            .delete(synchronize_session=False)
        )
        (
            db.query(StudentCourse)
            .filter(StudentCourse.student_id == user_id)
            .delete(synchronize_session=False)
        )
    elif user.role == "teacher":
        session_ids_subq = (
            db.query(SessionModel.id).filter(SessionModel.teacher_id == user_id)
        ).subquery()
        if session_ids_subq is not None:
            (
                db.query(Attendance)
                .filter(Attendance.session_id.in_(session_ids_subq))
                .delete(synchronize_session=False)
            )
        (
            db.query(SessionModel)
            .filter(SessionModel.teacher_id == user_id)
            .delete(synchronize_session=False)
        )
        (
            db.query(Course)
            .filter(Course.teacher_id == user_id)
            .update({Course.teacher_id: None}, synchronize_session=False)
        )

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@router.post("/users/photo", response_model=UserResponse)
def upload_photo(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    photo_path, embedding = extract_face_embedding(file)
    student.photo_path = photo_path
    student.face_embedding = embedding
    db.commit()
    db.refresh(student)
    return student


@router.post("/reset-password")
def reset_password(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": "Password reset"}

