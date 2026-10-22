# Clinic Booking API

FastAPI + SQLAlchemy + PostgreSQL REST API for clinic appointment scheduling.
Supports doctor availability, booking, cancellation, and rescheduling in 30-minute slots.
Includes a Vite + React + TypeScript frontend.

---

## System Design

**Stack**

FastAPI · SQLAlchemy · Alembic · PostgreSQL · Python 3.13

**Layers**

```
app/api/        → route handlers
app/schemas/    → request / response validation
app/services/   → booking logic
app/models/     → SQLAlchemy ORM
app/core/       → config and database session
migrations/     → Alembic migrations
tests/          → test suite
```

**Data model**

| Model | Notes |
|---|---|
| `Doctor` | Name, specialty, optional email/phone. Emails normalised to lowercase, phones validated 7–20 chars. Uniqueness via partial indexes on active records. |
| `Patient` | Same contact rules, but at least one of email or phone is required. |
| `WorkingHours` | Recurring weekday periods per doctor. |
| `ScheduleException` | Date-specific closure or extra opening period. |
| `Appointment` | Doctor, patient, start/end (timezone-aware), status, cancellation metadata. Slots are 30 min; timezone defaults to `Africa/Nairobi`. |

**Concurrency**

A PostgreSQL `ExcludeConstraint` with `btree_gist` prevents overlapping booked
appointments at the database level — application-level checks alone aren't safe
under concurrent requests. Booking and rescheduling catch `IntegrityError` and
return 409 rather than crashing.

**Not production-ready:** no auth, no secret management, no monitoring.
Don't use with real patient data as-is.

---

## API

Interactive docs at `/docs` when running. Full OpenAPI schema at `/openapi.json`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/doctors` | Register a doctor |
| GET | `/doctors` | List doctors |
| DELETE | `/doctors/{id}` | Delete doctor (409 if appointments exist) |
| GET | `/doctors/{id}/schedule` | Get weekly schedule |
| PUT | `/doctors/{id}/schedule/{weekday}` | Set a weekday's hours |
| GET | `/doctors/{id}/availability?date=YYYY-MM-DD` | List available slots |
| POST | `/patients` | Register a patient |
| GET | `/patients` | List patients |
| DELETE | `/patients/{id}` | Delete patient (409 if appointments exist) |
| GET | `/patients/{id}/appointments` | List patient appointments |
| POST | `/appointments` | Book an appointment |
| PATCH | `/appointments/{id}/cancel` | Cancel with a reason |
| PATCH | `/appointments/{id}/reschedule` | Reschedule |

**Status codes**

| Code | Meaning |
|---|---|
| `201` | Created |
| `200` | OK |
| `404` | Not found |
| `409` | Conflict — duplicate contact, booking clash, delete guard, invalid state transition |
| `422` | Validation error |
| `500` | Server error |

All errors return:

```json
{"error": {"code": "...", "message": "..."}}
```

**Quick examples**

Each `id` must come from the response of the preceding registration call —
there are no pre-seeded records.

```bash
# 1. Register a doctor
curl -X POST http://127.0.0.1:8000/doctors \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr Alvin Ondieki","specialty":"General Practice"}'
# → {"id": 1, "name": "Dr Alvin Ondieki", ...}

# 2. Register a patient (at least one of email or phone is required)
curl -X POST http://127.0.0.1:8000/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alvin Ondieki","email":"alvinondieki5@gmail.com","phone":"+254700921906"}'
# → {"id": 1, "name": "Alvin Ondieki", ...}

# 3. Set working hours — doctors have no schedule by default.
#    Weekday: 0=Monday … 6=Sunday. Skip this and availability returns empty.
curl -X PUT http://127.0.0.1:8000/doctors/1/schedule/0 \
  -H 'Content-Type: application/json' \
  -d '{"periods":[{"start_time":"09:00:00","end_time":"17:00:00"}]}'

# 4. Check availability — 2026-11-02 is a Monday, so slots will appear
curl 'http://127.0.0.1:8000/doctors/1/availability?date=2026-11-02'
# → {"slots": [{"start_time": "2026-11-02T09:00:00+03:00", ...}, ...]}

