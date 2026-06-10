"""Unit tests for CourseService — course CRUD, enrolment, and permission logic."""
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services.course_service import CourseService


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_service():
    db = MagicMock()
    svc = CourseService(db)
    svc.repo = MagicMock()
    return svc


def _admin():
    u = MagicMock()
    u.id = 1
    u.role = "admin"
    return u


def _teacher(id=10, course_owner=True):
    u = MagicMock()
    u.id = id
    u.role = "teacher"
    return u


def _student(id=20):
    u = MagicMock()
    u.id = id
    u.role = "student"
    return u


def _course(id=5, teacher_id=10):
    c = MagicMock()
    c.id = id
    c.teacher_id = teacher_id
    return c


# ── create_course ─────────────────────────────────────────────────────────────

class TestCreateCourse:
    def test_raises_404_when_teacher_not_found(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = None
        payload = MagicMock(teacher_id=99, name="Math", description="Desc")

        with pytest.raises(HTTPException) as exc:
            svc.create_course(payload)
        assert exc.value.status_code == 404
        assert "Teacher not found" in exc.value.detail

    def test_creates_course_without_teacher(self):
        svc = _make_service()
        payload = MagicMock(teacher_id=None)
        payload.model_dump.return_value = {"name": "Art", "description": "Art class", "teacher_id": None}
        svc.repo.create.return_value = _course()

        svc.create_course(payload)

        svc.repo.create.assert_called_once()
        svc.db.commit.assert_called_once()

    def test_creates_course_with_valid_teacher(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = _teacher()
        payload = MagicMock(teacher_id=10)
        payload.model_dump.return_value = {"name": "Math", "description": "Maths", "teacher_id": 10}
        svc.repo.create.return_value = _course()

        svc.create_course(payload)

        svc.repo.create.assert_called_once()
        svc.db.commit.assert_called_once()


# ── list_courses ──────────────────────────────────────────────────────────────

class TestListCourses:
    def test_admin_gets_all_courses(self):
        svc = _make_service()
        svc.repo.get_all.return_value = [_course(1), _course(2)]

        result = svc.list_courses(_admin())

        svc.repo.get_all.assert_called_once()
        assert len(result) == 2

    def test_teacher_gets_own_courses(self):
        svc = _make_service()
        svc.repo.get_for_teacher.return_value = [_course()]

        result = svc.list_courses(_teacher(id=10))

        svc.repo.get_for_teacher.assert_called_once_with(10)
        assert len(result) == 1

    def test_student_gets_enrolled_courses(self):
        svc = _make_service()
        svc.repo.get_for_student.return_value = [_course()]

        result = svc.list_courses(_student(id=20))

        svc.repo.get_for_student.assert_called_once_with(20)
        assert len(result) == 1


# ── get_course ────────────────────────────────────────────────────────────────

class TestGetCourse:
    def test_raises_404_when_course_not_found(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.get_course(99, _admin())
        assert exc.value.status_code == 404

    def test_teacher_blocked_from_another_teachers_course(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _course(teacher_id=999)

        with pytest.raises(HTTPException) as exc:
            svc.get_course(5, _teacher(id=10))
        assert exc.value.status_code == 403

    def test_student_blocked_when_not_enrolled(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_enrollment.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.get_course(5, _student(id=20))
        assert exc.value.status_code == 403

    def test_student_can_view_enrolled_course(self):
        svc = _make_service()
        course = _course()
        svc.repo.get_by_id.return_value = course
        svc.repo.get_enrollment.return_value = MagicMock()

        result = svc.get_course(5, _student(id=20))

        assert result is course


# ── update_course ─────────────────────────────────────────────────────────────

class TestUpdateCourse:
    def test_raises_404_when_course_not_found(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.update_course(99, MagicMock())
        assert exc.value.status_code == 404

    def test_applies_partial_update(self):
        svc = _make_service()
        course = _course()
        svc.repo.get_by_id.return_value = course
        svc.repo.save.return_value = course
        payload = MagicMock()
        payload.model_dump.return_value = {"name": "New Name"}

        svc.update_course(5, payload)

        assert course.name == "New Name"
        svc.db.commit.assert_called_once()


# ── delete_course ─────────────────────────────────────────────────────────────

class TestDeleteCourse:
    def test_raises_404_when_course_not_found(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.delete_course(99)
        assert exc.value.status_code == 404

    def test_delete_cascades_attendance_sessions_and_enrollments(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_session_ids.return_value = [1, 2, 3]

        svc.delete_course(5)

        svc.repo.delete_attendance_for_sessions.assert_called_once_with([1, 2, 3])
        svc.repo.delete_sessions.assert_called_once()
        svc.repo.delete_enrollments.assert_called_once()
        svc.repo.delete.assert_called_once()
        svc.db.commit.assert_called_once()


# ── assign_student ────────────────────────────────────────────────────────────

class TestAssignStudent:
    def test_raises_404_for_invalid_student_or_course(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = None
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.assign_student(MagicMock(student_id=99, course_id=5))
        assert exc.value.status_code == 404

    def test_raises_400_when_already_assigned(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = _student()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_enrollment.return_value = MagicMock()  # already enrolled

        with pytest.raises(HTTPException) as exc:
            svc.assign_student(MagicMock(student_id=20, course_id=5))
        assert exc.value.status_code == 400
        assert "Already assigned" in exc.value.detail

    def test_successful_assignment(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = _student()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_enrollment.return_value = None

        result = svc.assign_student(MagicMock(student_id=20, course_id=5))

        svc.repo.add_enrollment.assert_called_once()
        svc.db.commit.assert_called_once()
        assert result == {"detail": "Student assigned"}


# ── remove_student ────────────────────────────────────────────────────────────

class TestRemoveStudent:
    def test_raises_400_when_student_not_assigned(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = _student()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_enrollment.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.remove_student(MagicMock(student_id=20, course_id=5))
        assert exc.value.status_code == 400

    def test_successful_removal(self):
        svc = _make_service()
        link = MagicMock()
        svc.repo.get_user_by_role.return_value = _student()
        svc.repo.get_by_id.return_value = _course()
        svc.repo.get_enrollment.return_value = link

        result = svc.remove_student(MagicMock(student_id=20, course_id=5))

        svc.repo.remove_enrollment.assert_called_once_with(link)
        svc.db.commit.assert_called_once()
        assert result == {"detail": "Student removed from course"}


# ── assign_teacher ────────────────────────────────────────────────────────────

class TestAssignTeacher:
    def test_raises_404_for_invalid_teacher_or_course(self):
        svc = _make_service()
        svc.repo.get_user_by_role.return_value = None
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.assign_teacher(MagicMock(teacher_id=99, course_id=5))
        assert exc.value.status_code == 404

    def test_assigns_teacher_to_course(self):
        svc = _make_service()
        course = _course()
        svc.repo.get_user_by_role.return_value = _teacher(id=10)
        svc.repo.get_by_id.return_value = course

        result = svc.assign_teacher(MagicMock(teacher_id=10, course_id=5))

        assert course.teacher_id == 10
        svc.db.commit.assert_called_once()
        assert result == {"detail": "Teacher assigned"}


# ── get_students ──────────────────────────────────────────────────────────────

class TestGetStudents:
    def test_raises_404_when_course_not_found(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.get_students(99, _admin())
        assert exc.value.status_code == 404

    def test_teacher_blocked_from_another_teachers_course(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _course(teacher_id=999)

        with pytest.raises(HTTPException) as exc:
            svc.get_students(5, _teacher(id=10))
        assert exc.value.status_code == 403

    def test_returns_student_list(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _course(teacher_id=10)
        student = MagicMock()
        student.id = 20
        student.name = "Alice"
        student.email = "alice@test.com"
        student.group = "A"
        svc.repo.get_students.return_value = [student]

        result = svc.get_students(5, _teacher(id=10))

        assert len(result) == 1
        assert result[0]["name"] == "Alice"
