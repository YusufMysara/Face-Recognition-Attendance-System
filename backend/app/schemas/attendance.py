from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

AttendanceStatus = Literal["present", "absent"]


class AttendanceBase(BaseModel):
    session_id: int
    student_id: int
    status: AttendanceStatus


class AttendanceEdit(BaseModel):
    attendance_id: int
    status: AttendanceStatus


class AttendanceResponse(AttendanceBase):
    id: int
    timestamp: datetime
    student_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RetakeRequest(BaseModel):
    session_id: int

