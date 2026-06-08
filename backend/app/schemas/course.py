from typing import Optional

from pydantic import BaseModel, ConfigDict


class CourseBase(BaseModel):
    name: str
    description: str
    year: int
    department: str
    teacher_id: Optional[int] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    """Partial-patch schema — every field is optional, no inheritance from CourseBase."""
    name: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = None
    department: Optional[str] = None
    teacher_id: Optional[int] = None


class CourseResponse(CourseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CourseAssignment(BaseModel):
    student_id: int
    course_id: int


class TeacherAssignment(BaseModel):
    teacher_id: int
    course_id: int
