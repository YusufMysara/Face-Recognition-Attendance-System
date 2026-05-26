from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AttendanceBase(BaseModel):
    session_id: int
    student_id: int
    status: str


class AttendanceEdit(BaseModel):
    attendance_id: int
    status: str


class AttendanceResponse(AttendanceBase):
    id: int
    timestamp: datetime
    student_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RetakeRequest(BaseModel):
    session_id: int

