"""widen_menu_category_and_tag_aspect

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-04

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "menu_items",
        "category",
        existing_type=sa.VARCHAR(length=80),
        type_=sa.String(length=100),
        existing_nullable=True,
    )
    op.alter_column(
        "tag_bank",
        "aspect",
        existing_type=sa.VARCHAR(length=32),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "tag_bank",
        "aspect",
        existing_type=sa.VARCHAR(length=50),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    op.alter_column(
        "menu_items",
        "category",
        existing_type=sa.VARCHAR(length=100),
        type_=sa.String(length=80),
        existing_nullable=True,
    )
