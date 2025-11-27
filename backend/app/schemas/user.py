from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    group: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    group: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    photo_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PasswordResetRequest(BaseModel):
    user_id: int
    new_password: str

