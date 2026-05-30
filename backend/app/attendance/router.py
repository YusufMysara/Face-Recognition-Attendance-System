import json
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.attendance import AttendanceEdit, AttendanceResponse, AttendanceStatus, RetakeRequest
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/mark")
def mark_attendance(
    session_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """
    Detect and recognise all faces in the uploaded frame using InsightFace
    (SCRFD detection + ArcFace recognition).
    """
    return AttendanceService(db).mark_full_frame(session_id, file, current_user)


@router.post("/mark-crops")
def mark_attendance_crops(
    session_id: int = Form(...),
    files: List[UploadFile] = File(...),
    keypoints: Optional[str] = Form(None),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """
    ArcFace-only recognition on pre-detected face crops from the client.
    keypoints: JSON-encoded list of 5-point landmarks per crop [[x,y]×5, ...]
               in crop-local coordinates, used for face alignment before ArcFace.
    """
    kps_list = json.loads(keypoints) if keypoints else None
    return AttendanceService(db).mark_crops(session_id, files, kps_list, current_user)


@router.post("/retake")
def retake_attendance(
    payload: RetakeRequest,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    return AttendanceService(db).retake(payload, current_user)


@router.get("/all")
def get_all_attendance(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin endpoint to get all attendance records with course information."""
    return AttendanceService(db).get_all(skip=skip, limit=limit)


@router.get("/notifications")
def get_notifications(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """Return low-attendance warnings for the logged-in student."""
    return AttendanceService(db).get_notifications(current_user)


@router.put("/edit", response_model=AttendanceResponse)
def edit_attendance(
    payload: AttendanceEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AttendanceService(db).edit(payload, current_user)


@router.post("/manual", response_model=AttendanceResponse)
def create_manual_attendance(
    session_id: int = Form(...),
    student_id: int = Form(...),
    status: AttendanceStatus = Form(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """Manually create or update an attendance record."""
    return AttendanceService(db).create_manual(
        session_id, student_id, status, current_user
    )


@router.get("/session/{session_id}", response_model=List[AttendanceResponse])
def get_session_attendance(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AttendanceService(db).get_session_attendance(session_id, current_user)


@router.get("/student/{student_id}")
def get_student_attendance(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AttendanceService(db).get_student_attendance(student_id, current_user)
