"""appointments add completed and postponed statuses

Revision ID: c4e2f3a1b8d9
Revises: c4e7f1a2b3d5
Create Date: 2026-10-24 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = 'c4e2f3a1b8d9'
down_revision: Union[str, None] = 'c4e7f1a2b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('ck_appointment_valid_status', 'appointments', type_='check')
    op.create_check_constraint(
        'ck_appointment_valid_status',
        'appointments',
        "status IN ('booked', 'cancelled', 'completed', 'postponed')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_appointment_valid_status', 'appointments', type_='check')
    op.create_check_constraint(
        'ck_appointment_valid_status',
        'appointments',
        "status IN ('booked', 'cancelled')",
    )
