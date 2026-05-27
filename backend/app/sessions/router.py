from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.session import SessionCreate, SessionResponse
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionResponse)
def start_session(
    payload: SessionCreate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    return SessionService(db).start(payload, current_user)


@router.post("/end", response_model=SessionResponse)
def end_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    return SessionService(db).end(session_id, current_user)


@router.post("/continue", response_model=SessionResponse)
def continue_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    return SessionService(db).continue_session(session_id, current_user)


@router.post("/submit", response_model=SessionResponse)
def submit_session(
    session_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    return SessionService(db).submit(session_id, current_user)


@router.get("/course/{course_id}", response_model=List[SessionResponse])
def list_sessions_for_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SessionService(db).list_for_course(course_id, current_user)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SessionService(db).get(session_id, current_user)


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SessionService(db).delete(session_id, current_user)
