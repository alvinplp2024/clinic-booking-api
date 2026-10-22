from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.models import Doctor, Patient, WorkingHours

NAIROBI = ZoneInfo("Africa/Nairobi")


@pytest.fixture
def clinic_setup(db_session):
    """Create a doctor and patient with working hours on a future date."""
    now = datetime.now(NAIROBI)
    target_date = (now + timedelta(days=3)).date()

    doctor = Doctor(
        name="Dr Alvin Ondieki",
        specialty="General Practice",
        is_active=True,
    )
    patient = Patient(
        name="Alvin Ondieki",
        email="alvinondieki5@gmail.com",
        is_active=True,
    )
    db_session.add_all([doctor, patient])
    db_session.flush()

    db_session.add(
        WorkingHours(
            doctor_id=doctor.id,
            weekday=target_date.weekday(),
            start_time=time(8, 0),
            end_time=time(17, 0),
        )
    )
    db_session.commit()

    return {
        "doctor_id": doctor.id,
        "patient_id": patient.id,
        "target_date": target_date,
    }


def future_slot(target_date, hour, minute=0):
    return datetime.combine(
        target_date,
        time(hour, minute),
        tzinfo=NAIROBI,
    )


def book(client, clinic_setup, start_time):
    return client.post(
        "/appointments",
        json={
            "doctor_id": clinic_setup["doctor_id"],
            "patient_id": clinic_setup["patient_id"],
            "start_time": start_time.isoformat(),
        },
    )


def test_book_appointment_and_return_thirty_minute_duration(
    client, clinic_setup
):
    start = future_slot(clinic_setup["target_date"], 10)

    response = book(client, clinic_setup, start)

    assert response.status_code == 201, response.text
    appointment = response.json()
    assert appointment["status"] == "booked"
    assert appointment["doctor_id"] == clinic_setup["doctor_id"]
    assert appointment["patient_id"] == clinic_setup["patient_id"]
    assert datetime.fromisoformat(appointment["end_time"]) == (
        start + timedelta(minutes=30)
    )


def test_reject_conflicting_booking(client, clinic_setup):
    start = future_slot(clinic_setup["target_date"], 10)

    first = book(client, clinic_setup, start)
    second = book(client, clinic_setup, start)

    assert first.status_code == 201, first.text
    assert second.status_code == 409
    assert second.json()["error"]["code"] in {
        "slot_unavailable",
        "slot_conflict",
    }


def test_reject_booking_outside_working_hours(client, clinic_setup):
    start = future_slot(clinic_setup["target_date"], 17)

    response = book(client, clinic_setup, start)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "outside_working_hours"


def test_reject_booking_without_timezone(client, clinic_setup):
    start = future_slot(clinic_setup["target_date"], 10).replace(tzinfo=None)

    response = client.post(
        "/appointments",
        json={
            "doctor_id": clinic_setup["doctor_id"],
            "patient_id": clinic_setup["patient_id"],
            "start_time": start.isoformat(),
        },
    )

    assert response.status_code == 422


def test_cancel_appointment_and_release_slot(client, clinic_setup):
    start = future_slot(clinic_setup["target_date"], 10)
    created = book(client, clinic_setup, start)
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]

    cancelled = client.patch(
        f"/appointments/{appointment_id}/cancel",
        json={"reason": "Patient requested cancellation"},
    )

    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancellation_reason"] == (
        "Patient requested cancellation"
    )

    repeated = client.patch(
        f"/appointments/{appointment_id}/cancel",
        json={"reason": "Cancel again"},
    )
    assert repeated.status_code == 409
    assert repeated.json()["error"]["code"] == "already_cancelled"

    replacement = book(client, clinic_setup, start)
    assert replacement.status_code == 201, replacement.text


