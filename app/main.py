from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.appointments import router as appointments_router
from app.api.registrations import router as registrations_router
from app.services.errors import BookingError

app = FastAPI(
    title=settings.app_name,
    description="Clinic appointment booking and availability API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.exception_handler(BookingError)
async def booking_error_handler(
    request: Request,
    exc: BookingError,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    """Confirm that the API process is running."""
    return {
        "status": "ok",
        "environment": settings.app_env,
    }


app.include_router(registrations_router)

app.include_router(appointments_router)
