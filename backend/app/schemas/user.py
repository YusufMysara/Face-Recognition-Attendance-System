from typing import Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr

UserRole = Literal["admin", "teacher", "student"]

VALID_DEPARTMENTS_YEAR_3_4 = {
    "Software Engineering",
    "Cyber Security",
    "Computer Science",
    "Data Science",
    "Artificial Intelligence",
}


def validate_year_department(year: int, department: str) -> None:
    if year not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="Year must be 1, 2, 3, or 4")
    if year in (1, 2) and department != "General":
        raise HTTPException(
            status_code=400,
            detail="Students in year 1 or 2 must have department 'General'",
        )
    if year in (3, 4) and department not in VALID_DEPARTMENTS_YEAR_3_4:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid department for year {year}. "
                f"Must be one of: {', '.join(sorted(VALID_DEPARTMENTS_YEAR_3_4))}"
            ),
        )


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    year: Optional[int] = None
    department: Optional[str] = None
    group: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None


class UserUpdate(BaseModel):
    """Partial-patch schema — every field is optional, no inheritance from UserBase."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    year: Optional[int] = None
    department: Optional[str] = None
    group: Optional[str] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    photo_path: Optional[str] = None
    password_changed: bool = False

    model_config = ConfigDict(from_attributes=True)


class PasswordResetRequest(BaseModel):
    user_id: int
    new_password: str