def test_reschedule_appointment_to_an_available_slot(client, clinic_setup):
    original_start = future_slot(clinic_setup["target_date"], 10)
    new_start = future_slot(clinic_setup["target_date"], 11)

    created = book(client, clinic_setup, original_start)
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]

    response = client.patch(
        f"/appointments/{appointment_id}/reschedule",
        json={"start_time": new_start.isoformat()},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "booked"
    assert datetime.fromisoformat(response.json()["start_time"]) == new_start

    # Rescheduling frees the original slot.
    replacement = book(client, clinic_setup, original_start)
    assert replacement.status_code == 201, replacement.text


def test_cannot_reschedule_cancelled_appointment(client, clinic_setup):
    original_start = future_slot(clinic_setup["target_date"], 10)
    created = book(client, clinic_setup, original_start)
    assert created.status_code == 201, created.text
    appointment_id = created.json()["id"]

    cancelled = client.patch(
        f"/appointments/{appointment_id}/cancel",
        json={"reason": "No longer needed"},
    )
    assert cancelled.status_code == 200, cancelled.text

    response = client.patch(
        f"/appointments/{appointment_id}/reschedule",
        json={
            "start_time": future_slot(
                clinic_setup["target_date"], 11
            ).isoformat()
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "appointment_cancelled"


def test_availability_excludes_booked_slots(client, clinic_setup):
    start = future_slot(clinic_setup["target_date"], 10)
    created = book(client, clinic_setup, start)
    assert created.status_code == 201, created.text

    response = client.get(
        f"/doctors/{clinic_setup['doctor_id']}/availability",
        params={"date": clinic_setup["target_date"].isoformat()},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["timezone"] == "Africa/Nairobi"
    available_starts = {
        datetime.fromisoformat(slot["start_time"])
        for slot in data["slots"]
    }
    assert start not in available_starts


def test_patient_upcoming_appointments_are_sorted(client, clinic_setup):
    earlier = future_slot(clinic_setup["target_date"], 10)
    later = future_slot(clinic_setup["target_date"], 12)

    first = book(client, clinic_setup, later)
    second = book(client, clinic_setup, earlier)
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    response = client.get(
        f"/patients/{clinic_setup['patient_id']}/appointments"
    )

    assert response.status_code == 200, response.text
    appointments = response.json()["appointments"]
    returned_starts = [
        datetime.fromisoformat(item["start_time"])
        for item in appointments
    ]
    assert returned_starts == sorted(returned_starts)
    assert len(returned_starts) == 2


def test_reject_booking_on_non_half_hour_boundary(client, clinic_setup):
    """10:15 is not on a 30-minute boundary and must be rejected."""
    start = future_slot(clinic_setup["target_date"], 10, 15)

    response = book(client, clinic_setup, start)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_slot_boundary"


def test_closed_exception_produces_no_slots(client, clinic_setup, db_session):
    """A closed=True ScheduleException blocks all slots for that date."""
    from app.models import ScheduleException

    db_session.add(ScheduleException(
        doctor_id=clinic_setup["doctor_id"],
        exception_date=clinic_setup["target_date"],
        closed=True,
    ))
    db_session.commit()

    response = client.get(
        f"/doctors/{clinic_setup['doctor_id']}/availability",
        params={"date": clinic_setup["target_date"].isoformat()},
    )

    assert response.status_code == 200
    assert response.json()["slots"] == []


def test_extra_opening_exception_adds_slots_outside_normal_hours(
    client, clinic_setup, db_session
):
    """
    A closed=False ScheduleException with start_time/end_time adds an extra
    opening period for that date. Slots in that extra period appear in
    availability even though they are outside the regular 08:00-17:00 window.
    """
    from datetime import time as dtime
    from app.models import ScheduleException

    # Add an evening extension: 18:00-19:00 (outside normal 08:00-17:00).
    db_session.add(ScheduleException(
        doctor_id=clinic_setup["doctor_id"],
        exception_date=clinic_setup["target_date"],
        closed=False,
        start_time=dtime(18, 0),
        end_time=dtime(19, 0),
    ))
    db_session.commit()

    response = client.get(
        f"/doctors/{clinic_setup['doctor_id']}/availability",
        params={"date": clinic_setup["target_date"].isoformat()},
    )

    assert response.status_code == 200
    slots = response.json()["slots"]
    slot_starts = [
        datetime.fromisoformat(s["start_time"]).astimezone(NAIROBI).time()
        for s in slots
    ]
    from datetime import time as dtime
    # The 18:00 and 18:30 slots from the extra period must be present.
    assert dtime(18, 0) in slot_starts
    assert dtime(18, 30) in slot_starts
