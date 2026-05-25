from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.course import (
    CourseAssignment,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    TeacherAssignment,
)
from app.services.course_service import CourseService

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("", response_model=CourseResponse)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).create_course(payload)


@router.get("", response_model=List[CourseResponse])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CourseService(db).list_courses(current_user)


@router.post("/assign-student")
def assign_student(
    payload: CourseAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).assign_student(payload)


@router.post("/remove-student")
def remove_student(
    payload: CourseAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).remove_student(payload)


@router.post("/assign-teacher")
def assign_teacher(
    payload: TeacherAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).assign_teacher(payload)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CourseService(db).get_course(course_id, current_user)


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).update_course(course_id, payload)


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return CourseService(db).delete_course(course_id)


@router.get("/{course_id}/students")
def get_course_students(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CourseService(db).get_students(course_id, current_user)
