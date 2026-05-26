"""Business logic for course management."""
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Course, User
from app.repositories.course_repository import CourseRepository
from app.schemas.course import CourseAssignment, CourseCreate, CourseUpdate, TeacherAssignment


class CourseService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CourseRepository(db)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _get_user_by_role(self, user_id: int, role: str) -> User:
        return self.repo.get_user_by_role(user_id, role)

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create_course(self, payload: CourseCreate) -> Course:
        if payload.teacher_id is not None:
            teacher = self._get_user_by_role(payload.teacher_id, "teacher")
            if not teacher:
                raise HTTPException(status_code=404, detail="Teacher not found")
        course = self.repo.create(**payload.model_dump())
        self.db.commit()
        return course

    def list_courses(self, current_user: User) -> List[Course]:
        if current_user.role == "teacher":
            return self.repo.get_for_teacher(current_user.id)
        if current_user.role == "student":
            return self.repo.get_for_student(current_user.id)
        return self.repo.get_all()

    def get_course(self, course_id: int, current_user: User) -> Course:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if current_user.role == "teacher" and course.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")
        if current_user.role == "student":
            link = self.repo.get_enrollment(current_user.id, course_id)
            if not link:
                raise HTTPException(status_code=403, detail="Not enrolled")
        return course

    def update_course(self, course_id: int, payload: CourseUpdate) -> Course:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        for key, value in payload.dict(exclude_unset=True).items():
            setattr(course, key, value)
        course = self.repo.save(course)
        self.db.commit()
        return course

    def delete_course(self, course_id: int) -> dict:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        session_ids = self.repo.get_session_ids(course_id)
        self.repo.delete_attendance_for_sessions(session_ids)
        self.repo.delete_sessions(course_id)
        self.repo.delete_enrollments(course_id)
        self.repo.delete(course)
        self.db.commit()
        return {"detail": "Course deleted"}

    # ── enrolment management ──────────────────────────────────────────────────

    def assign_student(self, payload: CourseAssignment) -> dict:
        student = self._get_user_by_role(payload.student_id, "student")
        course = self.repo.get_by_id(payload.course_id)
        if not student or not course:
            raise HTTPException(status_code=404, detail="Invalid student or course")
        if self.repo.get_enrollment(payload.student_id, payload.course_id):
            raise HTTPException(status_code=400, detail="Already assigned")
        self.repo.add_enrollment(payload.student_id, payload.course_id)
        self.db.commit()
        return {"detail": "Student assigned"}

    def remove_student(self, payload: CourseAssignment) -> dict:
        student = self._get_user_by_role(payload.student_id, "student")
        course = self.repo.get_by_id(payload.course_id)
        if not student or not course:
            raise HTTPException(status_code=404, detail="Invalid student or course")
        link = self.repo.get_enrollment(payload.student_id, payload.course_id)
        if not link:
            raise HTTPException(
                status_code=400, detail="Student not assigned to course"
            )
        self.repo.remove_enrollment(link)
        self.db.commit()
        return {"detail": "Student removed from course"}

    def assign_teacher(self, payload: TeacherAssignment) -> dict:
        teacher = self._get_user_by_role(payload.teacher_id, "teacher")
        course = self.repo.get_by_id(payload.course_id)
        if not teacher or not course:
            raise HTTPException(status_code=404, detail="Invalid teacher or course")
        course.teacher_id = payload.teacher_id
        self.repo.save(course)
        self.db.commit()
        return {"detail": "Teacher assigned"}

    def get_students(self, course_id: int, current_user: User) -> list:
        course = self.repo.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if current_user.role == "teacher" and course.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your course")
        if current_user.role == "student":
            if not self.repo.get_enrollment(current_user.id, course_id):
                raise HTTPException(status_code=403, detail="Not enrolled")
        students = self.repo.get_students(course_id)
        return [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "group": s.group,
            }
            for s in students
        ]
