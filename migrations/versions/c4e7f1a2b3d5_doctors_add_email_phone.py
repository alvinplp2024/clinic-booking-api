"""doctors add email and phone

Revision ID: c4e7f1a2b3d5
Revises: b3f1e2d4c5a6
Create Date: 2026-10-24 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4e7f1a2b3d5'
down_revision: Union[str, None] = 'b3f1e2d4c5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('doctors', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('doctors', sa.Column('phone', sa.String(length=30), nullable=True))

    op.execute(
        "CREATE UNIQUE INDEX ix_doctors_email "
        "ON doctors (email) WHERE email IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX ix_doctors_phone "
        "ON doctors (phone) WHERE phone IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index('ix_doctors_phone', table_name='doctors')
    op.drop_index('ix_doctors_email', table_name='doctors')
    op.drop_column('doctors', 'phone')
    op.drop_column('doctors', 'email')
