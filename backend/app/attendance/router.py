import json
import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Attendance as AttendanceModel
from app.models import Course, Session as SessionModel, StudentCourse, User
from app.schemas.attendance import AttendanceEdit, AttendanceResponse, RetakeRequest
from app.utils.face import bytes_to_bgr, get_face_app, get_face_app_crops

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

    Returns:
      attendance     – list of AttendanceResponse for recognised students
      detected_faces – list of every detected face (recognised or not) with
                       bbox [x1,y1,x2,y2], student info, and similarity score,
                       so the frontend can draw labelled bounding boxes.
    """
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

    # Build list of (student, 512-dim ArcFace embedding).
    # Skip embeddings that are not 512-dim (old dlib 128-dim embeddings from
    # the previous face_recognition backend — they need to be re-enrolled).
    known: List[tuple] = []
    for student in students:
        if not student.face_embedding:
            continue
        emb = np.array(json.loads(student.face_embedding), dtype=np.float32)
        if emb.shape[0] != 512:
            continue
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        known.append((student, emb))

    if not known:
        raise HTTPException(
            status_code=400,
            detail="No valid face embeddings registered. "
                   "Students must re-upload their photos after the InsightFace migration.",
        )

    file.file.seek(0)
    img = bytes_to_bgr(file.file.read())

    faces = get_face_app().get(img)
    if not faces:
        return {"attendance": [], "detected_faces": []}

    SIMILARITY_THRESHOLD = 0.35

    attendance_responses: List[AttendanceResponse] = []
    detected_faces: List[Dict[str, Any]] = []

    for face in faces:
        bbox = face.bbox.astype(int).tolist()
        embedding = face.embedding.astype(np.float32)
        emb_norm = np.linalg.norm(embedding)
        if emb_norm > 0:
            embedding = embedding / emb_norm

        best_student: Optional[User] = None
        best_score = 0.0
        for student, known_emb in known:
            score = float(np.dot(embedding, known_emb))
            if score > best_score:
                best_score = score
                best_student = student

        matched_id: Optional[int] = None
        matched_name: Optional[str] = None

        if best_student and best_score >= SIMILARITY_THRESHOLD:
            matched_id = best_student.id
            matched_name = best_student.name

            # Upsert attendance record
            record = (
                db.query(AttendanceModel)
                .filter(
                    AttendanceModel.session_id == session_id,
                    AttendanceModel.student_id == best_student.id,
                )
                .first()
            )
            if record:
                record.status = "present"
            else:
                record = AttendanceModel(
                    session_id=session_id,
                    student_id=best_student.id,
                    status="present",
                )
                db.add(record)
            db.commit()
            attendance_responses.append(_to_response(record, best_student.name))

        detected_faces.append({
            "bbox": bbox,
            "student_id": matched_id,
            "student_name": matched_name,
            "score": round(best_score, 3),
        })

    return {"attendance": attendance_responses, "detected_faces": detected_faces}


@router.post("/mark-crops")
def mark_attendance_crops(
    session_id: int = Form(...),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """
    Hybrid detection endpoint: the client (SCRFD) already detected faces
    and sends one cropped face image per detected face.
    This endpoint only runs ArcFace recognition on each crop — no full-frame
    SCRFD scan needed, which makes it significantly faster.

    Returns one result per crop in the same order they were sent.
    """
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

    # Pre-normalise stored embeddings once per request (L2 norm = 1).
    # Cosine similarity = dot product only when BOTH vectors are unit vectors.
    known: List[tuple] = []
    for student in students:
        if not student.face_embedding:
            continue
        emb = np.array(json.loads(student.face_embedding), dtype=np.float32)
        if emb.shape[0] != 512:
            continue
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        known.append((student, emb))

    if not known:
        raise HTTPException(
            status_code=400,
            detail="No valid face embeddings registered.",
        )

    SIMILARITY_THRESHOLD = 0.35
    face_app = get_face_app_crops()
    results: List[Dict[str, Any]] = []

    t_start = time.perf_counter()
    for idx, file in enumerate(files):
        t_crop = time.perf_counter()
        file.file.seek(0)
        try:
            img = bytes_to_bgr(file.file.read())
        except Exception:
            results.append({"face_index": idx, "student_id": None, "student_name": None, "score": 0.0})
            continue

        # max_num=1: only process the single largest face in the crop.
        # Without this, SCRFD may return multiple candidates and ArcFace runs
        # once per candidate, multiplying inference time needlessly.
        faces = face_app.get(img, max_num=1)
        t_insight = time.perf_counter()
        logger.info(f"[timing] crop {idx}: InsightFace={1000*(t_insight-t_crop):.0f} ms")

        if not faces:
            results.append({"face_index": idx, "student_id": None, "student_name": None, "score": 0.0})
            continue

        # Pick the largest face in the crop (should be the only one)
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

        # Explicitly L2-normalise the query embedding so dot product = cosine similarity
        embedding = face.embedding.astype(np.float32)
        emb_norm = np.linalg.norm(embedding)
        if emb_norm > 0:
            embedding = embedding / emb_norm

        best_student: Optional[User] = None
        best_score = 0.0
        for student, known_emb in known:
            score = float(np.dot(embedding, known_emb))
            if score > best_score:
                best_score = score
                best_student = student

        logger.info(
            f"[recognition] crop {idx}: best_match={best_student.name if best_student else 'none'} "
            f"score={best_score:.3f} threshold={SIMILARITY_THRESHOLD} "
            f"→ {'MATCH' if best_student and best_score >= SIMILARITY_THRESHOLD else 'NO MATCH'}"
        )

        if best_student and best_score >= SIMILARITY_THRESHOLD:
            record = (
                db.query(AttendanceModel)
                .filter(
                    AttendanceModel.session_id == session_id,
                    AttendanceModel.student_id == best_student.id,
                )
                .first()
            )
            if record:
                record.status = "present"
            else:
                record = AttendanceModel(
                    session_id=session_id,
                    student_id=best_student.id,
                    status="present",
                )
                db.add(record)
            db.commit()
            results.append({
                "face_index": idx,
                "student_id": best_student.id,
                "student_name": best_student.name,
                "score": round(best_score, 3),
            })
        else:
            results.append({
                "face_index": idx,
                "student_id": None,
                "student_name": None,
                "score": round(best_score, 3),
            })

    t_end = time.perf_counter()
    logger.info(
        f"[timing] mark-crops total: {len(files)} crops in {1000*(t_end-t_start):.0f} ms "
        f"({1000*(t_end-t_start)/max(len(files),1):.0f} ms/crop avg)"
    )
    return {"recognized": results}


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
        db.query(AttendanceModel, User.name, Course.name, SessionModel.course_id, SessionModel.started_at)
        .join(User, AttendanceModel.student_id == User.id)
        .join(SessionModel, AttendanceModel.session_id == SessionModel.id)
        .join(Course, SessionModel.course_id == Course.id)
        .filter(AttendanceModel.student_id == student_id)
        .order_by(AttendanceModel.timestamp.desc())
        .all()
    )

    # Create session names per course
    course_session_counts = {}
    history = []
    for record, student_name, course_name, course_id, session_started_at in records_with_names:
        if course_id not in course_session_counts:
            course_session_counts[course_id] = {}

        # Get all sessions for this course ordered by date
        if course_id not in course_session_counts or 'sessions' not in course_session_counts[course_id]:
            course_sessions = (
                db.query(SessionModel)
                .filter(SessionModel.course_id == course_id)
                .order_by(SessionModel.started_at.asc())
                .all()
            )
            course_session_counts[course_id] = {
                'sessions': course_sessions,
                'session_map': {s.id: i + 1 for i, s in enumerate(course_sessions)}
            }

        session_number = course_session_counts[course_id]['session_map'].get(record.session_id, 1)

        history.append({
            "id": record.id,
            "session_id": record.session_id,
            "student_id": record.student_id,
            "status": record.status,
            "timestamp": record.timestamp,
            "student_name": student_name,
            "course_id": course_id,
            "course_name": course_name,
            "session_name": f"Session {session_number}",
        })
    records = [record for record, _, _, _, _ in records_with_names]

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
    if session.status == "submitted":
        raise HTTPException(status_code=400, detail="Cannot edit attendance for a submitted session")
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


@router.get("/all")
def get_all_attendance(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Admin endpoint to get all attendance records with course information"""
    records = (
        db.query(AttendanceModel, User.name, Course.name)
        .join(User, AttendanceModel.student_id == User.id)
        .join(SessionModel, AttendanceModel.session_id == SessionModel.id)
        .join(Course, SessionModel.course_id == Course.id)
        .all()
    )
    return [
        {
            "id": record.id,
            "session_id": record.session_id,
            "student_id": record.student_id,
            "student_name": student_name,
            "course_name": course_name,
            "status": record.status,
            "timestamp": record.timestamp.isoformat() if record.timestamp else None,
        }
        for record, student_name, course_name in records
    ]