# 5. Book a slot
curl -X POST http://127.0.0.1:8000/appointments \
  -H 'Content-Type: application/json' \
  -d '{"doctor_id":1,"patient_id":1,"start_time":"2026-11-02T09:00:00+03:00"}'
# → {"id": 1, "status": "booked", ...}

# 6. Reschedule — use the appointment id from step 5
curl -X PATCH http://127.0.0.1:8000/appointments/1/reschedule \
  -H 'Content-Type: application/json' \
  -d '{"start_time":"2026-11-02T10:00:00+03:00"}'

# 7. Cancel — use the appointment id from step 5
curl -X PATCH http://127.0.0.1:8000/appointments/1/cancel \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Patient requested cancellation"}'
```

---

## Local Development

**Prerequisites:** Python 3.13, PostgreSQL (with `btree_gist` permission), Node.js 20+, Git.

**Backend**

```bash
git clone <REPO_URL> && cd clinic-booking-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create a PostgreSQL role and database:

```sql
CREATE ROLE clinic_user WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE clinic_booking OWNER clinic_user;
```

Configure and run:

```bash
cp .env.example .env    # edit DATABASE_URL
alembic upgrade head
alembic check
python -m uvicorn app.main:app --reload
```

API explorer: `http://127.0.0.1:8000/docs`

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env    # edit VITE_API_BASE_URL if backend isn't on :8000
npm run dev             # http://localhost:5173
```

Verify the build:

```bash
npm run lint && npm run build
```

---

## Testing

Tests run against a dedicated `clinic_booking_test` database — never point this
at real data. The safety guard in `conftest.py` enforces the database name.

```bash
export TEST_DATABASE_URL='postgresql+psycopg://clinic_user:YOUR_PASSWORD@localhost:5432/clinic_booking_test'
python -m pytest -q
```

Coverage includes: registration, contact validation, booking, conflicts, working
hours, schedule exceptions, cancellation, rescheduling, availability, delete
guards, CORS, and timezone handling (62 tests).

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. Starts PostgreSQL 16
2. Applies migrations + `alembic check`
3. Runs the full backend test suite
4. Runs `npm ci`, `npm run lint`, `npm run build` in `frontend/`

**Deployment**

- Backend deploys to Render (or any platform supporting Python + PostgreSQL).
- Frontend deploys to Vercel.

After deploying the backend:

1. Set `DATABASE_URL` and `ALLOWED_ORIGINS` as environment variables.
2. Run `alembic upgrade head` as a deploy step.
3. Point health checks at `/health`.

On Vercel, set `VITE_API_BASE_URL` to the deployed backend URL.

---

## AI Reflection

**Tools used**

Amazon Q Developer, ChatGPT, and DeepSeek — across route handlers, SQLAlchemy
models, Alembic migrations, test cases, React components, and documentation drafts.

**Useful suggestion**

Using a PostgreSQL `ExcludeConstraint` with `btree_gist` to block overlapping
appointments at the database level. This was the right call — application-level
availability checks have a race condition under concurrent requests. The migration
and model constraint both came from this suggestion and were verified to work.

**Incorrect suggestion**

When adding optional contact fields to the Doctor model, the AI generated a
`model_validator` requiring at least one contact — copying the Patient pattern.
Doctors don't have that requirement. The validator was removed and
`test_create_doctor_no_contacts_allowed` was added to lock in the correct behaviour.

**Independent decisions**

- *Partial unique indexes over application-level checks* — email/phone uniqueness
  is enforced by `WHERE email IS NOT NULL` / `WHERE phone IS NOT NULL` partial
  indexes rather than a pre-insert query. Correct under concurrency; `IntegrityError`
  is caught and returned as a 409.

- *Delete guard in application code, not FK constraints* — `DELETE /doctors/{id}`
  and `DELETE /patients/{id}` check for existing appointments and return 409
  explicitly. Silently cascading appointment history in a clinical context would
  be wrong, and a raw FK violation would give a worse error than an intentional
  application check.

All AI output was reviewed before being accepted. The final implementation and
any remaining gaps are my responsibility.
