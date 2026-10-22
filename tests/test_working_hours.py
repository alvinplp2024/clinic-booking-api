from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.models import Doctor, WorkingHours

NAIROBI = ZoneInfo("Africa/Nairobi")


@pytest.fixture
def doctor(db_session):
    d = Doctor(name="Dr Schedule Test", specialty="General Practice", is_active=True)
    db_session.add(d)
    db_session.commit()
    return d


@pytest.fixture
def inactive_doctor(db_session):
    d = Doctor(name="Dr Inactive", specialty="General Practice", is_active=False)
    db_session.add(d)
    db_session.commit()
    return d


# ---------------------------------------------------------------------------
# GET /doctors/{id}/schedule
# ---------------------------------------------------------------------------

def test_get_schedule_empty(client, doctor):
    response = client.get(f"/doctors/{doctor.id}/schedule")

    assert response.status_code == 200
    data = response.json()
    assert data["doctor_id"] == doctor.id
    assert data["schedule"] == []


def test_get_schedule_returns_configured_periods(client, doctor, db_session):
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=0,
        start_time=time(9, 0), end_time=time(17, 0),
    ))
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=2,
        start_time=time(8, 0), end_time=time(12, 0),
    ))
    db_session.commit()

    response = client.get(f"/doctors/{doctor.id}/schedule")

    assert response.status_code == 200
    schedule = response.json()["schedule"]
    assert len(schedule) == 2
    weekdays = [r["weekday"] for r in schedule]
    assert weekdays == sorted(weekdays)


def test_get_schedule_inactive_doctor_returns_404(client, inactive_doctor):
    response = client.get(f"/doctors/{inactive_doctor.id}/schedule")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "doctor_unavailable"


def test_get_schedule_missing_doctor_returns_404(client):
    response = client.get("/doctors/99999/schedule")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "doctor_unavailable"


# ---------------------------------------------------------------------------
# PUT /doctors/{id}/schedule/{weekday}
# ---------------------------------------------------------------------------

def test_put_single_period(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["doctor_id"] == doctor.id
    assert data["weekday"] == 0
    assert data["weekday_name"] == "Monday"
    assert len(data["periods"]) == 1
    assert data["periods"][0]["start_time"] == "09:00:00"
    assert data["periods"][0]["end_time"] == "17:00:00"


def test_put_two_non_overlapping_periods(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/1",
        json={"periods": [
            {"start_time": "08:00:00", "end_time": "12:00:00"},
            {"start_time": "13:00:00", "end_time": "17:00:00"},
        ]},
    )

    assert response.status_code == 200
    assert len(response.json()["periods"]) == 2


def test_put_empty_periods_clears_day(client, doctor, db_session):
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=3,
        start_time=time(9, 0), end_time=time(17, 0),
    ))
    db_session.commit()

    response = client.put(
        f"/doctors/{doctor.id}/schedule/3",
        json={"periods": []},
    )

    assert response.status_code == 200
    assert response.json()["periods"] == []

    # Confirm GET also shows empty for that day.
    schedule = client.get(f"/doctors/{doctor.id}/schedule").json()["schedule"]
    assert not any(r["weekday"] == 3 for r in schedule)


def test_put_replaces_existing_periods(client, doctor, db_session):
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=0,
        start_time=time(8, 0), end_time=time(12, 0),
    ))
    db_session.commit()

    response = client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    assert response.status_code == 200
    periods = response.json()["periods"]
    assert len(periods) == 1
    assert periods[0]["start_time"] == "09:00:00"


def test_put_does_not_affect_other_weekdays(client, doctor, db_session):
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=4,
        start_time=time(9, 0), end_time=time(17, 0),
    ))
    db_session.commit()

    client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [{"start_time": "10:00:00", "end_time": "14:00:00"}]},
    )

    schedule = client.get(f"/doctors/{doctor.id}/schedule").json()["schedule"]
    friday_rows = [r for r in schedule if r["weekday"] == 4]
    assert len(friday_rows) == 1
    assert friday_rows[0]["start_time"] == "09:00:00"


def test_put_rejects_end_before_start(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [{"start_time": "17:00:00", "end_time": "09:00:00"}]},
    )

    assert response.status_code == 422


