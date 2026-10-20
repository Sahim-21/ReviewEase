"""rate_limits table and indexes for owner metrics

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rate_limits",
        sa.Column("key", sa.String(length=200), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rate_limits_expires_at", "rate_limits", ["expires_at"])
    op.create_index("ix_events_restaurant_type_ts", "events", ["restaurant_id", "type", "ts"])
    op.create_index("ix_events_session_type", "events", ["session_id", "type"])
    op.create_index("ix_sessions_restaurant_rating", "sessions", ["restaurant_id", "overall_rating"])


def downgrade() -> None:
    op.drop_index("ix_sessions_restaurant_rating", table_name="sessions")
    op.drop_index("ix_events_session_type", table_name="events")
    op.drop_index("ix_events_restaurant_type_ts", table_name="events")
    op.drop_index("ix_rate_limits_expires_at", table_name="rate_limits")
    op.drop_table("rate_limits")
