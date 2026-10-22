import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


_PHONE_RE = re.compile(r"^\+?[0-9\s\-().]{7,20}$")


def _normalize_phone(raw: str) -> str:
    """Strip whitespace and collapse internal spaces."""
    return re.sub(r"\s+", " ", raw.strip())


class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=1, max_length=30)

    @model_validator(mode="after")
    def at_least_one_contact(self) -> "PatientCreate":
        email = (self.email or "").strip()
        phone = (self.phone or "").strip()
        if not email and not phone:
            raise ValueError("At least one of email or phone must be provided.")
        if phone and not _PHONE_RE.match(phone):
            raise ValueError(
                "Phone must be 7–20 characters and contain only digits, "
                "spaces, +, -, (, or )."
            )
        # Normalize
        if email:
            self.email = email.lower()
        if phone:
            self.phone = _normalize_phone(phone)
        return self


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