def test_put_rejects_equal_start_and_end(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [{"start_time": "09:00:00", "end_time": "09:00:00"}]},
    )

    assert response.status_code == 422


def test_put_rejects_overlapping_periods(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/0",
        json={"periods": [
            {"start_time": "09:00:00", "end_time": "13:00:00"},
            {"start_time": "12:00:00", "end_time": "17:00:00"},
        ]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "overlapping_periods"


def test_put_invalid_weekday_returns_422(client, doctor):
    response = client.put(
        f"/doctors/{doctor.id}/schedule/7",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    assert response.status_code == 422


def test_put_inactive_doctor_returns_404(client, inactive_doctor):
    response = client.put(
        f"/doctors/{inactive_doctor.id}/schedule/0",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "doctor_unavailable"


def test_put_missing_doctor_returns_404(client):
    response = client.put(
        "/doctors/99999/schedule/0",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "doctor_unavailable"


# ---------------------------------------------------------------------------
# Transaction rollback regression
# ---------------------------------------------------------------------------

def test_put_rolls_back_on_commit_failure(client, test_engine, doctor, db_session):
    """If commit raises after deletes are flushed, original rows are preserved."""
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import sessionmaker
    from app.core.database import get_db
    from app.main import app as fastapi_app
    from fastapi.testclient import TestClient

    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=0,
        start_time=time(9, 0), end_time=time(17, 0),
    ))
    db_session.commit()

    # Build a session whose commit always raises after the first call
    # (the first call succeeds so the fixture's own setup is unaffected;
    # the endpoint's commit is the second call on a fresh session).
    class FailingSession:
        def __init__(self, real_session):
            self._s = real_session
            self._commit_count = 0

        def __getattr__(self, name):
            return getattr(self._s, name)

        def commit(self):
            self._commit_count += 1
            raise OperationalError("simulated failure", {}, None)

    TestingSessionLocal = sessionmaker(
        bind=test_engine, autoflush=False, expire_on_commit=False
    )

    def override_get_db():
        real = TestingSessionLocal()
        session = FailingSession(real)
        try:
            yield session
        finally:
            real.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(fastapi_app, raise_server_exceptions=False) as failing_client:
            response = failing_client.put(
                f"/doctors/{doctor.id}/schedule/0",
                json={"periods": [{"start_time": "10:00:00", "end_time": "14:00:00"}]},
            )
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)

    # The endpoint must not return 200.
    assert response.status_code == 500

    # Query the DB directly — the original row must still be present.
    from sqlalchemy import select as sa_select
    surviving = db_session.scalars(
        sa_select(WorkingHours).where(
            WorkingHours.doctor_id == doctor.id,
            WorkingHours.weekday == 0,
        )
    ).all()
    assert len(surviving) == 1
    assert surviving[0].start_time == time(9, 0)


# ---------------------------------------------------------------------------
# Availability integration
# ---------------------------------------------------------------------------

def test_availability_returns_slots_after_schedule_set(client, doctor):
    now = datetime.now(NAIROBI)
    target_date = (now + timedelta(days=3)).date()

    client.put(
        f"/doctors/{doctor.id}/schedule/{target_date.weekday()}",
        json={"periods": [{"start_time": "09:00:00", "end_time": "17:00:00"}]},
    )

    response = client.get(
        f"/doctors/{doctor.id}/availability",
        params={"date": target_date.isoformat()},
    )

    assert response.status_code == 200
    assert len(response.json()["slots"]) > 0


def test_availability_empty_after_schedule_cleared(client, doctor, db_session):
    now = datetime.now(NAIROBI)
    target_date = (now + timedelta(days=3)).date()

    db_session.add(WorkingHours(
        doctor_id=doctor.id,
        weekday=target_date.weekday(),
        start_time=time(9, 0),
        end_time=time(17, 0),
    ))
    db_session.commit()

    client.put(
        f"/doctors/{doctor.id}/schedule/{target_date.weekday()}",
        json={"periods": []},
    )

    response = client.get(
        f"/doctors/{doctor.id}/availability",
        params={"date": target_date.isoformat()},
    )

    assert response.status_code == 200
    assert response.json()["slots"] == []
