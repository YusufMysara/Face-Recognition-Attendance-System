from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: int
    role: str
    exp: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserInfo(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    group: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    user: UserInfo
    token: Token

