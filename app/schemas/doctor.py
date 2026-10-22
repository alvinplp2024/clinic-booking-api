import re
from datetime import time
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

_PHONE_RE = re.compile(r"^\+?[0-9\s\-().]{7,20}$")


def _normalize_phone(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip())

WEEKDAY_NAMES = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
]


class DoctorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    specialty: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool


class DoctorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    specialty: str = Field(min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=1, max_length=30)

    @model_validator(mode="after")
    def validate_contacts(self) -> "DoctorCreate":
        email = (self.email or "").strip()
        phone = (self.phone or "").strip()
        if phone and not _PHONE_RE.match(phone):
            raise ValueError(
                "Phone must be 7–20 characters and contain only digits, "
                "spaces, +, -, (, or )."
            )
        if email:
            self.email = email.lower()
        if phone:
            self.phone = _normalize_phone(phone)
        return self


class WorkingPeriodCreate(BaseModel):
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def end_after_start(self) -> "WorkingPeriodCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class WorkingPeriodRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    weekday: int
    start_time: time
    end_time: time


class WeekdayScheduleUpdate(BaseModel):
    periods: list[WorkingPeriodCreate] = Field(default_factory=list)


class WeekdayScheduleRead(BaseModel):
    doctor_id: int
    weekday: int
    weekday_name: str
    periods: list[WorkingPeriodRead]


class DoctorScheduleRead(BaseModel):
    doctor_id: int
    schedule: list[WorkingPeriodRead]
