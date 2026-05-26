from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr

UserRole = Literal["admin", "teacher", "student"]


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    group: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None


class UserUpdate(BaseModel):
    """Partial-patch schema — every field is optional, no inheritance from UserBase."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
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
