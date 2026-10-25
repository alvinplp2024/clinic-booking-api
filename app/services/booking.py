from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Appointment,
    AppointmentEvent,
    Doctor,
    Patient,
    ScheduleException,
    WorkingHours,
)
from app.schemas.appointment import AvailableSlot
from app.services.errors import BookingError


CLINIC_TIMEZONE = ZoneInfo(settings.timezone)
SLOT_DURATION = timedelta(minutes=30)
BOOKING_CUTOFF = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(CLINIC_TIMEZONE)


def _local_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise BookingError(
            "A timezone-aware datetime is required.",
            422,
            "timezone_required",
        )
    return value.astimezone(CLINIC_TIMEZONE)


def _validate_slot_boundary(start: datetime) -> None:
    if (
        start.minute not in (0, 30)
        or start.second != 0
        or start.microsecond != 0
    ):
        raise BookingError(
            "Appointments must start on the hour or half-hour.",
            422,
            "invalid_slot_boundary",
        )


def _get_doctor(db: Session, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.is_active:
        raise BookingError("Doctor not found or inactive.", 404, "doctor_unavailable")
    return doctor


def _periods_for_date(
    db: Session, doctor_id: int, target_date: date
) -> list[tuple[time, time]]:
    """Return opening periods for a date, respecting full-day closures."""
    weekday = target_date.weekday()

    regular_periods = db.scalars(
        select(WorkingHours).where(
            WorkingHours.doctor_id == doctor_id,
            WorkingHours.weekday == weekday,
        )
    ).all()

    exceptions = db.scalars(
        select(ScheduleException).where(
            ScheduleException.doctor_id == doctor_id,
            ScheduleException.exception_date == target_date,
        )
    ).all()

    if any(exception.closed for exception in exceptions):
        return []

    periods = [
        (period.start_time, period.end_time)
        for period in regular_periods
    ]

    # A non-closed exception adds an extra opening period for that date.
    periods.extend(
        (exception.start_time, exception.end_time)
        for exception in exceptions
        if (
            not exception.closed
            and exception.start_time is not None
            and exception.end_time is not None
        )
    )

    return sorted(periods, key=lambda period: period[0])


def _fits_schedule(
    db: Session, doctor_id: int, start: datetime
) -> bool:
    periods = _periods_for_date(db, doctor_id, start.date())
    local_start_time = start.timetz().replace(tzinfo=None)
    local_end_time = (start + SLOT_DURATION).timetz().replace(tzinfo=None)

    return any(
        period_start <= local_start_time
        and local_end_time <= period_end
        for period_start, period_end in periods
    )


def _active_appointments_for_date(
    db: Session,
    doctor_id: int,
    target_date: date,
    exclude_appointment_id: int | None = None,
) -> list[Appointment]:
    day_start = datetime.combine(
        target_date, time.min, tzinfo=CLINIC_TIMEZONE
    )
    day_end = day_start + timedelta(days=1)

    statement = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.status == "booked",
        Appointment.start_time < day_end,
        Appointment.end_time > day_start,
    )

    if exclude_appointment_id is not None:
        statement = statement.where(
            Appointment.id != exclude_appointment_id
        )

    return list(db.scalars(statement).all())


def _available_slots(
    db: Session,
    doctor_id: int,
    target_date: date,
    exclude_appointment_id: int | None = None,
) -> list[AvailableSlot]:
    doctor = _get_doctor(db, doctor_id)
    if not doctor:
        return []

    cutoff = _now() + BOOKING_CUTOFF
    occupied = _active_appointments_for_date(
        db, doctor_id, target_date, exclude_appointment_id
    )

    slots: list[AvailableSlot] = []

    for period_start, period_end in _periods_for_date(
        db, doctor_id, target_date
    ):
        candidate = datetime.combine(
            target_date, period_start, tzinfo=CLINIC_TIMEZONE
        )
        period_end_dt = datetime.combine(
            target_date, period_end, tzinfo=CLINIC_TIMEZONE
        )

        while candidate + SLOT_DURATION <= period_end_dt:
            end = candidate + SLOT_DURATION

            if candidate.minute in (0, 30) and candidate >= cutoff:
                overlaps = any(
                    appointment.start_time < end
                    and appointment.end_time > candidate
                    for appointment in occupied
                )

                if not overlaps:
                    slots.append(
                        AvailableSlot(start_time=candidate, end_time=end)
                    )

            candidate += SLOT_DURATION

    # Extra opening periods can overlap regular periods; deduplicate results.
    unique_slots = {
        slot.start_time: slot for slot in slots
    }
    return sorted(unique_slots.values(), key=lambda slot: slot.start_time)


def get_availability(
    db: Session, doctor_id: int, target_date: date
) -> list[AvailableSlot]:
    _get_doctor(db, doctor_id)
    return _available_slots(db, doctor_id, target_date)


