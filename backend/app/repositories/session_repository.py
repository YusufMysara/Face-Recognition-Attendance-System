"""Pure data-access for the Session domain."""
from typing import List, Optional, Set, Tuple

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Attendance, Course, Session as SessionModel, StudentCourse


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── lookups ───────────────────────────────────────────────────────────────

    def get_by_id(self, session_id: int) -> Optional[SessionModel]:
        return (
            self.db.query(SessionModel)
            .filter(SessionModel.id == session_id)
            .first()
        )

    def get_for_course(self, course_id: int) -> List[SessionModel]:
        return (
            self.db.query(SessionModel)
            .filter(SessionModel.course_id == course_id)
            .order_by(SessionModel.started_at.desc())
            .all()
        )

    def get_for_course_with_counts(self, course_id: int) -> List[Tuple]:
        counts_sq = (
            self.db.query(
                Attendance.session_id,
                func.count(Attendance.id).label("total"),
                func.sum(case((Attendance.status == "present", 1), else_=0)).label("present"),
            )
            .group_by(Attendance.session_id)
            .subquery()
        )
        return (
            self.db.query(
                SessionModel,
                func.coalesce(counts_sq.c.present, 0).label("attendance_count"),
                func.coalesce(counts_sq.c.total, 0).label("total_students"),
            )
            .outerjoin(counts_sq, SessionModel.id == counts_sq.c.session_id)
            .filter(SessionModel.course_id == course_id)
            .order_by(SessionModel.started_at.desc())
            .all()
        )

    def get_course_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_enrolled_student_ids(self, course_id: int) -> Set[int]:
        rows = (
            self.db.query(StudentCourse)
            .filter(StudentCourse.course_id == course_id)
            .all()
        )
        return {sc.student_id for sc in rows}

    def get_existing_attendee_ids(self, session_id: int) -> Set[int]:
        rows = (
            self.db.query(Attendance)
            .filter(Attendance.session_id == session_id)
            .all()
        )
        return {a.student_id for a in rows}

    def get_student_enrollment(
        self, course_id: int, student_id: int
    ) -> Optional[StudentCourse]:
        return (
            self.db.query(StudentCourse)
            .filter(
                StudentCourse.course_id == course_id,
                StudentCourse.student_id == student_id,
            )
            .first()
        )

    # ── mutations ─────────────────────────────────────────────────────────────

    def create(self, **fields) -> SessionModel:
        session = SessionModel(**fields)
        self.db.add(session)
        self.db.flush()
        self.db.refresh(session)
        return session

    def save(self, session: SessionModel) -> SessionModel:
        self.db.flush()
        self.db.refresh(session)
        return session

    def delete(self, session: SessionModel) -> None:
        """Delete attendance records then the session itself."""
        self.db.query(Attendance).filter(
            Attendance.session_id == session.id
        ).delete(synchronize_session=False)
        self.db.delete(session)

    def bulk_add_absent(self, session_id: int, student_ids: Set[int]) -> None:
        for student_id in student_ids:
            self.db.add(
                Attendance(
                    session_id=session_id,
                    student_id=student_id,
                    status="absent",
                )
            )