@router.post("/manual", response_model=AttendanceResponse)
def create_manual_attendance(
    session_id: int = Form(...),
    student_id: int = Form(...),
    status: str = Form(...),
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    """Manually create or update attendance record for review purposes"""
    session = _get_session(session_id, db)
    if session.status == "submitted":
        raise HTTPException(status_code=400, detail="Cannot modify attendance for a submitted session")
    _ensure_teacher_session(session, current_user.id)

    # Check if student is enrolled in the course
    enrollment = (
        db.query(StudentCourse)
        .filter(
            StudentCourse.course_id == session.course_id,
            StudentCourse.student_id == student_id,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=400, detail="Student not enrolled in this course")

    # Check if attendance record already exists
    existing_record = (
        db.query(AttendanceModel)
        .filter(
            AttendanceModel.session_id == session_id,
            AttendanceModel.student_id == student_id,
        )
        .first()
    )

    if existing_record:
        # Update existing record
        existing_record.status = status
        record = existing_record
    else:
        # Create new record
        record = AttendanceModel(
            session_id=session_id,
            student_id=student_id,
            status=status,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    # Get student name
    student_name = (
        db.query(User.name).filter(User.id == student_id).scalar()
    )

    return _to_response(record, student_name)


@router.get("/notifications")
def get_notifications(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """
    Return low-attendance warnings for the logged-in student.
    Checks all enrolled courses using submitted sessions only (consistent with
    how submit_session finalises attendance). Returns an empty list if all
    courses are at or above 75%.
    """
    enrollments = (
        db.query(StudentCourse)
        .filter(StudentCourse.student_id == current_user.id)
        .all()
    )

    notifications = []
    for enrollment in enrollments:
        course = db.query(Course).filter(Course.id == enrollment.course_id).first()
        if not course:
            continue

        # Only look at submitted (locked) sessions — same data submit_session writes
        submitted_sessions = (
            db.query(SessionModel)
            .filter(
                SessionModel.course_id == enrollment.course_id,
                SessionModel.status == "submitted",
            )
            .all()
        )
        total = len(submitted_sessions)
        if total == 0:
            continue

        session_ids = [s.id for s in submitted_sessions]
        present_count = (
            db.query(AttendanceModel)
            .filter(
                AttendanceModel.student_id == current_user.id,
                AttendanceModel.session_id.in_(session_ids),
                AttendanceModel.status == "present",
            )
            .count()
        )

        percentage = round((present_count / total) * 100, 1)
        if percentage < 75.0:
            notifications.append(
                {
                    "course_id": course.id,
                    "course_name": course.name,
                    "attendance_percentage": percentage,
                }
            )

    return notifications