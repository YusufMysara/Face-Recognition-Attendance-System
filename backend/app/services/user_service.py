"""Business logic for user management.

Rules:
- Uses UserRepository for all data access.
- Raises HTTPException for business-rule violations.
- No db.query() calls — all ORM work goes through the repository.
"""
from typing import List

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import PasswordResetRequest, UserCreate, UserUpdate
from app.utils.face import extract_face_embedding
from app.utils.security import get_password_hash, validate_password_strength, verify_password

_settings = get_settings()
_SUPER_ADMIN_EMAIL = _settings.super_admin_email
_SUPER_ADMIN_NAME = _settings.super_admin_name


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    # ── user creation ─────────────────────────────────────────────────────────

    def create_user(self, payload: UserCreate, current_user: User) -> User:
        if self.repo.exists_email(payload.email):
            raise HTTPException(status_code=400, detail="Email already exists")

        if payload.password:
            validate_password_strength(payload.password)
            password_hash = get_password_hash(payload.password)
            password_changed = 1
        else:
            if payload.role == "admin":
                raise HTTPException(
                    status_code=400,
                    detail="Password is required for admin accounts",
                )
            password_hash = get_password_hash("default123")
            password_changed = 0

        return self.repo.create(
            name=payload.name,
            email=payload.email,
            role=payload.role,
            group=payload.group,
            password_hash=password_hash,
            password_changed=password_changed,
        )

    # ── listing ───────────────────────────────────────────────────────────────

    def list_users(self) -> List[User]:
        return self.repo.get_all()

    # ── update ────────────────────────────────────────────────────────────────

    def update_user(
        self, user_id: int, payload: UserUpdate, current_user: User
    ) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Regular admins cannot modify other admin accounts
        if (
            user.role == "admin"
            and current_user.email != _SUPER_ADMIN_EMAIL
            and user.id != current_user.id
        ):
            if payload.name or payload.email or payload.password:
                raise HTTPException(
                    status_code=403,
                    detail="Regular admins cannot modify other admin accounts",
                )

        # Password-change permission checks
        if payload.password:
            if current_user.email != _SUPER_ADMIN_EMAIL:
                if user.role == "admin" and user.id != current_user.id:
                    raise HTTPException(
                        status_code=403,
                        detail="Regular admins cannot change other admin passwords",
                    )
                if user.email == _SUPER_ADMIN_EMAIL or user.name == _SUPER_ADMIN_NAME:
                    raise HTTPException(
                        status_code=403,
                        detail="Super Admin password can only be changed by Super Admin himself",
                    )

        # Guard Super Admin critical fields
        if user.email == _SUPER_ADMIN_EMAIL or user.name == _SUPER_ADMIN_NAME:
            if payload.role and payload.role != "admin":
                raise HTTPException(
                    status_code=403, detail="Super Admin role cannot be changed"
                )
            if payload.name and current_user.email != _SUPER_ADMIN_EMAIL:
                raise HTTPException(
                    status_code=403,
                    detail="Super Admin name can only be changed by Super Admin himself",
                )
            if payload.email and current_user.email != _SUPER_ADMIN_EMAIL:
                raise HTTPException(
                    status_code=403,
                    detail="Super Admin email can only be changed by Super Admin himself",
                )

        # Apply changes
        if payload.name:
            user.name = payload.name
        if payload.email:
            if self.repo.exists_email(payload.email, exclude_id=user_id):
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = payload.email
        if payload.group is not None:
            user.group = payload.group
        if payload.role:
            user.role = payload.role
        if payload.password:
            validate_password_strength(payload.password)
            user.password_hash = get_password_hash(payload.password)

        return self.repo.save(user)

    # ── delete ────────────────────────────────────────────────────────────────

    def delete_user(self, user_id: int, current_user: User) -> dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if current_user.email != _SUPER_ADMIN_EMAIL:
            if user.role == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Regular admins cannot delete admin accounts",
                )
            if user.id == current_user.id:
                raise HTTPException(
                    status_code=403, detail="You cannot delete your own account"
                )

        if user.email == _SUPER_ADMIN_EMAIL or user.name == _SUPER_ADMIN_NAME:
            raise HTTPException(
                status_code=403, detail="Super Admin account cannot be deleted"
            )

        # Cascade deletes before removing the user row
        if user.role == "student":
            self.repo.delete_attendance_by_student(user_id)
            self.repo.delete_enrollments_by_student(user_id)
        elif user.role == "teacher":
            session_ids = self.repo.get_session_ids_for_teacher(user_id)
            self.repo.delete_attendance_by_sessions(session_ids)
            self.repo.delete_sessions_by_teacher(user_id)
            self.repo.nullify_teacher_courses(user_id)

        self.repo.delete(user)
        return {"detail": "User deleted"}

    # ── photo upload ──────────────────────────────────────────────────────────

    def upload_photo(self, student_id: int, file: UploadFile) -> User:
        """Admin uploads a student's photo by student_id."""
        student = self.repo.get_by_id(student_id)
        if not student or student.role != "student":
            raise HTTPException(status_code=404, detail="Student not found")
        photo_path, embedding = extract_face_embedding(file)
        student.photo_path = photo_path
        student.face_embedding = embedding
        return self.repo.save(student)

    def upload_student_photo(self, file: UploadFile, current_user: User) -> User:
        """Student uploads their own photo."""
        if current_user.role != "student":
            raise HTTPException(
                status_code=403, detail="Only students can upload photos"
            )
        if current_user.photo_path:
            raise HTTPException(
                status_code=400,
                detail="Photo already uploaded. You can only upload one photo.",
            )
        photo_path, embedding = extract_face_embedding(file)
        current_user.photo_path = photo_path
        current_user.face_embedding = embedding
        return self.repo.save(current_user)

    # ── password management ───────────────────────────────────────────────────

    def reset_password(
        self, payload: PasswordResetRequest, current_user: User
    ) -> dict:
        user = self.repo.get_by_id(payload.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if current_user.email != _SUPER_ADMIN_EMAIL:
            if user.role == "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Regular admins cannot reset other admin passwords",
                )
            if user.email == _SUPER_ADMIN_EMAIL or user.name == _SUPER_ADMIN_NAME:
                raise HTTPException(
                    status_code=403,
                    detail="Super Admin password can only be changed by Super Admin himself",
                )

        validate_password_strength(payload.new_password)
        user.password_hash = get_password_hash(payload.new_password)
        self.db.commit()
        return {"detail": "Password reset"}

    def change_password(
        self, current_password: str, new_password: str, current_user: User
    ) -> User:
        if not verify_password(current_password, current_user.password_hash):
            raise HTTPException(
                status_code=400, detail="Current password is incorrect"
            )
        validate_password_strength(new_password)
        current_user.password_hash = get_password_hash(new_password)
        current_user.password_changed = 1
        return self.repo.save(current_user)

    # ── bulk upload ───────────────────────────────────────────────────────────

    def bulk_upload(self, file: UploadFile, current_user: User) -> dict:
        if not file.filename.endswith((".xlsx", ".xls")):
            raise HTTPException(
                status_code=400,
                detail="File must be Excel format (.xlsx or .xls)",
            )

        try:
            from io import BytesIO

            import pandas as pd

            file_content = file.file.read()
            df = pd.read_excel(BytesIO(file_content))

            required_columns = ["name", "email", "role"]
            missing_columns = [c for c in required_columns if c not in df.columns]
            if missing_columns:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Missing required columns: {', '.join(missing_columns)}. "
                        "Required: name, email, role"
                    ),
                )

            created_count = 0
            errors = []

            for index, row in df.iterrows():
                try:
                    email_value = row["email"]
                    if pd.isna(email_value):
                        errors.append(f"Row {index + 2}: Email is required")
                        continue

                    email = str(email_value).strip()
                    if not email or email.lower() == "nan":
                        errors.append(f"Row {index + 2}: Email is required")
                        continue

                    if self.repo.exists_email(email):
                        errors.append(
                            f"Row {index + 2}: Email '{email}' already exists"
                        )
                        continue

                    # Early role check (before name validation, same as original)
                    role_early = str(row["role"]).strip().lower()
                    if (
                        role_early == "admin"
                        and current_user.email != _SUPER_ADMIN_EMAIL
                    ):
                        errors.append(
                            f"Row {index + 2}: Only Super Admin can create admin users"
                        )
                        continue

                    name_value = row["name"]
                    if pd.isna(name_value):
                        errors.append(f"Row {index + 2}: Name is required")
                        continue

                    name = str(name_value).strip()
                    if not name or name.lower() == "nan":
                        errors.append(f"Row {index + 2}: Name is required")
                        continue

                    role_value = row.get("role")
                    if pd.isna(role_value):
                        errors.append(f"Row {index + 2}: Role is required")
                        continue

                    role = str(role_value).strip().lower()
                    if not role or role.lower() == "nan":
                        errors.append(f"Row {index + 2}: Role is required")
                        continue

                    if role not in ("admin", "teacher", "student"):
                        errors.append(
                            f"Row {index + 2}: Invalid role '{role}'. "
                            "Must be 'admin', 'teacher', or 'student'"
                        )
                        continue

                    # Final admin permission check (mirrors original double-check)
                    if role == "admin" and current_user.email != _SUPER_ADMIN_EMAIL:
                        errors.append(
                            f"Row {index + 2}: Only Super Admin can create admin users"
                        )
                        continue

                    user_data: dict = {
                        "name": name,
                        "email": email,
                        "role": role,
                        "password_hash": get_password_hash("default123"),
                        "password_changed": 0,
                    }

                    if role == "student" and "group" in df.columns:
                        group_value = row.get("group")
                        if pd.notna(group_value):
                            user_data["group"] = str(group_value).strip()

                    self.db.add(User(**user_data))
                    created_count += 1

                except Exception as exc:
                    errors.append(f"Row {index + 2}: {exc}")

            self.db.commit()

            return {
                "created_count": created_count,
                "errors": errors,
                "message": (
                    f"Successfully created {created_count} users"
                    + (f" with {len(errors)} errors" if errors else "")
                ),
            }

        except HTTPException:
            raise
        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=400, detail=f"Error processing file: {exc}"
            )
