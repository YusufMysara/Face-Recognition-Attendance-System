from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Course, Session as SessionModel, User
from app.schemas.session import SessionCreate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _ensure_teacher_course(teacher: User, course_id: int, db: Session):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if teacher.role != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")
    if course.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


@router.post("/start", response_model=SessionResponse)
def start_session(
    payload: SessionCreate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    _ensure_teacher_course(current_user, payload.course_id, db)
    session = SessionModel(
        course_id=payload.course_id,
        teacher_id=current_user.id,
        status="open",
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/end", response_model=SessionResponse)
def end_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    session.status = "closed"
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.post("/submit", response_model=SessionResponse)
def submit_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    session.status = "submitted"
    session.ended_at = session.ended_at or datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    db.delete(session)
    db.commit()
    return {"detail": "Session deleted"}


@router.get("/course/{course_id}", response_model=List[SessionResponse])
def list_sessions_for_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")
    if current_user.role == "student":
        enrollment = next(
            (
                sc
                for sc in course.students
                if sc.student_id == current_user.id and sc.course_id == course_id
            ),
            None,
        )
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled")
    return (
        db.query(SessionModel)
        .filter(SessionModel.course_id == course_id)
        .order_by(SessionModel.started_at.desc())
        .all()
    )

