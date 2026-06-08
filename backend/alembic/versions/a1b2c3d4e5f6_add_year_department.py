"""add year and department to users and courses

Revision ID: a1b2c3d4e5f6
Revises: 3d3773366c5d
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3d3773366c5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users — nullable because admins/teachers don't have year/department
    op.add_column("users", sa.Column("year", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(), nullable=True))

    # courses — always required
    op.add_column("courses", sa.Column("year", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("courses", sa.Column("department", sa.String(), nullable=False, server_default="General"))

    # Drop server defaults after adding — they only exist to satisfy NOT NULL on existing rows
    op.alter_column("courses", "year", server_default=None)
    op.alter_column("courses", "department", server_default=None)


def downgrade() -> None:
    op.drop_column("courses", "department")
    op.drop_column("courses", "year")
    op.drop_column("users", "department")
    op.drop_column("users", "year")
