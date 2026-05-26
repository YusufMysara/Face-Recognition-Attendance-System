"""Unit tests for SessionService — session lifecycle state machine.

State rules under test
──────────────────────
open  →  closed    (end)
closed →  open     (continue)
open/closed → submitted  (submit)   — irreversible
submitted   → *          raises 400 for end / continue / retake

Ownership rules under test
──────────────────────────
Only the teacher who started a session may end / continue / submit / delete it.
"""
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services.session_service import SessionService


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


def _session(id=5, teacher_id=1, course_id=20, status="open", ended_at=None):
    s = MagicMock()
    s.id = id
    s.teacher_id = teacher_id
    s.course_id = course_id
    s.status = status
    s.ended_at = ended_at
    return s


def _make_service():
    db = MagicMock()
    svc = SessionService(db)
    svc.repo = MagicMock()
    return svc


# ── start ─────────────────────────────────────────────────────────────────────

class TestStartSession:
    def test_course_not_found_raises_404(self):
        svc = _make_service()
        svc.repo.get_course_by_id.return_value = None

        payload = MagicMock(course_id=99)
        with pytest.raises(HTTPException) as exc:
            svc.start(payload, _teacher())
        assert exc.value.status_code == 404

    def test_teacher_cannot_start_session_for_another_teachers_course(self):
        svc = _make_service()
        course = MagicMock(teacher_id=999)   # owned by teacher 999
        svc.repo.get_course_by_id.return_value = course

        payload = MagicMock(course_id=20)
        with pytest.raises(HTTPException) as exc:
            svc.start(payload, _teacher(id=1))   # teacher 1 attempts it
        assert exc.value.status_code == 403

    def test_start_creates_session_with_open_status(self):
        svc = _make_service()
        course = MagicMock(teacher_id=1)
        svc.repo.get_course_by_id.return_value = course
        svc.repo.create.return_value = _session(status="open")

        payload = MagicMock(course_id=20)
        result = svc.start(payload, _teacher(id=1))

        call_kwargs = svc.repo.create.call_args.kwargs
        assert call_kwargs["status"] == "open"
        assert call_kwargs["teacher_id"] == 1


# ── end ───────────────────────────────────────────────────────────────────────

class TestEndSession:
    def test_session_not_found_raises_404(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.end(99, _teacher())
        assert exc.value.status_code == 404

    def test_non_owner_cannot_end_session(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _session(teacher_id=999)

        with pytest.raises(HTTPException) as exc:
            svc.end(5, _teacher(id=1))
        assert exc.value.status_code == 403

    def test_cannot_end_submitted_session(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _session(teacher_id=1, status="submitted")

        with pytest.raises(HTTPException) as exc:
            svc.end(5, _teacher(id=1))
        assert exc.value.status_code == 400
        assert "submitted" in exc.value.detail

    def test_end_sets_status_to_closed(self):
        svc = _make_service()
        sess = _session(teacher_id=1, status="open")
        svc.repo.get_by_id.return_value = sess
        svc.repo.save.return_value = sess

        svc.end(5, _teacher(id=1))

        assert sess.status == "closed"
        assert sess.ended_at is not None


# ── continue ──────────────────────────────────────────────────────────────────

class TestContinueSession:
    def test_can_only_continue_closed_session(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _session(teacher_id=1, status="open")

        with pytest.raises(HTTPException) as exc:
            svc.continue_session(5, _teacher(id=1))
        assert exc.value.status_code == 400
        assert "closed" in exc.value.detail

    def test_continue_reopens_session_and_clears_ended_at(self):
        svc = _make_service()
        sess = _session(teacher_id=1, status="closed", ended_at=datetime.utcnow())
        svc.repo.get_by_id.return_value = sess
        svc.repo.save.return_value = sess

        svc.continue_session(5, _teacher(id=1))

        assert sess.status == "open"
        assert sess.ended_at is None


# ── submit ────────────────────────────────────────────────────────────────────

class TestSubmitSession:
    def test_non_owner_cannot_submit(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _session(teacher_id=999)

        with pytest.raises(HTTPException) as exc:
            svc.submit(5, _teacher(id=1))
        assert exc.value.status_code == 403

    def test_submit_fills_absent_for_students_without_attendance(self):
        svc = _make_service()
        sess = _session(teacher_id=1, course_id=20, status="open")
        svc.repo.get_by_id.return_value = sess
        svc.repo.get_enrolled_student_ids.return_value = {1, 2, 3}
        svc.repo.get_existing_attendee_ids.return_value = {1}   # only student 1 attended
        svc.repo.save.return_value = sess

        svc.submit(5, _teacher(id=1))

        # Students 2 and 3 must get absent records
        svc.repo.bulk_add_absent.assert_called_once_with(5, {2, 3})
        assert sess.status == "submitted"

    def test_submit_when_all_students_attended_adds_no_absents(self):
        svc = _make_service()
        sess = _session(teacher_id=1, course_id=20, status="open")
        svc.repo.get_by_id.return_value = sess
        svc.repo.get_enrolled_student_ids.return_value = {1, 2}
        svc.repo.get_existing_attendee_ids.return_value = {1, 2}  # everyone attended
        svc.repo.save.return_value = sess

        svc.submit(5, _teacher(id=1))

        svc.repo.bulk_add_absent.assert_called_once_with(5, set())  # empty set


# ── get (single session) ──────────────────────────────────────────────────────

class TestGetSession:
    def test_student_not_enrolled_cannot_view_session(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = _session(course_id=20)
        svc.repo.get_student_enrollment.return_value = None   # not enrolled

        with pytest.raises(HTTPException) as exc:
            svc.get(5, _student(id=10))
        assert exc.value.status_code == 403
