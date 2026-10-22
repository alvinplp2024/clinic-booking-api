
import json
from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Clinic Booking API"
    app_env: str = "development"
    timezone: str = "Africa/Nairobi"
    database_url: str = (
        "postgresql+psycopg://clinic_user:change_me"
        "@localhost:5432/clinic_booking"
    )
    allowed_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            value = value.strip()

            if not value:
                return []

            if value.startswith("["):
                parsed = json.loads(value)
                if not isinstance(parsed, list):
                    raise ValueError("ALLOWED_ORIGINS must be a list")
                value = parsed
            else:
                value = value.split(",")

        if not isinstance(value, list):
            raise ValueError("ALLOWED_ORIGINS must be a list or comma-separated string")

        if not all(isinstance(origin, str) for origin in value):
            raise ValueError("Every allowed origin must be a string")

        return [origin.strip().rstrip("/") for origin in value if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
