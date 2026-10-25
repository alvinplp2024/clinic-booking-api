# Clinic Booking API

FastAPI + SQLAlchemy + PostgreSQL REST API for clinic appointment scheduling.
Supports doctor availability, booking, cancellation, and rescheduling in 30-minute slots.
Includes a Vite + React + TypeScript frontend.

---

## Live Demo

- **Frontend:** https://clinic-booking-api-neon.vercel.app/
- **Backend API:** https://clinic-booking-api-le71.onrender.com/
- **Interactive API documentation:** https://clinic-booking-api-le71.onrender.com/docs
- **Health check:** https://clinic-booking-api-le71.onrender.com/health

The application uses a React frontend, a FastAPI backend, and PostgreSQL for persistent storage. The live deployment is intended for demonstration and assessment purposes.

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
| `Appointment` | Doctor, patient, start/end (timezone-aware), status (`booked`, `cancelled`, `completed`, `postponed`), cancellation metadata. Slots are 30 min; timezone defaults to `Africa/Nairobi`. |

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
| PATCH | `/appointments/{id}/status` | Mark as `completed` or `postponed` |

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

# 8. Mark as completed or postponed (only booked appointments)
curl -X PATCH http://127.0.0.1:8000/appointments/1/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"completed"}'
```

---

## Running the project

### Backend

```bash
# 1. Clone and set up the virtual environment
git clone https://github.com/alvinplp2024/clinic-booking-api.git
cd clinic-booking-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Create the database (run in psql)
#    CREATE ROLE clinic_user WITH LOGIN PASSWORD 'your_password';
#    CREATE DATABASE clinic_booking OWNER clinic_user;

# 3. Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL, e.g.:
# DATABASE_URL=postgresql+psycopg://clinic_user:your_password@localhost:5432/clinic_booking

# 4. Apply migrations and verify
alembic upgrade head
alembic check

# 5. Start the server
python -m uvicorn app.main:app --reload
# API explorer: http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL=http://127.0.0.1:8000 (or leave blank for default)
npm run dev
# App: http://localhost:5173
```

Verify the frontend build before committing:

```bash
npm run lint && npm run build
```

---

## Local Development

**Prerequisites:** Python 3.13, PostgreSQL (with `btree_gist` permission), Node.js 20+, Git.

**Backend**

See [Running the project](#running-the-project) above for the full setup steps.

**Frontend**

See [Running the project](#running-the-project) above for the full setup steps.

---

## Testing

Tests run against a dedicated `clinic_booking_test` database — never point this
at real data. The safety guard in `conftest.py` enforces the database name.

```bash
export TEST_DATABASE_URL='postgresql+psycopg://clinic_user:YOUR_PASSWORD@localhost:5432/clinic_booking_test'
python -m pytest -q
```

If your password contains special characters (`@`, `#`, `&`, etc.), percent-encode them in the URL — e.g. `@` → `%40`, `#` → `%23`, `&` → `%26`.

Coverage includes: registration, contact validation, booking, conflicts, working
hours, schedule exceptions, cancellation, rescheduling, availability, delete
guards, CORS, and timezone handling (65 tests).

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. Starts PostgreSQL 16
2. Applies migrations + `alembic check`
3. Runs the full backend test suite
4. Runs `npm ci`, `npm run lint`, `npm run build` in `frontend/`

### Deployment

**Live services**

- Backend: Render
- Database: Neon PostgreSQL
- Frontend: Vercel

**Backend configuration**

Configure these environment variables in Render:

- `DATABASE_URL` — PostgreSQL connection URL.
- `ALLOWED_ORIGINS` — the permitted frontend origin.
- `APP_ENV` - production.
- `TIMEZONE` - Africa/Nairobi.

Database migrations are applied before the application starts using the configured Render start command:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Frontend configuration**

Set the Vercel environment variable `VITE_API_BASE_URL` to:

`https://clinic-booking-api-le71.onrender.com`

The frontend must be redeployed after changing its production environment variables.

**Continuous integration**

The `main` branch is the deployment branch. Merging into `main` triggers automatic deployment on both Render (backend) and Vercel (frontend).

GitHub Actions runs on every push and pull request targeting `main`: backend migrations, migration consistency checks, backend tests, frontend linting, and the frontend production build. GitHub branch protection requires the `Migration and test suite` check to pass before any PR can be merged. Render and Vercel deploy automatically after merge. The CI gate is enforced by branch protection — deployment only happens after tests pass.

---

## AI Reflection

**Tools used**

Amazon Q Developer, ChatGPT, and DeepSeek — across route handlers, SQLAlchemy
models, Alembic migrations, test cases, React components, and documentation drafts.

**Useful suggestion — appointment status transitions**

Adding `completed` and `postponed` as first-class appointment statuses rather
than treating them as frontend-only display states. The suggestion was to widen
the database check constraint, add a dedicated `PATCH /appointments/{id}/status`
endpoint, and guard transitions at the service layer (only `booked` appointments
can be marked completed or postponed). This kept the state machine explicit and
auditable via `AppointmentEvent` records. The migration, model constraint,
schema, service, and frontend sections (Overdue section with Complete/Postpone
buttons, new Completed/Postponed sections, badge colours) all came from this
suggestion and were verified to work end-to-end.

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
