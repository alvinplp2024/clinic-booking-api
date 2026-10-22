from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ExcludeConstraint

from app.core.database import Base


class WorkingHours(Base):
    __tablename__ = "working_hours"
    __table_args__ = (
        CheckConstraint(
            "weekday >= 0 AND weekday <= 6",
            name="ck_working_hours_weekday",
        ),
        CheckConstraint(
            "start_time < end_time",
            name="ck_working_hours_valid_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Monday = 0, Sunday = 6.
    weekday: Mapped[int] = mapped_column(nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    doctor: Mapped["Doctor"] = relationship(back_populates="working_hours")


class ScheduleException(Base):
    __tablename__ = "schedule_exceptions"
    __table_args__ = (
        CheckConstraint(
            "(closed = true AND start_time IS NULL AND end_time IS NULL) OR "
            "(closed = false AND start_time IS NOT NULL AND "
            "end_time IS NOT NULL AND start_time < end_time)",
            name="ck_schedule_exception_valid_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exception_date: Mapped[date] = mapped_column(Date, nullable=False)
    # closed=True blocks the entire date.
    # Otherwise, start_time/end_time define an additional opening period.
    closed: Mapped[bool] = mapped_column(
        nullable=False, default=True, server_default="true"
    )
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)

    doctor: Mapped["Doctor"] = relationship(
        back_populates="schedule_exceptions"
    )


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        ExcludeConstraint(
            ("doctor_id", "="),
            (text("tstzrange(start_time, end_time, '[)')"), "&&"),
            where=text("status = 'booked'"),
            using="gist",
            name="ex_appointments_no_active_overlap",
        ),
        CheckConstraint(
            "end_time > start_time",
            name="ck_appointment_end_after_start",
        ),
        CheckConstraint(
            "status IN ('booked', 'cancelled')",
            name="ck_appointment_valid_status",
        ),
        # The exclusion constraint preventing overlaps will be added
        # in the PostgreSQL migration after enabling btree_gist.
        Index(
            "ix_appointments_doctor_start",
            "doctor_id",
            "start_time",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id"), nullable=False, index=True
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="booked", server_default="booked"
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    doctor: Mapped["Doctor"] = relationship(back_populates="appointments")
    patient: Mapped["Patient"] = relationship(back_populates="appointments")


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[Optional[int]] = mapped_column(nullable=True)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )


class AppointmentEvent(Base):
    __tablename__ = "appointment_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
