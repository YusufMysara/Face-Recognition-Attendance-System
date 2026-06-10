"""Pure data-access for the Attendance domain."""
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Attendance as AttendanceModel,
    Course,
    Session as SessionModel,
    StudentCourse,
    User,
)


class AttendanceRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── session helpers (attendance always needs session context) ──────────────

    def get_session(self, session_id: int) -> Optional[SessionModel]:
        return (
            self.db.query(SessionModel)
            .filter(SessionModel.id == session_id)
            .first()
        )

    def get_course_students(self, course_id: int) -> List[User]:
        """All enrolled students for a course (used by recognition endpoints)."""
        return (
            self.db.query(User)
            .join(StudentCourse, StudentCourse.student_id == User.id)
            .filter(StudentCourse.course_id == course_id)
            .all()
        )

    # ── attendance lookups ────────────────────────────────────────────────────

    def get_by_id(self, attendance_id: int) -> Optional[AttendanceModel]:
        return (
            self.db.query(AttendanceModel)
            .filter(AttendanceModel.id == attendance_id)
            .first()
        )

    def get_record(
        self, session_id: int, student_id: int
    ) -> Optional[AttendanceModel]:
        return (
            self.db.query(AttendanceModel)
            .filter(
                AttendanceModel.session_id == session_id,
                AttendanceModel.student_id == student_id,
            )
            .first()
        )

    def get_for_session(
        self, session_id: int
    ) -> List[Tuple[AttendanceModel, str]]:
        """Returns (record, student_name) rows for a session."""
        return (
            self.db.query(AttendanceModel, User.name)
            .join(User, AttendanceModel.student_id == User.id)
            .filter(AttendanceModel.session_id == session_id)
            .all()
        )

    def get_student_name(self, student_id: int) -> Optional[str]:
        return self.db.query(User.name).filter(User.id == student_id).scalar()

    def get_student_by_id(self, student_id: int) -> Optional[User]:
        return (
            self.db.query(User)
            .filter(User.id == student_id, User.role == "student")
            .first()
        )

    def get_student_attendance_history(self, student_id: int) -> List[Tuple]:
        """Returns (record, student_name, course_name, course_id, session_started_at)."""
        return (
            self.db.query(
                AttendanceModel,
                User.name,
                Course.name,
                SessionModel.course_id,
                SessionModel.started_at,
            )
            .join(User, AttendanceModel.student_id == User.id)
            .join(SessionModel, AttendanceModel.session_id == SessionModel.id)
            .join(Course, SessionModel.course_id == Course.id)
            .filter(AttendanceModel.student_id == student_id)
            .order_by(AttendanceModel.timestamp.desc())
            .all()
        )

    def get_sessions_for_course_ordered(self, course_id: int) -> List[SessionModel]:
        return (
            self.db.query(SessionModel)
            .filter(SessionModel.course_id == course_id)
            .order_by(SessionModel.started_at.asc())
            .all()
        )

    def get_sessions_for_courses(self, course_ids: Set[int]) -> List[SessionModel]:
        """All sessions whose course_id is in the given set (single IN query)."""
        if not course_ids:
            return []
        return (
            self.db.query(SessionModel)
            .filter(SessionModel.course_id.in_(course_ids))
            .all()
        )

    def get_courses_by_ids(self, course_ids: List[int]) -> List[Course]:
        """Batch-fetch courses by a list of IDs (single IN query)."""
        if not course_ids:
            return []
        return (
            self.db.query(Course)
            .filter(Course.id.in_(course_ids))
            .all()
        )

    def count_submitted_sessions_per_course(
        self, course_ids: List[int]
    ) -> Dict[int, int]:
        """Returns {course_id: submitted_session_count} for all given courses."""
        if not course_ids:
            return {}
        rows = (
            self.db.query(SessionModel.course_id, func.count(SessionModel.id))
            .filter(
                SessionModel.course_id.in_(course_ids),
                SessionModel.status == "submitted",
            )
            .group_by(SessionModel.course_id)
            .all()
        )
        return {course_id: count for course_id, count in rows}

    def count_present_per_course(
        self, student_id: int, course_ids: List[int]
    ) -> Dict[int, int]:
        """Returns {course_id: present_count} across submitted sessions (single query)."""
        if not course_ids:
            return {}
        rows = (
            self.db.query(SessionModel.course_id, func.count(AttendanceModel.id))
            .join(AttendanceModel, AttendanceModel.session_id == SessionModel.id)
            .filter(
                AttendanceModel.student_id == student_id,
                AttendanceModel.status == "present",
                SessionModel.course_id.in_(course_ids),
                SessionModel.status == "submitted",
            )
            .group_by(SessionModel.course_id)
            .all()
        )
        return {course_id: count for course_id, count in rows}

    def get_enrollment(
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

    def get_all_with_joins(
        self, skip: int = 0, limit: int = 100
    ) -> List[Tuple]:
        """Returns (record, student_name, course_name) for admin view."""
        return (
            self.db.query(AttendanceModel, User.name, Course.name)
            .join(User, AttendanceModel.student_id == User.id)
            .join(SessionModel, AttendanceModel.session_id == SessionModel.id)
            .join(Course, SessionModel.course_id == Course.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_present(self, student_id: int, session_ids: List[int]) -> int:
        return (
            self.db.query(AttendanceModel)
            .filter(
                AttendanceModel.student_id == student_id,
                AttendanceModel.session_id.in_(session_ids),
                AttendanceModel.status == "present",
            )
            .count()
        )

    def get_enrollments_for_student(self, student_id: int) -> List[StudentCourse]:
        return (
            self.db.query(StudentCourse)
            .filter(StudentCourse.student_id == student_id)
            .all()
        )

    def get_course_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    # ── mutations ─────────────────────────────────────────────────────────────

    def upsert_present(
        self, session_id: int, student_id: int
    ) -> AttendanceModel:
        record = self.get_record(session_id, student_id)
        if record:
            record.status = "present"
        else:
            record = AttendanceModel(
                session_id=session_id,
                student_id=student_id,
                status="present",
            )
            self.db.add(record)
        return record

    def upsert_manual(
        self, session_id: int, student_id: int, status: str
    ) -> AttendanceModel:
        """Create or update a manual attendance record (no commit — caller commits)."""
        record = self.get_record(session_id, student_id)
        if record:
            record.status = status
        else:
            record = AttendanceModel(
                session_id=session_id,
                student_id=student_id,
                status=status,
            )
            self.db.add(record)
        self.db.flush()
        self.db.refresh(record)
        return record

    def delete_for_session(self, session_id: int) -> None:
        self.db.query(AttendanceModel).filter(
            AttendanceModel.session_id == session_id
        ).delete()

    def save(self, record: AttendanceModel) -> AttendanceModel:
        self.db.flush()
        self.db.refresh(record)
        return record
