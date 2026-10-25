from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def require_timezone(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(
            "Datetime must include a timezone offset, for example "
            "2026-10-23T09:00:00+03:00"
        )
    return value


class AppointmentCreate(BaseModel):
    doctor_id: int = Field(gt=0)
    patient_id: int = Field(gt=0)
    start_time: datetime

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: datetime) -> datetime:
        return require_timezone(value)


class AppointmentReschedule(BaseModel):
    start_time: datetime

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: datetime) -> datetime:
        return require_timezone(value)


class AppointmentCancel(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AppointmentStatusUpdate(BaseModel):
    status: Literal["completed", "postponed"]


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    patient_id: int
    start_time: datetime
    end_time: datetime
    status: Literal["booked", "cancelled", "completed", "postponed"]
    cancellation_reason: str | None
    cancelled_at: datetime | None
    created_at: datetime


class AvailableSlot(BaseModel):
    start_time: datetime
    end_time: datetime


class AvailabilityRead(BaseModel):
    doctor_id: int
    date: date
    timezone: str
    slots: list[AvailableSlot]


class PatientAppointmentsRead(BaseModel):
    patient_id: int
    appointments: list[AppointmentRead]
