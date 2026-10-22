def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_and_list_doctor(client):
    response = client.post(
        "/doctors",
        json={
            "name": "Dr Test One",
            "specialty": "General Practice",
        },
    )

    assert response.status_code == 201
    doctor = response.json()
    assert doctor["name"] == "Dr Test One"
    assert doctor["is_active"] is True

    listing = client.get("/doctors")
    assert listing.status_code == 200
    assert any(item["id"] == doctor["id"] for item in listing.json())


def test_create_doctor_email_only(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Email", "specialty": "Cardiology", "email": "dr.email@clinic.com"},
    )

    assert response.status_code == 201
    doctor = response.json()
    assert doctor["email"] == "dr.email@clinic.com"
    assert doctor["phone"] is None


def test_create_doctor_phone_only(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Phone", "specialty": "Dermatology", "phone": "+254711000001"},
    )

    assert response.status_code == 201
    doctor = response.json()
    assert doctor["phone"] == "+254711000001"
    assert doctor["email"] is None


def test_create_doctor_both_contacts(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Both", "specialty": "Neurology", "email": "dr.both@clinic.com", "phone": "+254711000002"},
    )

    assert response.status_code == 201
    doctor = response.json()
    assert doctor["email"] == "dr.both@clinic.com"
    assert doctor["phone"] == "+254711000002"


def test_create_doctor_no_contacts_allowed(client):
    """Doctors do not require contact fields."""
    response = client.post(
        "/doctors",
        json={"name": "Dr No Contact", "specialty": "Radiology"},
    )

    assert response.status_code == 201
    doctor = response.json()
    assert doctor["email"] is None
    assert doctor["phone"] is None


