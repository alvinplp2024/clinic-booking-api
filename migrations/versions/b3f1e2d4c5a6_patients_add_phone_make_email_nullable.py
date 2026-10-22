"""patients add phone make email nullable

Revision ID: b3f1e2d4c5a6
Revises: 9aab0c43afca
Create Date: 2026-10-23 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3f1e2d4c5a6'
down_revision: Union[str, None] = '9aab0c43afca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make email nullable (existing rows keep their values).
    op.alter_column('patients', 'email', existing_type=sa.String(length=255), nullable=True)

    # Drop the old non-partial unique index on email.
    op.drop_index('ix_patients_email', table_name='patients')

    # Partial unique index: only enforce uniqueness when email IS NOT NULL.
    op.execute(
        "CREATE UNIQUE INDEX ix_patients_email "
        "ON patients (email) WHERE email IS NOT NULL"
    )

    # Add nullable phone column.
    op.add_column('patients', sa.Column('phone', sa.String(length=30), nullable=True))

    # Partial unique index: only enforce uniqueness when phone IS NOT NULL.
    op.execute(
        "CREATE UNIQUE INDEX ix_patients_phone "
        "ON patients (phone) WHERE phone IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index('ix_patients_phone', table_name='patients')
    op.drop_column('patients', 'phone')

    op.drop_index('ix_patients_email', table_name='patients')

    # Restore non-partial unique index and NOT NULL constraint.
    # Rows with NULL email would violate NOT NULL — acceptable for downgrade only.
    op.execute(
        "CREATE UNIQUE INDEX ix_patients_email ON patients (email)"
    )
    op.alter_column('patients', 'email', existing_type=sa.String(length=255), nullable=False)
