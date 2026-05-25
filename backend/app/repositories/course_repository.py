"""Pure data-access for the Course domain."""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Attendance, Course, Session as SessionModel, StudentCourse, User


class CourseRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── lookups ───────────────────────────────────────────────────────────────

    def get_by_id(self, course_id: int) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_all(self) -> List[Course]:
        return self.db.query(Course).all()

    def get_for_teacher(self, teacher_id: int) -> List[Course]:
        return (
            self.db.query(Course)
            .filter(Course.teacher_id == teacher_id)
            .all()
        )

    def get_for_student(self, student_id: int) -> List[Course]:
        return (
            self.db.query(Course)
            .join(StudentCourse, Course.id == StudentCourse.course_id)
            .filter(StudentCourse.student_id == student_id)
            .all()
        )

    def get_enrollment(self, student_id: int, course_id: int) -> Optional[StudentCourse]:
        return (
            self.db.query(StudentCourse)
            .filter(
                StudentCourse.student_id == student_id,
                StudentCourse.course_id == course_id,
            )
            .first()
        )

    def get_students(self, course_id: int) -> List[User]:
        return (
            self.db.query(User)
            .join(StudentCourse, User.id == StudentCourse.student_id)
            .filter(StudentCourse.course_id == course_id)
            .all()
        )

    def get_session_ids(self, course_id: int) -> List[int]:
        rows = (
            self.db.query(SessionModel.id)
            .filter(SessionModel.course_id == course_id)
            .all()
        )
        return [row[0] for row in rows]

    # ── mutations ─────────────────────────────────────────────────────────────

    def create(self, **fields) -> Course:
        course = Course(**fields)
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)
        return course

    def save(self, course: Course) -> Course:
        self.db.commit()
        self.db.refresh(course)
        return course

    def delete(self, course: Course) -> None:
        self.db.delete(course)
        self.db.commit()

    def add_enrollment(self, student_id: int, course_id: int) -> StudentCourse:
        link = StudentCourse(student_id=student_id, course_id=course_id)
        self.db.add(link)
        self.db.commit()
        return link

    def remove_enrollment(self, link: StudentCourse) -> None:
        self.db.delete(link)
        self.db.commit()

    # ── cascade helpers (called before deleting a course) ─────────────────────

    def delete_attendance_for_sessions(self, session_ids: List[int]) -> None:
        if not session_ids:
            return
        self.db.query(Attendance).filter(
            Attendance.session_id.in_(session_ids)
        ).delete(synchronize_session=False)

    def delete_sessions(self, course_id: int) -> None:
        self.db.query(SessionModel).filter(
            SessionModel.course_id == course_id
        ).delete(synchronize_session=False)

    def delete_enrollments(self, course_id: int) -> None:
        self.db.query(StudentCourse).filter(
            StudentCourse.course_id == course_id
        ).delete(synchronize_session=False)