def test_doctor_email_normalized_to_lowercase(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Case", "specialty": "Oncology", "email": "DR.CASE@Clinic.COM"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "dr.case@clinic.com"


def test_invalid_doctor_email_is_rejected(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Bad Email", "specialty": "Pediatrics", "email": "not-an-email"},
    )

    assert response.status_code == 422


def test_invalid_doctor_phone_is_rejected(client):
    response = client.post(
        "/doctors",
        json={"name": "Dr Bad Phone", "specialty": "Pediatrics", "phone": "abc"},
    )

    assert response.status_code == 422


def test_duplicate_doctor_email_is_rejected(client):
    payload = {"name": "Dr Dup Email", "specialty": "Surgery", "email": "dup.doc@clinic.com"}
    first = client.post("/doctors", json=payload)
    assert first.status_code == 201

    second = client.post("/doctors", json={**payload, "name": "Dr Other"})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "duplicate_email"


def test_duplicate_doctor_phone_is_rejected(client):
    payload = {"name": "Dr Dup Phone", "specialty": "Surgery", "phone": "+254711000099"}
    first = client.post("/doctors", json=payload)
    assert first.status_code == 201

    second = client.post("/doctors", json={**payload, "name": "Dr Other"})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "duplicate_phone"


def test_create_patient_email_only(client):
    response = client.post(
        "/patients",
        json={"name": "Email Patient", "email": "email.only@example.com"},
    )

    assert response.status_code == 201
    patient = response.json()
    assert patient["email"] == "email.only@example.com"
    assert patient["phone"] is None
    assert patient["is_active"] is True


def test_create_patient_phone_only(client):
    response = client.post(
        "/patients",
        json={"name": "Phone Patient", "phone": "+254700000001"},
    )

    assert response.status_code == 201
    patient = response.json()
    assert patient["phone"] == "+254700000001"
    assert patient["email"] is None


def test_create_patient_both_contacts(client):
    response = client.post(
        "/patients",
        json={"name": "Both Patient", "email": "both@example.com", "phone": "+254700000002"},
    )

    assert response.status_code == 201
    patient = response.json()
    assert patient["email"] == "both@example.com"
    assert patient["phone"] == "+254700000002"


def test_create_patient_no_contact_is_rejected(client):
    response = client.post("/patients", json={"name": "No Contact"})

    assert response.status_code == 422


def test_create_patient_blank_contacts_rejected(client):
    response = client.post("/patients", json={"name": "Blank", "email": "", "phone": ""})

    assert response.status_code == 422


def test_invalid_patient_email_is_rejected(client):
    response = client.post(
        "/patients",
        json={"name": "Invalid Email Patient", "email": "not-an-email"},
    )

    assert response.status_code == 422


def test_invalid_patient_phone_is_rejected(client):
    response = client.post(
        "/patients",
        json={"name": "Invalid Phone Patient", "phone": "abc"},
    )

    assert response.status_code == 422


def test_email_is_normalized_to_lowercase(client):
    response = client.post(
        "/patients",
        json={"name": "Case Patient", "email": "UPPER@Example.COM"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "upper@example.com"


def test_duplicate_patient_email_is_rejected(client):
    payload = {"name": "Dup Email", "email": "dup@example.com"}
    first = client.post("/patients", json=payload)
    assert first.status_code == 201

    second = client.post("/patients", json={**payload, "name": "Other Name"})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "duplicate_email"


def test_duplicate_patient_phone_is_rejected(client):
    payload = {"name": "Dup Phone", "phone": "+254700000099"}
    first = client.post("/patients", json=payload)
    assert first.status_code == 201

    second = client.post("/patients", json={**payload, "name": "Other Name"})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "duplicate_phone"


def test_list_patients_empty(client):
    response = client.get("/patients")

    assert response.status_code == 200
    assert response.json() == []


def test_list_patients_returns_created_patients(client):
    client.post("/patients", json={"name": "Alice", "email": "alice@example.com"})
    client.post("/patients", json={"name": "Bob", "phone": "+254700000003"})

    response = client.get("/patients")

    assert response.status_code == 200
    patients = response.json()
    assert len(patients) == 2
    names = [p["name"] for p in patients]
    assert names == sorted(names)
    for patient in patients:
        assert "id" in patient
        assert "name" in patient
        assert "email" in patient
        assert "phone" in patient
        assert "is_active" in patient


def test_existing_email_patient_preserved(client):
    """Email-only registration still works after the schema change."""
    response = client.post(
        "/patients",
        json={"name": "Legacy Patient", "email": "legacy@example.com"},
    )

    assert response.status_code == 201
    patient = response.json()
    assert patient["email"] == "legacy@example.com"
    assert patient["phone"] is None


def test_delete_doctor_without_appointments(client):
    r = client.post("/doctors", json={"name": "Dr Deletable", "specialty": "Radiology"})
    assert r.status_code == 201
    doctor_id = r.json()["id"]

    resp = client.delete(f"/doctors/{doctor_id}")
    assert resp.status_code == 204

    listing = client.get("/doctors")
    assert not any(d["id"] == doctor_id for d in listing.json())


def test_delete_doctor_missing_returns_404(client):
    resp = client.delete("/doctors/999999")
    assert resp.status_code == 404


def test_delete_doctor_with_appointment_returns_409(client, db_session):
    from datetime import date, time, timedelta
    from zoneinfo import ZoneInfo
    from app.models import Doctor, Patient, WorkingHours, Appointment

    NAIROBI = ZoneInfo("Africa/Nairobi")
    from datetime import datetime
    now = datetime.now(NAIROBI)
    target_date = (now + timedelta(days=3)).date()

    doctor = Doctor(name="Dr Guard Test", specialty="Surgery", is_active=True)
    patient = Patient(name="Guard Patient", email="guard.doc@example.com", is_active=True)
    db_session.add_all([doctor, patient])
    db_session.flush()
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=target_date.weekday(),
        start_time=time(8, 0), end_time=time(17, 0),
    ))
    start = datetime.combine(target_date, time(10, 0), tzinfo=NAIROBI)
    db_session.add(Appointment(
        doctor_id=doctor.id, patient_id=patient.id,
        start_time=start, end_time=start + timedelta(minutes=30), status="booked",
    ))
    db_session.commit()

    resp = client.delete(f"/doctors/{doctor.id}")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "doctor_has_appointments"

    # Doctor and appointment must still exist.
    listing = client.get("/doctors")
    assert any(d["id"] == doctor.id for d in listing.json())


def test_delete_patient_without_appointments(client):
    r = client.post("/patients", json={"name": "Deletable Patient", "email": "del.patient@example.com"})
    assert r.status_code == 201
    patient_id = r.json()["id"]

    resp = client.delete(f"/patients/{patient_id}")
    assert resp.status_code == 204

    listing = client.get("/patients")
    assert not any(p["id"] == patient_id for p in listing.json())


def test_delete_patient_missing_returns_404(client):
    resp = client.delete("/patients/999999")
    assert resp.status_code == 404


def test_delete_patient_with_appointment_returns_409(client, db_session):
    from datetime import datetime, time, timedelta
    from zoneinfo import ZoneInfo
    from app.models import Doctor, Patient, WorkingHours, Appointment

    NAIROBI = ZoneInfo("Africa/Nairobi")
    now = datetime.now(NAIROBI)
    target_date = (now + timedelta(days=3)).date()

    doctor = Doctor(name="Dr Guard2", specialty="Pediatrics", is_active=True)
    patient = Patient(name="Guard Patient2", email="guard.pat@example.com", is_active=True)
    db_session.add_all([doctor, patient])
    db_session.flush()
    db_session.add(WorkingHours(
        doctor_id=doctor.id, weekday=target_date.weekday(),
        start_time=time(8, 0), end_time=time(17, 0),
    ))
    start = datetime.combine(target_date, time(10, 0), tzinfo=NAIROBI)
    db_session.add(Appointment(
        doctor_id=doctor.id, patient_id=patient.id,
        start_time=start, end_time=start + timedelta(minutes=30), status="booked",
    ))
    db_session.commit()

    resp = client.delete(f"/patients/{patient.id}")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "patient_has_appointments"

    # Patient must still exist.
    listing = client.get("/patients")
    assert any(p["id"] == patient.id for p in listing.json())


def test_cors_allowed_origin_returns_header(client):
    response = client.get(
        "/doctors",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_disallowed_origin_omits_header(client):
    response = client.get(
        "/doctors",
        headers={"Origin": "https://evil.example.com"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers

