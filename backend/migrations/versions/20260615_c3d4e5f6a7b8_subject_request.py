"""subject-data rights requests register (§4, 152-ФЗ art. 14/20)

Adds vault.subject_request: a real register of data-subject rights requests
(export / delete) with statutory deadlines and lifecycle status. Sits in the
isolated ``vault`` schema next to the consent register.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subject_request",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("subject_type", sa.Text(), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("request_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default=sa.text("'new'"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("due_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint(
            "subject_type IN ('student', 'guardian')", name="ck_subject_request_subject_type"
        ),
        sa.CheckConstraint("request_type IN ('export', 'delete')", name="ck_subject_request_type"),
        sa.CheckConstraint(
            "status IN ('new', 'in_progress', 'done', 'rejected')",
            name="ck_subject_request_status",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="vault",
    )
    op.create_index(
        "idx_subject_request_status",
        "subject_request",
        ["status"],
        schema="vault",
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON vault.subject_request TO vault_role")


def downgrade() -> None:
    op.execute("REVOKE ALL ON vault.subject_request FROM vault_role")
    op.drop_index("idx_subject_request_status", table_name="subject_request", schema="vault")
    op.drop_table("subject_request", schema="vault")
