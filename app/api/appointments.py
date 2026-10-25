from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentRead,
    AppointmentReschedule,
    AppointmentStatusUpdate,
    AvailabilityRead,
    PatientAppointmentsRead,
)
from app.services.booking import (
    cancel_booking,
    create_booking,
    get_availability,
    get_patient_appointments,
    reschedule_booking,
    update_appointment_status,
)

router = APIRouter(tags=["Appointments"])


@router.get(
    "/doctors/{doctor_id}/availability",
    response_model=AvailabilityRead,
)
def doctor_availability(
    doctor_id: int,
    target_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
) -> AvailabilityRead:
    slots = get_availability(db, doctor_id, target_date)
    return AvailabilityRead(
        doctor_id=doctor_id,
        date=target_date,
        timezone=settings.timezone,
        slots=slots,
    )


@router.post(
    "/appointments",
    response_model=AppointmentRead,
    status_code=status.HTTP_201_CREATED,
)
def book_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
) -> AppointmentRead:
    return create_booking(
        db,
        doctor_id=payload.doctor_id,
        patient_id=payload.patient_id,
        start_time=payload.start_time,
    )


@router.patch(
    "/appointments/{appointment_id}/status",
    response_model=AppointmentRead,
)
def update_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
) -> AppointmentRead:
    return update_appointment_status(db, appointment_id, payload.status)


@router.patch(
    "/appointments/{appointment_id}/cancel",
    response_model=AppointmentRead,
)
def cancel_appointment(
    appointment_id: int,
    payload: AppointmentCancel,
    db: Session = Depends(get_db),
) -> AppointmentRead:
    return cancel_booking(db, appointment_id, payload.reason.strip())


@router.patch(
    "/appointments/{appointment_id}/reschedule",
    response_model=AppointmentRead,
)
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentReschedule,
    db: Session = Depends(get_db),
) -> AppointmentRead:
    return reschedule_booking(
        db,
        appointment_id,
        payload.start_time,
    )


@router.get(
    "/patients/{patient_id}/appointments",
    response_model=PatientAppointmentsRead,
)
def patient_upcoming_appointments(
    patient_id: int,
    db: Session = Depends(get_db),
) -> PatientAppointmentsRead:
    appointments = get_patient_appointments(db, patient_id)
    return PatientAppointmentsRead(
        patient_id=patient_id,
        appointments=appointments,
    )