def _require_bookable_slot(
    db: Session,
    doctor_id: int,
    start: datetime,
    exclude_appointment_id: int | None = None,
) -> datetime:
    local_start = _local_datetime(start)
    _validate_slot_boundary(local_start)

    if local_start < _now() + BOOKING_CUTOFF:
        raise BookingError(
            "Bookings must be made at least one hour in advance.",
            422,
            "booking_cutoff",
        )

    _get_doctor(db, doctor_id)

    if not _fits_schedule(db, doctor_id, local_start):
        raise BookingError(
            "The requested time is outside the doctor's working hours.",
            422,
            "outside_working_hours",
        )

    end = local_start + SLOT_DURATION
    existing = _active_appointments_for_date(
        db, doctor_id, local_start.date(), exclude_appointment_id
    )

    if any(
        appointment.start_time < end
        and appointment.end_time > local_start
        for appointment in existing
    ):
        raise BookingError(
            "The requested appointment slot is already taken.",
            409,
            "slot_unavailable",
        )

    return local_start


def create_booking(
    db: Session,
    doctor_id: int,
    patient_id: int,
    start_time: datetime,
) -> Appointment:
    try:
        with db.begin():
            patient = db.get(Patient, patient_id)

            if patient is None or not patient.is_active:
                raise BookingError(
                    "Patient not found or inactive.", 404, "patient_unavailable"
                )

            local_start = _require_bookable_slot(
                db, doctor_id, start_time
            )
            appointment = Appointment(
                doctor_id=doctor_id,
                patient_id=patient.id,
                start_time=local_start,
                end_time=local_start + SLOT_DURATION,
                status="booked",
            )
            db.add(appointment)
            db.flush()

            db.add(
                AppointmentEvent(
                    appointment_id=appointment.id,
                    event_type="booked",
                    details="Appointment created.",
                )
            )
            db.flush()

        return appointment
    except IntegrityError as exc:
        raise BookingError(
            "The slot conflicts with another booking. Please choose another time.",
            409,
            "slot_conflict",
        ) from exc


def cancel_booking(
    db: Session, appointment_id: int, reason: str
) -> Appointment:
    try:
        with db.begin():
            appointment = db.get(Appointment, appointment_id)

            if appointment is None:
                raise BookingError(
                    "Appointment not found.", 404, "appointment_not_found"
                )
            if appointment.status == "cancelled":
                raise BookingError(
                    "Appointment is already cancelled.",
                    409,
                    "already_cancelled",
                )

            appointment.status = "cancelled"
            appointment.cancellation_reason = reason
            appointment.cancelled_at = _now()

            db.add(
                AppointmentEvent(
                    appointment_id=appointment.id,
                    event_type="cancelled",
                    details=reason,
                )
            )
            db.flush()

        return appointment
    except IntegrityError as exc:
        raise BookingError(
            "Unable to cancel the appointment.", 409, "cancellation_conflict"
        ) from exc


def reschedule_booking(
    db: Session, appointment_id: int, new_start_time: datetime
) -> Appointment:
    try:
        with db.begin():
            appointment = db.get(Appointment, appointment_id)

            if appointment is None:
                raise BookingError(
                    "Appointment not found.", 404, "appointment_not_found"
                )
            if appointment.status == "cancelled":
                raise BookingError(
                    "A cancelled appointment cannot be rescheduled.",
                    409,
                    "appointment_cancelled",
                )
            if appointment.status in ("completed", "postponed"):
                raise BookingError(
                    f"A {appointment.status} appointment cannot be rescheduled.",
                    409,
                    "invalid_status_transition",
                )

            new_start = _require_bookable_slot(
                db,
                appointment.doctor_id,
                new_start_time,
                exclude_appointment_id=appointment.id,
            )

            old_start = appointment.start_time
            appointment.start_time = new_start
            appointment.end_time = new_start + SLOT_DURATION

            db.add(
                AppointmentEvent(
                    appointment_id=appointment.id,
                    event_type="rescheduled",
                    details=(
                        f"Previous start: {old_start.isoformat()}; "
                        f"new start: {new_start.isoformat()}"
                    ),
                )
            )
            db.flush()

        return appointment
    except IntegrityError as exc:
        raise BookingError(
            "The new slot conflicts with another booking.",
            409,
            "slot_conflict",
        ) from exc


def update_appointment_status(
    db: Session, appointment_id: int, new_status: str
) -> Appointment:
    with db.begin():
        appointment = db.get(Appointment, appointment_id)
        if appointment is None:
            raise BookingError("Appointment not found.", 404, "appointment_not_found")
        if appointment.status != "booked":
            raise BookingError(
                f"Only booked appointments can be marked {new_status}.",
                409,
                "invalid_status_transition",
            )
        appointment.status = new_status
        db.add(AppointmentEvent(
            appointment_id=appointment.id,
            event_type=new_status,
            details=f"Status manually set to {new_status}.",
        ))
        db.flush()
    db.refresh(appointment)
    return appointment


def get_patient_appointments(
    db: Session, patient_id: int
) -> list[Appointment]:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise BookingError("Patient not found.", 404, "patient_not_found")

    statement = (
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.start_time.asc())
    )
    return list(db.scalars(statement).all())
