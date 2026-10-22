from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Clinic Booking API"
    app_env: str = "development"
    timezone: str = "Africa/Nairobi"
    database_url: str = (
        "postgresql+psycopg://clinic_user:change_me"
        "@localhost:5432/clinic_booking"
    )
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value  # type: ignore[return-value]

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
