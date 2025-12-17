from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    group: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    group: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    photo_path: Optional[str] = None
    password_changed: bool = False

    model_config = ConfigDict(from_attributes=True)


class PasswordResetRequest(BaseModel):
    user_id: int
    new_password: str

