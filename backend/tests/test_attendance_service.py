"""Unit tests for AttendanceService.

Covered scenarios
─────────────────
retake        – cannot retake a submitted session
edit          – submitted session blocks edits; non-owner teacher blocked
get_session_attendance – student must be enrolled to view
create_manual – student must be enrolled; submitted session blocked
get_notifications – below 75 % threshold → warning; above → empty list
mark_crops    – submitted session blocked before any recognition runs
"""
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services.attendance_service import AttendanceService


# ── helpers ───────────────────────────────────────────────────────────────────

def _teacher(id=1):
    u = MagicMock()
    u.id = id
    u.role = "teacher"
    return u


def _student(id=10):
    u = MagicMock()
    u.id = id
    u.role = "student"
    return u


def _admin():
    u = MagicMock()
    u.id = 99
    u.role = "admin"
    return u


def _session(id=5, teacher_id=1, course_id=20, status="open"):
    s = MagicMock()
    s.id = id
    s.teacher_id = teacher_id
    s.course_id = course_id
    s.status = status
    return s


def _make_service():
    db = MagicMock()
    svc = AttendanceService(db)
    svc.repo = MagicMock()
    return svc


# ── retake ────────────────────────────────────────────────────────────────────

class TestRetake:
    def test_cannot_retake_submitted_session(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=1, status="submitted")

        payload = MagicMock(session_id=5)
        with pytest.raises(HTTPException) as exc:
            svc.retake(payload, _teacher(id=1))
        assert exc.value.status_code == 400
        assert "submitted" in exc.value.detail

    def test_non_owner_cannot_retake(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=999, status="open")

        payload = MagicMock(session_id=5)
        with pytest.raises(HTTPException) as exc:
            svc.retake(payload, _teacher(id=1))
        assert exc.value.status_code == 403

    def test_retake_clears_attendance_and_reopens_session(self):
        svc = _make_service()
        sess = _session(teacher_id=1, status="closed")
        svc.repo.get_session.return_value = sess

        payload = MagicMock(session_id=5)
        result = svc.retake(payload, _teacher(id=1))

        svc.repo.delete_for_session.assert_called_once_with(5)
        assert sess.status == "open"
        assert result == {"detail": "Attendance cleared for retake"}


# ── edit ──────────────────────────────────────────────────────────────────────

class TestEditAttendance:
    def test_edit_on_submitted_session_raises_400(self):
        svc = _make_service()
        record = MagicMock(id=1, session_id=5, student_id=10)
        svc.repo.get_by_id.return_value = record
        svc.repo.get_session.return_value = _session(teacher_id=1, status="submitted")

        payload = MagicMock(attendance_id=1, status="absent")
        with pytest.raises(HTTPException) as exc:
            svc.edit(payload, _teacher(id=1))
        assert exc.value.status_code == 400

    def test_non_owner_teacher_cannot_edit(self):
        svc = _make_service()
        record = MagicMock(id=1, session_id=5, student_id=10)
        svc.repo.get_by_id.return_value = record
        svc.repo.get_session.return_value = _session(teacher_id=999, status="open")

        payload = MagicMock(attendance_id=1, status="absent")
        with pytest.raises(HTTPException) as exc:
            svc.edit(payload, _teacher(id=1))
        assert exc.value.status_code == 403

    def test_student_cannot_edit_attendance(self):
        svc = _make_service()
        record = MagicMock(id=1, session_id=5, student_id=10)
        svc.repo.get_by_id.return_value = record
        svc.repo.get_session.return_value = _session(teacher_id=1, status="open")

        payload = MagicMock(attendance_id=1, status="present")
        with pytest.raises(HTTPException) as exc:
            svc.edit(payload, _student(id=10))
        assert exc.value.status_code == 403


# ── get_session_attendance ────────────────────────────────────────────────────

class TestGetSessionAttendance:
    def test_unenrolled_student_cannot_view(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=1, course_id=20)
        svc.repo.get_enrollment.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.get_session_attendance(5, _student(id=10))
        assert exc.value.status_code == 403


# ── create_manual ─────────────────────────────────────────────────────────────

