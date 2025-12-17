from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import Attendance, Course, Session as SessionModel, StudentCourse, User
from app.schemas.course import (
    CourseAssignment,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    TeacherAssignment,
)

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("", response_model=CourseResponse)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    teacher = None
    if payload.teacher_id is not None:
        teacher = (
            db.query(User)
            .filter(User.id == payload.teacher_id, User.role == "teacher")
            .first()
        )
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")
    course = Course(**payload.dict())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("", response_model=List[CourseResponse])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Course)
    if current_user.role == "teacher":
        query = query.filter(Course.teacher_id == current_user.id)
    elif current_user.role == "student":
        query = (
            query.join(StudentCourse, Course.id == StudentCourse.course_id)
            .filter(StudentCourse.student_id == current_user.id)
        )
    return query.all()


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
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
        link = (
            db.query(StudentCourse)
            .filter(
                StudentCourse.course_id == course_id,
                StudentCourse.student_id == current_user.id,
            )
            .first()
        )
        if not link:
            raise HTTPException(status_code=403, detail="Not enrolled")
    return course


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get all session IDs for this course
    session_ids = (
        db.query(SessionModel.id).filter(SessionModel.course_id == course_id).all()
    )
    session_id_list = [sid[0] for sid in session_ids]
    
    # Delete all attendance records for sessions in this course
    if session_id_list:
        (
            db.query(Attendance)
            .filter(Attendance.session_id.in_(session_id_list))
            .delete(synchronize_session=False)
        )
    
    # Delete all sessions for this course
    (
        db.query(SessionModel)
        .filter(SessionModel.course_id == course_id)
        .delete(synchronize_session=False)
    )
    
    # Delete all student-course relationships
    (
        db.query(StudentCourse)
        .filter(StudentCourse.course_id == course_id)
        .delete(synchronize_session=False)
    )
    
    # Delete the course
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted"}


@router.post("/assign-student")
def assign_student(
    payload: CourseAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    student = db.query(User).filter(User.id == payload.student_id, User.role == "student").first()
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not student or not course:
        raise HTTPException(status_code=404, detail="Invalid student or course")
    link = (
        db.query(StudentCourse)
        .filter(
            StudentCourse.student_id == payload.student_id,
            StudentCourse.course_id == payload.course_id,
        )
        .first()
    )
    if link:
        raise HTTPException(status_code=400, detail="Already assigned")
    db.add(StudentCourse(student_id=payload.student_id, course_id=payload.course_id))
    db.commit()
    return {"detail": "Student assigned"}


@router.post("/remove-student")
def remove_student(
    payload: CourseAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    student = db.query(User).filter(User.id == payload.student_id, User.role == "student").first()
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not student or not course:
        raise HTTPException(status_code=404, detail="Invalid student or course")
    link = (
        db.query(StudentCourse)
        .filter(
            StudentCourse.student_id == payload.student_id,
            StudentCourse.course_id == payload.course_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=400, detail="Student not assigned to course")
    db.delete(link)
    db.commit()
    return {"detail": "Student removed from course"}


@router.post("/assign-teacher")
def assign_teacher(
    payload: TeacherAssignment,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    teacher = db.query(User).filter(User.id == payload.teacher_id, User.role == "teacher").first()
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not teacher or not course:
        raise HTTPException(status_code=404, detail="Invalid teacher or course")
    course.teacher_id = payload.teacher_id
    db.commit()
    return {"detail": "Teacher assigned"}


@router.get("/{course_id}/students")
def get_course_students(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all students enrolled in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check permissions
    if current_user.role == "teacher" and course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")
    elif current_user.role == "student":
        enrollment = (
            db.query(StudentCourse)
            .filter(
                StudentCourse.course_id == course_id,
                StudentCourse.student_id == current_user.id,
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled")

    enrolled_students = (
        db.query(User)
        .join(StudentCourse, User.id == StudentCourse.student_id)
        .filter(StudentCourse.course_id == course_id)
        .all()
    )

    return [
        {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "group": student.group,
        }
        for student in enrolled_students
    ]
