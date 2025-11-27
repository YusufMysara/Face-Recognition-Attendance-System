import json
from collections import defaultdict
from typing import Dict, List, Optional

import face_recognition
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Attendance as AttendanceModel
from app.models import Course, Session as SessionModel, StudentCourse, User
from app.schemas.attendance import AttendanceEdit, AttendanceResponse, RetakeRequest

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _get_session(session_id: int, db: Session) -> SessionModel:
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _ensure_teacher_session(session: SessionModel, teacher_id: int):
    if session.teacher_id != teacher_id:
        raise HTTPException(status_code=403, detail="Not your session")


def _to_response(record: AttendanceModel, student_name: Optional[str]) -> AttendanceResponse:
    return AttendanceResponse(
        id=record.id,
        session_id=record.session_id,
        student_id=record.student_id,
        status=record.status,
        timestamp=record.timestamp,
        student_name=student_name,
    )


@router.post("/mark", response_model=Dict[str, List[AttendanceResponse]])
def mark_attendance(
    session_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    session = _get_session(session_id, db)
    if session.status == "submitted":
        raise HTTPException(status_code=400, detail="Session already submitted")
    _ensure_teacher_session(session, current_user.id)

    course = db.query(Course).filter(Course.id == session.course_id).first()
    students = (
        db.query(User)
        .join(StudentCourse, StudentCourse.student_id == User.id)
        .filter(StudentCourse.course_id == course.id)
        .all()
    )
    known_embeddings = []
    student_map = []
    for student in students:
        if student.face_embedding:
            known_embeddings.append(json.loads(student.face_embedding))
            student_map.append(student)

    if not known_embeddings:
        raise HTTPException(status_code=400, detail="No embeddings registered")

    file.file.seek(0)
    image = face_recognition.load_image_file(file.file)
    frame_encodings = face_recognition.face_encodings(image)
    if not frame_encodings:
        raise HTTPException(status_code=400, detail="No faces detected")

    responses: List[AttendanceResponse] = []
    for frame_encoding in frame_encodings:
        matches = face_recognition.compare_faces(
            known_embeddings, frame_encoding, tolerance=0.5
        )
        matched_indexes = [idx for idx, matched in enumerate(matches) if matched]
        for idx in matched_indexes:
            student = student_map[idx]
            record = (
                db.query(AttendanceModel)
                .filter(
                    AttendanceModel.session_id == session_id,
                    AttendanceModel.student_id == student.id,
                )
                .first()
            )
            if record:
                record.status = "present"
            else:
                record = AttendanceModel(
                    session_id=session_id,
                    student_id=student.id,
                    status="present",
                )
                db.add(record)
            db.commit()
            responses.append(_to_response(record, student.name))
    return {"attendance": responses}


@router.post("/retake")
def retake_attendance(
    payload: RetakeRequest,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    session = _get_session(payload.session_id, db)
    _ensure_teacher_session(session, current_user.id)
    if session.status == "submitted":
        raise HTTPException(status_code=400, detail="Cannot retake submitted session")
    db.query(AttendanceModel).filter(AttendanceModel.session_id == payload.session_id).delete()
    session.status = "open"
    db.commit()
    return {"detail": "Attendance cleared for retake"}


@router.get("/session/{session_id}", response_model=List[AttendanceResponse])
def get_session_attendance(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_session(session_id, db)
    if current_user.role == "teacher":
        _ensure_teacher_session(session, current_user.id)
    elif current_user.role == "student":
        enrollment = (
            db.query(StudentCourse)
            .filter(
                StudentCourse.course_id == session.course_id,
                StudentCourse.student_id == current_user.id,
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled")
    records = (
        db.query(AttendanceModel, User.name)
        .join(User, AttendanceModel.student_id == User.id)
        .filter(AttendanceModel.session_id == session_id)
        .all()
    )
    return [
        _to_response(record, student_name)
        for record, student_name in records
    ]


@router.get("/student/{student_id}")
def get_student_attendance(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Cannot view other students")
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    records_with_names = (
        db.query(AttendanceModel, User.name)
        .join(User, AttendanceModel.student_id == User.id)
        .filter(AttendanceModel.student_id == student_id)
        .all()
    )
    history = [
        _to_response(record, student_name)
        for record, student_name in records_with_names
    ]
    records = [record for record, _ in records_with_names]

    course_totals: Dict[int, Dict[str, int]] = defaultdict(lambda: {"present": 0, "total": 0})
    for session in db.query(SessionModel).all():
        enrollment = (
            db.query(StudentCourse)
            .filter(
                StudentCourse.course_id == session.course_id,
                StudentCourse.student_id == student_id,
            )
            .first()
        )
        if not enrollment:
            continue
        course_totals[session.course_id]["total"] += 1
        attendance_record = next(
            (rec for rec in records if rec.session_id == session.id), None
        )
        if attendance_record and attendance_record.status == "present":
            course_totals[session.course_id]["present"] += 1

    percentages = [
        {
            "course_id": course_id,
            "attendance_percentage": (
                (stats["present"] / stats["total"]) * 100 if stats["total"] else 0.0
            ),
        }
        for course_id, stats in course_totals.items()
    ]

    return {
        "history": history,
        "percentages": percentages,
    }


@router.put("/edit", response_model=AttendanceResponse)
def edit_attendance(
    payload: AttendanceEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(AttendanceModel).filter(AttendanceModel.id == payload.attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance not found")
    session = _get_session(record.session_id, db)
    if current_user.role == "teacher":
        _ensure_teacher_session(session, current_user.id)
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    record.status = payload.status
    db.commit()
    student_name = (
        db.query(User.name).filter(User.id == record.student_id).scalar()
    )
    return _to_response(record, student_name)

