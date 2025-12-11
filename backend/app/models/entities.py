from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    group = Column(String, nullable=True)
    photo_path = Column(String, nullable=True)
    face_embedding = Column(Text, nullable=True)
    password_changed = Column(Integer, default=0, nullable=False)  # 0 = not changed, 1 = changed

    teaching_courses = relationship("Course", back_populates="teacher")
    student_courses = relationship("StudentCourse", back_populates="student")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    teacher = relationship("User", back_populates="teaching_courses")
    sessions = relationship("Session", back_populates="course")
    students = relationship("StudentCourse", back_populates="course")


class StudentCourse(Base):
    __tablename__ = "student_courses"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)

    student = relationship("User", back_populates="student_courses")
    course = relationship("Course", back_populates="students")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    status = Column(
        Enum("open", "closed", "submitted", name="session_status"), default="open"
    )

    course = relationship("Course", back_populates="sessions")
    attendance_records = relationship("Attendance", back_populates="session")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        Enum("present", "absent", "late", "excused", name="attendance_status"),
        nullable=False,
    )
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="attendance_records")
    student = relationship("User")

    @property
    def student_name(self) -> Optional[str]:
        return self.student.name if self.student else None

