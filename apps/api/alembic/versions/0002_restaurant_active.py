"""restaurant active flag and tag aspect flexibility

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-04

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "restaurants",
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column(
        "menu_items",
        "category",
        existing_type=sa.String(length=80),
        type_=sa.String(length=100),
        existing_nullable=True,
    )
    op.drop_constraint("ck_tag_bank_aspect", "tag_bank", type_="check")
    op.alter_column(
        "tag_bank",
        "aspect",
        existing_type=sa.String(length=32),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "tag_bank",
        "aspect",
        existing_type=sa.String(length=50),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_tag_bank_aspect",
        "tag_bank",
        "aspect IN ('food', 'service', 'ambience', 'value')",
    )
    op.alter_column(
        "menu_items",
        "category",
        existing_type=sa.String(length=100),
        type_=sa.String(length=80),
        existing_nullable=True,
    )
    op.drop_column("restaurants", "active")
