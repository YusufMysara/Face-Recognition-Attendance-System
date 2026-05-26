from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

SessionStatus = Literal["open", "closed", "submitted"]


class SessionBase(BaseModel):
    course_id: int


class SessionCreate(SessionBase):
    pass


class SessionResponse(SessionBase):
    id: int
    teacher_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    status: SessionStatus

    model_config = ConfigDict(from_attributes=True)
