from typing import Optional

from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    __table_args__ = (
        Index(
            "ix_patients_email",
            "email",
            unique=True,
            postgresql_where=(~(email.is_(None))),  # type: ignore[attr-defined]
        ),
        Index(
            "ix_patients_phone",
            "phone",
            unique=True,
            postgresql_where=(~(phone.is_(None))),  # type: ignore[attr-defined]
        ),
    )

    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="patient"
    )
