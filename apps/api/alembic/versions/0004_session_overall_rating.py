"""add sessions.overall_rating

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("overall_rating", sa.Integer(), nullable=True))
        batch.create_check_constraint(
            "ck_sessions_overall_rating",
            "overall_rating IS NULL OR (overall_rating >= 1 AND overall_rating <= 5)",
        )


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.drop_constraint("ck_sessions_overall_rating", type_="check")
        batch.drop_column("overall_rating")
