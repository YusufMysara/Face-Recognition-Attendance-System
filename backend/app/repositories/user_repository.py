"""Pure data-access for the User domain.

Rules:
- Only ORM queries, commits, and refreshes.
- No business rules. No HTTPException. No file I/O.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Attendance, Course, Session as SessionModel, StudentCourse, User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── lookups ──────────────────────────────────────────────────────────────

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.db.query(User).offset(skip).limit(limit).all()

    def exists_email(self, email: str, exclude_id: Optional[int] = None) -> bool:
        q = self.db.query(User).filter(User.email == email)
        if exclude_id is not None:
            q = q.filter(User.id != exclude_id)
        return q.first() is not None

    # ── mutations ─────────────────────────────────────────────────────────────

    def create(self, **fields) -> User:
        user = User(**fields)
        self.db.add(user)
        self.db.flush()
        self.db.refresh(user)
        return user

    def save(self, user: User) -> User:
        self.db.flush()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)

    # ── cascade helpers (called before deleting a user) ───────────────────────

    def delete_attendance_by_student(self, student_id: int) -> None:
        self.db.query(Attendance).filter(
            Attendance.student_id == student_id
        ).delete(synchronize_session=False)

    def delete_enrollments_by_student(self, student_id: int) -> None:
        self.db.query(StudentCourse).filter(
            StudentCourse.student_id == student_id
        ).delete(synchronize_session=False)

    def get_session_ids_for_teacher(self, teacher_id: int) -> List[int]:
        rows = (
            self.db.query(SessionModel.id)
            .filter(SessionModel.teacher_id == teacher_id)
            .all()
        )
        return [row[0] for row in rows]

    def delete_attendance_by_sessions(self, session_ids: List[int]) -> None:
        if not session_ids:
            return
        self.db.query(Attendance).filter(
            Attendance.session_id.in_(session_ids)
        ).delete(synchronize_session=False)

    def delete_sessions_by_teacher(self, teacher_id: int) -> None:
        self.db.query(SessionModel).filter(
            SessionModel.teacher_id == teacher_id
        ).delete(synchronize_session=False)

    def bulk_add(self, users_data: list) -> int:
        """Add multiple User rows in one flush. Returns count added."""
        for data in users_data:
            self.db.add(User(**data))
        self.db.flush()
        return len(users_data)

    def nullify_teacher_courses(self, teacher_id: int) -> None:
        self.db.query(Course).filter(Course.teacher_id == teacher_id).update(
            {Course.teacher_id: None}, synchronize_session=False
        )
