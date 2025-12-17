from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AttendanceBase(BaseModel):
    session_id: int
    student_id: int
    status: str


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceEdit(BaseModel):
    attendance_id: int
    status: str


class AttendanceResponse(AttendanceBase):
    id: int
    timestamp: datetime
    student_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceBulkRequest(BaseModel):
    records: List[AttendanceBase]


class FaceMarkRequest(BaseModel):
    session_id: int
    embedding: List[float]


class RetakeRequest(BaseModel):
    session_id: int

