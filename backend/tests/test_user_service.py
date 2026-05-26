"""Unit tests for UserService business logic.

All tests run in-memory: the SQLAlchemy Session and every repository method
are replaced with MagicMock objects.  No database, no HTTP server required.

Covered scenarios
─────────────────
create_user  – duplicate email, admin-without-password, default password for students
delete_user  – super-admin protection, same-role protection, self-delete guard, cascades
update_user  – cross-admin edit guard, super-admin field guards, duplicate-email check
change_password – wrong current password
upload_student_photo – role guard, one-photo-only guard
reset_password – regular admin cannot reset another admin's password
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.user_service import UserService


# ── helpers ───────────────────────────────────────────────────────────────────

def _user(
    id=1,
    name="Test User",
    email="test@example.com",
    role="student",
    password_hash="$2b$08$hashed",
    photo_path=None,
    password_changed=0,
):
    u = MagicMock()
    u.id = id
    u.name = name
    u.email = email
    u.role = role
    u.password_hash = password_hash
    u.photo_path = photo_path
    u.password_changed = password_changed
    return u


def _super_admin():
    return _user(id=999, name="Super Admin", email="admin@example.com", role="admin")


def _regular_admin():
    return _user(id=2, name="Regular Admin", email="reg@example.com", role="admin")


def _make_service():
    db = MagicMock()
    svc = UserService(db)
    svc.repo = MagicMock()
    return svc


# ── create_user ───────────────────────────────────────────────────────────────

class TestCreateUser:
    def test_duplicate_email_raises_400(self):
        svc = _make_service()
        svc.repo.exists_email.return_value = True

        payload = MagicMock(email="dup@example.com", password="Pass1!", role="student")
        with pytest.raises(HTTPException) as exc:
            svc.create_user(payload, _regular_admin())

        assert exc.value.status_code == 400
        assert "Email already exists" in exc.value.detail

    def test_admin_without_password_raises_400(self):
        svc = _make_service()
        svc.repo.exists_email.return_value = False

        payload = MagicMock(email="new@example.com", password=None, role="admin")
        with pytest.raises(HTTPException) as exc:
            svc.create_user(payload, _super_admin())

        assert exc.value.status_code == 400
        assert "Password is required" in exc.value.detail

    def test_student_without_password_uses_default_hash(self):
        svc = _make_service()
        svc.repo.exists_email.return_value = False
        svc.repo.create.return_value = _user(role="student")

        payload = MagicMock(
            email="student@example.com", password=None, role="student",
            name="Alice", group="A"
        )
        with patch("app.services.user_service.get_password_hash", return_value="hashed_default"):
            svc.create_user(payload, _regular_admin())

        call_kwargs = svc.repo.create.call_args.kwargs
        assert call_kwargs["password_hash"] == "hashed_default"
        assert call_kwargs["password_changed"] == 0   # must change on first login


# ── delete_user ───────────────────────────────────────────────────────────────

class TestDeleteUser:
    def test_user_not_found_raises_404(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.delete_user(99, _super_admin())
        assert exc.value.status_code == 404

    def test_super_admin_cannot_be_deleted(self):
        svc = _make_service()
        target = _user(email="admin@example.com", name="Super Admin", role="admin")
        svc.repo.get_by_id.return_value = target

        with pytest.raises(HTTPException) as exc:
            svc.delete_user(target.id, _super_admin())
        assert exc.value.status_code == 403
        assert "Super Admin account cannot be deleted" in exc.value.detail

    def test_regular_admin_cannot_delete_another_admin(self):
        svc = _make_service()
        target = _user(id=5, role="admin", email="other@example.com")
        svc.repo.get_by_id.return_value = target

        with pytest.raises(HTTPException) as exc:
            svc.delete_user(target.id, _regular_admin())
        assert exc.value.status_code == 403

    def test_regular_admin_cannot_delete_own_account(self):
        """A regular admin trying to delete themselves hits the admin-role guard first
        (regular admins cannot delete any admin account, including their own)."""
        svc = _make_service()
        admin = _regular_admin()
        svc.repo.get_by_id.return_value = admin   # deleting themselves

        with pytest.raises(HTTPException) as exc:
            svc.delete_user(admin.id, admin)
        assert exc.value.status_code == 403
        # The "cannot delete admin accounts" check fires before the self-delete check.
        assert "admin accounts" in exc.value.detail

    def test_delete_student_cascades_attendance_and_enrollments(self):
        svc = _make_service()
        student = _user(id=7, role="student")
        svc.repo.get_by_id.return_value = student

        svc.delete_user(student.id, _super_admin())

        svc.repo.delete_attendance_by_student.assert_called_once_with(7)
        svc.repo.delete_enrollments_by_student.assert_called_once_with(7)
        svc.repo.delete.assert_called_once_with(student)

    def test_delete_teacher_cascades_sessions_courses_and_attendance(self):
        svc = _make_service()
        teacher = _user(id=8, role="teacher")
        svc.repo.get_by_id.return_value = teacher
        svc.repo.get_session_ids_for_teacher.return_value = [10, 11]

        svc.delete_user(teacher.id, _super_admin())

        svc.repo.delete_attendance_by_sessions.assert_called_once_with([10, 11])
        svc.repo.delete_sessions_by_teacher.assert_called_once_with(8)
        svc.repo.nullify_teacher_courses.assert_called_once_with(8)
        svc.repo.delete.assert_called_once_with(teacher)


# ── update_user ───────────────────────────────────────────────────────────────

class TestUpdateUser:
    def test_not_found_raises_404(self):
        svc = _make_service()
        svc.repo.get_by_id.return_value = None

        with pytest.raises(HTTPException) as exc:
            svc.update_user(99, MagicMock(), _regular_admin())
        assert exc.value.status_code == 404

    def test_regular_admin_cannot_edit_another_admin(self):
        svc = _make_service()
        target = _user(id=5, role="admin", email="other@example.com")
        svc.repo.get_by_id.return_value = target

        payload = MagicMock(
            name="New Name", email=None, password=None, group=None, role=None
        )
        with pytest.raises(HTTPException) as exc:
            svc.update_user(target.id, payload, _regular_admin())
        assert exc.value.status_code == 403

    def test_cannot_change_super_admin_role(self):
        svc = _make_service()
        target = _user(email="admin@example.com", name="Super Admin", role="admin")
        svc.repo.get_by_id.return_value = target

        payload = MagicMock(
            name=None, email=None, password=None, group=None, role="student"
        )
        with pytest.raises(HTTPException) as exc:
            svc.update_user(target.id, payload, _super_admin())
        assert exc.value.status_code == 403
        assert "role cannot be changed" in exc.value.detail

    def test_email_already_in_use_raises_400(self):
        svc = _make_service()
        target = _user(id=3, role="student", email="old@example.com")
        svc.repo.get_by_id.return_value = target
        svc.repo.exists_email.return_value = True    # collision detected

        payload = MagicMock(
            name=None, email="taken@example.com", password=None, group=None, role=None
        )
        with pytest.raises(HTTPException) as exc:
            svc.update_user(target.id, payload, _super_admin())
        assert exc.value.status_code == 400
        assert "Email already in use" in exc.value.detail


# ── change_password ───────────────────────────────────────────────────────────

class TestChangePassword:
    def test_wrong_current_password_raises_400(self):
        svc = _make_service()
        user = _user(password_hash="correct_hash")

        with patch("app.services.user_service.verify_password", return_value=False):
            with pytest.raises(HTTPException) as exc:
                svc.change_password("wrong", "NewPass1!", user)
        assert exc.value.status_code == 400
        assert "incorrect" in exc.value.detail

    def test_correct_password_updates_hash(self):
        svc = _make_service()
        user = _user(password_hash="old_hash")
        svc.repo.save.return_value = user

        with patch("app.services.user_service.verify_password", return_value=True), \
             patch("app.services.user_service.validate_password_strength"), \
             patch("app.services.user_service.get_password_hash", return_value="new_hash"):
            svc.change_password("correct", "NewPass1!", user)

        assert user.password_hash == "new_hash"
        assert user.password_changed == 1


# ── upload_student_photo ──────────────────────────────────────────────────────

class TestUploadStudentPhoto:
    def test_non_student_cannot_upload(self):
        svc = _make_service()
        teacher = _user(role="teacher")

        with pytest.raises(HTTPException) as exc:
            svc.upload_student_photo(MagicMock(), teacher)
        assert exc.value.status_code == 403

    def test_student_with_existing_photo_raises_400(self):
        svc = _make_service()
        student = _user(role="student", photo_path="/uploads/existing.jpg")

        with pytest.raises(HTTPException) as exc:
            svc.upload_student_photo(MagicMock(), student)
        assert exc.value.status_code == 400
        assert "already uploaded" in exc.value.detail


# ── reset_password ────────────────────────────────────────────────────────────

class TestResetPassword:
    def test_regular_admin_cannot_reset_another_admins_password(self):
        svc = _make_service()
        target = _user(id=5, role="admin", email="other_admin@example.com")
        svc.repo.get_by_id.return_value = target

        payload = MagicMock(user_id=5, new_password="NewPass1!")
        with pytest.raises(HTTPException) as exc:
            svc.reset_password(payload, _regular_admin())
        assert exc.value.status_code == 403

    def test_regular_admin_cannot_reset_super_admin_password(self):
        svc = _make_service()
        target = _user(id=999, email="admin@example.com", name="Super Admin", role="admin")
        svc.repo.get_by_id.return_value = target

        payload = MagicMock(user_id=999, new_password="NewPass1!")
        with pytest.raises(HTTPException) as exc:
            svc.reset_password(payload, _regular_admin())
        assert exc.value.status_code == 403
