import json
from typing import List

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import (
    Attendance,
    Course,
    Session as SessionModel,
    StudentCourse,
    User,
)
from app.schemas.user import (
    PasswordResetRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.utils.face import extract_face_embedding
from app.utils.security import get_password_hash, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    # Handle password logic based on role and whether password is provided
    password_hash: str
    password_changed: int

    if payload.password:
        # Password provided - user has set their password
        password_hash = get_password_hash(payload.password)
        password_changed = 1
    else:
        # No password provided - use default like bulk upload
        if payload.role == "admin":
            raise HTTPException(status_code=400, detail="Password is required for admin accounts")
        password_hash = get_password_hash("default123")
        password_changed = 0  # User needs to change password

    user = User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        group=payload.group,
        password_hash=password_hash,
        password_changed=password_changed,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return db.query(User).all()


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check permissions for editing admin users
    if user.role == "admin" and current_user.email != "admin@example.com":
        # Regular admins can edit their own account (name, email, and password)
        if user.id != current_user.id:
            # Cannot edit other admin accounts at all
            if payload.name or payload.email or payload.password:
                raise HTTPException(status_code=403, detail="Regular admins cannot modify other admin accounts")
        # Note: When editing own account, all fields (name, email, password) are allowed

    # Check permissions for password changes (additional check for Super Admin)
    if payload.password:
        # Super Admin can change anyone's password
        if current_user.email == "admin@example.com":
            pass  # Allow Super Admin to change any password
        else:
            # Regular admins can only change passwords of students, teachers, and themselves
            if user.role == "admin" and user.id != current_user.id:
                raise HTTPException(status_code=403, detail="Regular admins cannot change other admin passwords")
            # Prevent changing Super Admin password
            if user.email == "admin@example.com" or user.name == "Super Admin":
                raise HTTPException(status_code=403, detail="Super Admin password can only be changed by Super Admin himself")

    # Prevent modification of Super Admin's critical fields
    if user.email == "admin@example.com" or user.name == "Super Admin":
        if payload.role and payload.role != "admin":
            raise HTTPException(status_code=403, detail="Super Admin role cannot be changed")
        # Allow changes to name, email, and password only if Super Admin is editing his own account
        if payload.name and current_user.email != "admin@example.com":
            raise HTTPException(status_code=403, detail="Super Admin name can only be changed by Super Admin himself")
        if payload.email and current_user.email != "admin@example.com":
            raise HTTPException(status_code=403, detail="Super Admin email can only be changed by Super Admin himself")

    if payload.name:
        user.name = payload.name
    if payload.email:
        if (
            db.query(User)
            .filter(User.email == payload.email, User.id != user_id)
            .first()
        ):
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email
    if payload.group is not None:
        user.group = payload.group
    if payload.role:
        user.role = payload.role
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Super Admin can delete anyone
    if current_user.email == "admin@example.com":
        pass  # Allow Super Admin to delete any account
    else:
        # Regular admins can only delete students and teachers
        if user.role == "admin":
            raise HTTPException(status_code=403, detail="Regular admins cannot delete admin accounts")
        # Prevent admins from deleting themselves
        if user.id == current_user.id:
            raise HTTPException(status_code=403, detail="You cannot delete your own account")

    # Prevent deletion of Super Admin (additional check)
    if user.email == "admin@example.com" or user.name == "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin account cannot be deleted")

    if user.role == "student":
        (
            db.query(Attendance)
            .filter(Attendance.student_id == user_id)
            .delete(synchronize_session=False)
        )
        (
            db.query(StudentCourse)
            .filter(StudentCourse.student_id == user_id)
            .delete(synchronize_session=False)
        )
    elif user.role == "teacher":
        session_ids_subq = (
            db.query(SessionModel.id).filter(SessionModel.teacher_id == user_id)
        ).subquery()
        if session_ids_subq is not None:
            (
                db.query(Attendance)
                .filter(Attendance.session_id.in_(session_ids_subq))
                .delete(synchronize_session=False)
            )
        (
            db.query(SessionModel)
            .filter(SessionModel.teacher_id == user_id)
            .delete(synchronize_session=False)
        )
        (
            db.query(Course)
            .filter(Course.teacher_id == user_id)
            .update({Course.teacher_id: None}, synchronize_session=False)
        )

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@router.post("/users/photo", response_model=UserResponse)
def upload_photo(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    photo_path, embedding = extract_face_embedding(file)
    student.photo_path = photo_path
    student.face_embedding = embedding
    db.commit()
    db.refresh(student)
    return student


@router.post("/students/photo", response_model=UserResponse)
def upload_student_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only students can upload their own photos
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can upload photos")

    # Check if student already has a photo uploaded
    if current_user.photo_path:
        raise HTTPException(status_code=400, detail="Photo already uploaded. You can only upload one photo.")

    photo_path, embedding = extract_face_embedding(file)
    current_user.photo_path = photo_path
    current_user.face_embedding = embedding
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/reset-password")
def reset_password(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Super Admin can reset anyone's password
    if current_user.email == "admin@example.com":
        pass  # Allow Super Admin to reset any password
    else:
        # Regular admins can only reset passwords of students, teachers, and themselves
        if user.role == "admin":
            raise HTTPException(status_code=403, detail="Regular admins cannot reset other admin passwords")
        # Prevent resetting Super Admin password
        if user.email == "admin@example.com" or user.name == "Super Admin":
            raise HTTPException(status_code=403, detail="Super Admin password can only be changed by Super Admin himself")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": "Password reset"}


@router.post("/change-password", response_model=UserResponse)
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify current password
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update password
    current_user.password_hash = get_password_hash(new_password)
    current_user.password_changed = 1  # Mark as changed
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/bulk-upload")
def bulk_upload_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")

    try:
        # Read the file content into bytes
        file_content = file.file.read()
        # Create a BytesIO object for pandas
        from io import BytesIO
        file_buffer = BytesIO(file_content)

        # Read Excel file
        df = pd.read_excel(file_buffer)

        # Validate required columns
        required_columns = ['name', 'email', 'role']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}. Required: name, email, role"
            )

        created_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                # Validate email - handle NaN values
                email_value = row['email']
                if pd.isna(email_value):
                    errors.append(f"Row {index + 2}: Email is required")
                    continue

                email = str(email_value).strip()
                if not email or email.lower() == 'nan':
                    errors.append(f"Row {index + 2}: Email is required")
                    continue

                if db.query(User).filter(User.email == email).first():
                    errors.append(f"Row {index + 2}: Email '{email}' already exists")
                    continue

                # Check permissions for creating admin users
                role = str(row['role']).strip().lower()
                if role == 'admin' and current_user.email != "admin@example.com":
                    errors.append(f"Row {index + 2}: Only Super Admin can create admin users")
                    continue

                # Validate name
                name_value = row['name']
                if pd.isna(name_value):
                    errors.append(f"Row {index + 2}: Name is required")
                    continue

                name = str(name_value).strip()
                if not name or name.lower() == 'nan':
                    errors.append(f"Row {index + 2}: Name is required")
                    continue

                # Validate role
                role_value = row.get('role')
                if pd.isna(role_value):
                    errors.append(f"Row {index + 2}: Role is required")
                    continue

                role = str(role_value).strip().lower()
                if not role or role.lower() == 'nan':
                    errors.append(f"Row {index + 2}: Role is required")
                    continue

                if role not in ['admin', 'teacher', 'student']:
                    errors.append(f"Row {index + 2}: Invalid role '{role}'. Must be 'admin', 'teacher', or 'student'")
                    continue

                # Check permissions for creating admin users
                if role == 'admin' and current_user.email != "admin@example.com":
                    errors.append(f"Row {index + 2}: Only Super Admin can create admin users")
                    continue

                # Create user
                user_data = {
                    'name': name,
                    'email': email,
                    'role': role,
                    'password_hash': get_password_hash("default123"),  # Default password
                    'password_changed': 0,  # Mark as not changed
                }

                # Add group for students
                if user_data['role'] == 'student' and 'group' in df.columns:
                    group_value = row.get('group')
                    if pd.notna(group_value):
                        user_data['group'] = str(group_value).strip()

                user = User(**user_data)
                db.add(user)
                created_count += 1

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")

        db.commit()

        return {
            "created_count": created_count,
            "errors": errors,
            "message": f"Successfully created {created_count} users" + (f" with {len(errors)} errors" if errors else "")
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

