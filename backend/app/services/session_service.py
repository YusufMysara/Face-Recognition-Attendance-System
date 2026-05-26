"""Business logic for session lifecycle management.

State machine: open → closed → submitted (irreversible).
closed → open is allowed via /continue.
"""
from datetime import datetime
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Session as SessionModel, User
from app.repositories.session_repository import SessionRepository
from app.schemas.session import SessionCreate


class SessionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SessionRepository(db)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _require_session(self, session_id: int) -> SessionModel:
        session = self.repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    def _require_owner(self, session: SessionModel, teacher_id: int) -> None:
        if session.teacher_id != teacher_id:
            raise HTTPException(status_code=403, detail="Not your session")

    # ── lifecycle endpoints ───────────────────────────────────────────────────

    def start(self, payload: SessionCreate, current_user: User) -> SessionModel:
        course = self.repo.get_course_by_id(payload.course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if current_user.role != "teacher":
            raise HTTPException(status_code=403, detail="Teachers only")
        if course.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")
        session = self.repo.create(
            course_id=payload.course_id,
            teacher_id=current_user.id,
            status="open",
            started_at=datetime.utcnow(),
        )
        self.db.commit()
        return session

    def end(self, session_id: int, current_user: User) -> SessionModel:
        session = self._require_session(session_id)
        self._require_owner(session, current_user.id)
        if session.status == "submitted":
            raise HTTPException(
                status_code=400, detail="Cannot end a submitted session"
            )
        session.status = "closed"
        session.ended_at = datetime.utcnow()
        session = self.repo.save(session)
        self.db.commit()
        return session

    def continue_session(self, session_id: int, current_user: User) -> SessionModel:
        session = self._require_session(session_id)
        self._require_owner(session, current_user.id)
        if session.status != "closed":
            raise HTTPException(
                status_code=400, detail="Can only continue closed sessions"
            )
        session.status = "open"
        session.ended_at = None
        session = self.repo.save(session)
        self.db.commit()
        return session

    def submit(self, session_id: int, current_user: User) -> SessionModel:
        session = self._require_session(session_id)
        self._require_owner(session, current_user.id)

        # Auto-fill absent records for students without attendance
        enrolled_ids = self.repo.get_enrolled_student_ids(session.course_id)
        existing_ids = self.repo.get_existing_attendee_ids(session_id)
        self.repo.bulk_add_absent(session_id, enrolled_ids - existing_ids)

        session.status = "submitted"
        session.ended_at = session.ended_at or datetime.utcnow()
        session = self.repo.save(session)
        self.db.commit()
        return session

    def delete(self, session_id: int, current_user: User) -> dict:
        session = self._require_session(session_id)
        self._require_owner(session, current_user.id)
        self.repo.delete(session)
        self.db.commit()
        return {"detail": "Session deleted"}

    # ── read endpoints ────────────────────────────────────────────────────────

    def get(self, session_id: int, current_user: User) -> SessionModel:
        session = self._require_session(session_id)
        if current_user.role == "teacher":
            self._require_owner(session, current_user.id)
        elif current_user.role == "student":
            enrollment = self.repo.get_student_enrollment(
                session.course_id, current_user.id
            )
            if not enrollment:
                raise HTTPException(status_code=403, detail="Not enrolled in course")
        return session

    def list_for_course(
        self, course_id: int, current_user: User
    ) -> List[SessionModel]:
        course = self.repo.get_course_by_id(course_id)
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
        return self.repo.get_for_course(course_id)