class TestCreateManualAttendance:
    def test_submitted_session_blocks_manual_create(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=1, status="submitted")

        with pytest.raises(HTTPException) as exc:
            svc.create_manual(5, 10, "present", _teacher(id=1))
        assert exc.value.status_code == 400

    def test_unenrolled_student_cannot_be_marked_manually(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=1, status="open")
        svc.repo.get_enrollment.return_value = None  # not enrolled

        with pytest.raises(HTTPException) as exc:
            svc.create_manual(5, 10, "present", _teacher(id=1))
        assert exc.value.status_code == 400
        assert "not enrolled" in exc.value.detail.lower()


# ── get_notifications ─────────────────────────────────────────────────────────

class TestGetNotifications:
    def _setup_enrollment(self, svc, course_id, total_sessions, present_count):
        enrollment = MagicMock(course_id=course_id)
        # NOTE: 'name' is a special MagicMock constructor kwarg (sets repr).
        # Set .name as an attribute explicitly so course.name returns the string.
        course = MagicMock(id=course_id)
        course.name = f"Course {course_id}"

        svc.repo.get_enrollments_for_student.return_value = [enrollment]
        svc.repo.get_courses_by_ids.return_value = [course]
        svc.repo.count_submitted_sessions_per_course.return_value = {course_id: total_sessions}
        svc.repo.count_present_per_course.return_value = {course_id: present_count}

    def test_below_75_percent_returns_notification(self):
        svc = _make_service()
        self._setup_enrollment(svc, course_id=10, total_sessions=4, present_count=2)
        # 2/4 = 50 % → below threshold

        result = svc.get_notifications(_student(id=10))

        assert len(result) == 1
        assert result[0]["attendance_percentage"] == 50.0
        assert result[0]["course_name"] == "Course 10"

    def test_at_or_above_75_percent_returns_empty(self):
        svc = _make_service()
        self._setup_enrollment(svc, course_id=10, total_sessions=4, present_count=3)
        # 3/4 = 75 % → exactly at threshold, no warning

        result = svc.get_notifications(_student(id=10))

        assert result == []

    def test_course_with_no_submitted_sessions_is_skipped(self):
        svc = _make_service()
        enrollment = MagicMock(course_id=10)
        course = MagicMock(id=10)
        course.name = "Course 10"

        svc.repo.get_enrollments_for_student.return_value = [enrollment]
        svc.repo.get_courses_by_ids.return_value = [course]
        svc.repo.count_submitted_sessions_per_course.return_value = {10: 0}
        svc.repo.count_present_per_course.return_value = {}

        result = svc.get_notifications(_student(id=10))

        assert result == []

    def test_multiple_courses_only_warns_for_failing_ones(self):
        svc = _make_service()
        enroll_a = MagicMock(course_id=1)
        enroll_b = MagicMock(course_id=2)
        course_a = MagicMock(id=1)
        course_a.name = "Math"
        course_b = MagicMock(id=2)
        course_b.name = "Science"

        svc.repo.get_enrollments_for_student.return_value = [enroll_a, enroll_b]
        svc.repo.get_courses_by_ids.return_value = [course_a, course_b]
        # Math: 4 sessions, 1 present (25 %) → warning
        # Science: 4 sessions, 4 present (100 %) → no warning
        svc.repo.count_submitted_sessions_per_course.return_value = {1: 4, 2: 4}
        svc.repo.count_present_per_course.return_value = {1: 1, 2: 4}

        result = svc.get_notifications(_student(id=10))

        # Only the failing course should appear
        assert len(result) == 1
        assert result[0]["course_name"] == "Math"


# ── mark_crops (early validation) ────────────────────────────────────────────

class TestMarkCrops:
    def test_submitted_session_raises_before_any_recognition(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=1, status="submitted")

        with pytest.raises(HTTPException) as exc:
            svc.mark_crops(5, [MagicMock()], _teacher(id=1))
        assert exc.value.status_code == 400
        assert "submitted" in exc.value.detail

    def test_non_owner_teacher_blocked_before_recognition(self):
        svc = _make_service()
        svc.repo.get_session.return_value = _session(teacher_id=999, status="open")

        with pytest.raises(HTTPException) as exc:
            svc.mark_crops(5, [MagicMock()], _teacher(id=1))
        assert exc.value.status_code == 403
