from fastapi import APIRouter, Depends, Path, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Appointment, Doctor, Patient, WorkingHours
from app.schemas import (
    DoctorCreate,
    DoctorRead,
    DoctorScheduleRead,
    PatientCreate,
    PatientRead,
    WeekdayScheduleRead,
    WeekdayScheduleUpdate,
    WorkingPeriodRead,
)
from app.schemas.doctor import WEEKDAY_NAMES
from app.services.errors import BookingError

router = APIRouter(tags=["Registration"])


@router.post(
    "/doctors",
    response_model=DoctorRead,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
) -> Doctor:
    doctor = Doctor(
        name=payload.name.strip(),
        specialty=payload.specialty.strip(),
        email=payload.email or None,
        phone=payload.phone or None,
    )
    db.add(doctor)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = str(exc.orig).lower() if exc.orig else ""
        if "phone" in detail:
            raise BookingError(
                "A doctor with this phone number already exists.",
                409,
                "duplicate_phone",
            ) from exc
        raise BookingError(
            "A doctor with this email already exists.",
            409,
            "duplicate_email",
        ) from exc

    db.refresh(doctor)
    return doctor


@router.get("/doctors", response_model=list[DoctorRead])
def list_doctors(
    db: Session = Depends(get_db),
) -> list[Doctor]:
    statement = (
        select(Doctor)
        .where(Doctor.is_active.is_(True))
        .order_by(Doctor.name.asc(), Doctor.id.asc())
    )
    return list(db.scalars(statement).all())


def _get_active_doctor(db: Session, doctor_id: int) -> Doctor:
    doctor = db.get(Doctor, doctor_id)
    if doctor is None or not doctor.is_active:
        raise BookingError("Doctor not found or inactive.", 404, "doctor_unavailable")
    return doctor


@router.delete("/doctors/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
) -> None:
    doctor = _get_active_doctor(db, doctor_id)
    if db.scalars(select(Appointment).where(Appointment.doctor_id == doctor_id).limit(1)).first():
        raise BookingError(
            "Cannot delete a doctor who has appointments.", 409, "doctor_has_appointments"
        )
    db.delete(doctor)
    db.commit()


@router.get(
    "/doctors/{doctor_id}/schedule",
    response_model=DoctorScheduleRead,
)
def get_doctor_schedule(
    doctor_id: int,
    db: Session = Depends(get_db),
) -> DoctorScheduleRead:
    _get_active_doctor(db, doctor_id)
    rows = db.scalars(
        select(WorkingHours)
        .where(WorkingHours.doctor_id == doctor_id)
        .order_by(WorkingHours.weekday.asc(), WorkingHours.start_time.asc())
    ).all()
    return DoctorScheduleRead(
        doctor_id=doctor_id,
        schedule=[WorkingPeriodRead.model_validate(r) for r in rows],
    )


@router.put(
    "/doctors/{doctor_id}/schedule/{weekday}",
    response_model=WeekdayScheduleRead,
)
def set_weekday_schedule(
    doctor_id: int,
    weekday: int = Path(ge=0, le=6),
    payload: WeekdayScheduleUpdate = ...,
    db: Session = Depends(get_db),
) -> WeekdayScheduleRead:
    _get_active_doctor(db, doctor_id)

    # Validate no overlaps within the submitted periods.
    sorted_periods = sorted(payload.periods, key=lambda p: p.start_time)
    for i in range(len(sorted_periods) - 1):
        if sorted_periods[i].end_time > sorted_periods[i + 1].start_time:
            raise BookingError(
                "Submitted periods overlap each other.",
                422,
                "overlapping_periods",
            )

    # Replace all existing periods for this doctor+weekday atomically.
    try:
        existing = db.scalars(
            select(WorkingHours).where(
                WorkingHours.doctor_id == doctor_id,
                WorkingHours.weekday == weekday,
            )
        ).all()
        for row in existing:
            db.delete(row)
        db.flush()

        new_rows: list[WorkingHours] = []
        for period in sorted_periods:
            row = WorkingHours(
                doctor_id=doctor_id,
                weekday=weekday,
                start_time=period.start_time,
                end_time=period.end_time,
            )
            db.add(row)
            new_rows.append(row)

        db.commit()
        for row in new_rows:
            db.refresh(row)
    except Exception:
        db.rollback()
        raise

    return WeekdayScheduleRead(
        doctor_id=doctor_id,
        weekday=weekday,
        weekday_name=WEEKDAY_NAMES[weekday],
        periods=[WorkingPeriodRead.model_validate(r) for r in new_rows],
    )


@router.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
) -> None:
    patient = db.get(Patient, patient_id)
    if patient is None or not patient.is_active:
        raise BookingError("Patient not found or inactive.", 404, "patient_not_found")
    has_appointments = db.scalars(
        select(Appointment).where(Appointment.patient_id == patient_id).limit(1)
    ).first()
    if has_appointments:
        raise BookingError(
            "Cannot delete a patient who has appointments.",
            409,
            "patient_has_appointments",
        )
    db.delete(patient)
    db.commit()


@router.get("/patients", response_model=list[PatientRead])
def list_patients(
    db: Session = Depends(get_db),
) -> list[Patient]:
    statement = (
        select(Patient)
        .where(Patient.is_active.is_(True))
        .order_by(Patient.name.asc(), Patient.id.asc())
    )
    return list(db.scalars(statement).all())


@router.post(
    "/patients",
    response_model=PatientRead,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
) -> Patient:
    patient = Patient(
        name=payload.name.strip(),
        email=payload.email or None,
        phone=payload.phone or None,
    )
    db.add(patient)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = str(exc.orig).lower() if exc.orig else ""
        if "phone" in detail:
            raise BookingError(
                "A patient with this phone number already exists.",
                409,
                "duplicate_phone",
            ) from exc
        raise BookingError(
            "A patient with this email already exists.",
            409,
            "duplicate_email",
        ) from exc

    db.refresh(patient)
    return patient
