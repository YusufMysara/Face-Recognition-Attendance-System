"""Business logic for user management.

Rules:
- Uses UserRepository for all data access.
- Raises HTTPException for business-rule violations.
- No db.query() calls — all ORM work goes through the repository.
"""
from typing import List

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models import User
from app.repositories.course_repository import CourseRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    PasswordResetRequest,
    UserCreate,
    UserUpdate,
    validate_year_department,
)
from app.utils.face import extract_face_embedding
from app.utils.security import get_password_hash, validate_password_strength, verify_password


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)
        self.course_repo = CourseRepository(db)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _validate_student_fields(self, year, department) -> None:
        if year is None or department is None:
            raise HTTPException(
                status_code=400,
                detail="Students must have a year and department",
            )
        validate_year_department(year, department)

    def _auto_enroll_student(self, user: User) -> None:
        """Enroll student in all courses matching their year and department."""
        courses = self.repo.get_courses_by_year_dept(user.year, user.department)
        for course in courses:
            if not self.course_repo.get_enrollment(user.id, course.id):
                self.course_repo.add_enrollment(user.id, course.id)

    # ── user creation ─────────────────────────────────────────────────────────

    def create_user(self, payload: UserCreate, current_user: User) -> User:
        if self.repo.exists_email(payload.email):
            raise HTTPException(status_code=400, detail="Email already exists")

        if payload.role == "student":
            self._validate_student_fields(payload.year, payload.department)

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

        user = self.repo.create(
            name=payload.name,
            email=payload.email,
            role=payload.role,
            year=payload.year if payload.role == "student" else None,
            department=payload.department if payload.role == "student" else None,
            group=payload.group,
            password_hash=password_hash,
            password_changed=password_changed,
        )

        if user.role == "student":
            self._auto_enroll_student(user)

        self.db.commit()
        return user

    # ── listing ───────────────────────────────────────────────────────────────

    def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.repo.get_all(skip=skip, limit=limit)

    # ── update ────────────────────────────────────────────────────────────────

    def update_user(self, user_id: int, payload: UserUpdate, current_user: User) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if payload.name:
            user.name = payload.name
        if payload.email:
            if self.repo.exists_email(payload.email, exclude_id=user_id):
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = payload.email
        if payload.role:
            user.role = payload.role
        if payload.group is not None:
            user.group = payload.group
        if payload.year is not None:
            user.year = payload.year
        if payload.department is not None:
            user.department = payload.department
        if payload.password:
            validate_password_strength(payload.password)
            user.password_hash = get_password_hash(payload.password)

        # Re-validate year/department if either changed or role is student
        effective_role = payload.role or user.role
        if effective_role == "student":
            self._validate_student_fields(user.year, user.department)

        user = self.repo.save(user)
        self.db.commit()
        return user

    # ── delete ────────────────────────────────────────────────────────────────

    def delete_user(self, user_id: int, current_user: User) -> dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.id == current_user.id:
            raise HTTPException(
                status_code=403, detail="You cannot delete your own account"
            )

        if user.role == "student":
            self.repo.delete_attendance_by_student(user_id)
            self.repo.delete_enrollments_by_student(user_id)
        elif user.role == "teacher":
            session_ids = self.repo.get_session_ids_for_teacher(user_id)
            self.repo.delete_attendance_by_sessions(session_ids)
            self.repo.delete_sessions_by_teacher(user_id)
            self.repo.nullify_teacher_courses(user_id)

        self.repo.delete(user)
        self.db.commit()
        return {"detail": "User deleted"}

    # ── photo upload ──────────────────────────────────────────────────────────

    def upload_photo(self, student_id: int, file: UploadFile) -> User:
        student = self.repo.get_by_id(student_id)
        if not student or student.role != "student":
            raise HTTPException(status_code=404, detail="Student not found")
        photo_path, embedding = extract_face_embedding(file)
        student.photo_path = photo_path
        student.face_embedding = embedding
        student = self.repo.save(student)
        self.db.commit()
        return student

    def upload_student_photo(self, file: UploadFile, current_user: User) -> User:
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
        current_user = self.repo.save(current_user)
        self.db.commit()
        return current_user

    # ── password management ───────────────────────────────────────────────────

    def reset_password(self, payload: PasswordResetRequest, current_user: User) -> dict:
        user = self.repo.get_by_id(payload.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        validate_password_strength(payload.new_password)
        user.password_hash = get_password_hash(payload.new_password)
        user = self.repo.save(user)
        self.db.commit()
        return {"detail": "Password reset"}

    def change_password(self, current_password: str, new_password: str, current_user: User) -> User:
        if not verify_password(current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        validate_password_strength(new_password)
        current_user.password_hash = get_password_hash(new_password)
        current_user.password_changed = 1
        current_user = self.repo.save(current_user)
        self.db.commit()
        return current_user

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
            errors: list = []
            pending: list = []
            seen_emails: set = set()

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

                    email_lower = email.lower()
                    if email_lower in seen_emails:
                        errors.append(
                            f"Row {index + 2}: Email '{email}' is duplicated in this file"
                        )
                        continue
                    seen_emails.add(email_lower)

                    if self.repo.exists_email(email):
                        errors.append(f"Row {index + 2}: Email '{email}' already exists")
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

                    user_data: dict = {
                        "name": name,
                        "email": email,
                        "role": role,
                        "password_hash": get_password_hash("default123"),
                        "password_changed": 0,
                    }

                    if role == "student":
                        year_value = row.get("year")
                        dept_value = row.get("department")

                        if pd.isna(year_value) if year_value is not None else True:
                            errors.append(f"Row {index + 2}: year is required for students")
                            continue
                        if pd.isna(dept_value) if dept_value is not None else True:
                            errors.append(f"Row {index + 2}: department is required for students")
                            continue

                        try:
                            year = int(year_value)
                            department = str(dept_value).strip()
                            validate_year_department(year, department)
                        except HTTPException as e:
                            errors.append(f"Row {index + 2}: {e.detail}")
                            continue

                        user_data["year"] = year
                        user_data["department"] = department

                        if "group" in df.columns:
                            group_value = row.get("group")
                            if pd.notna(group_value):
                                user_data["group"] = str(group_value).strip()

                    pending.append(user_data)
                    created_count += 1

                except Exception as exc:
                    errors.append(f"Row {index + 2}: {exc}")

            if pending:
                self.repo.bulk_add(pending)
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
            raise HTTPException(status_code=400, detail=f"Error processing file: {exc}")
