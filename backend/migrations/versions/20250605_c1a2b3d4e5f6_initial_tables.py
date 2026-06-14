"""initial tables

Revision ID: c1a2b3d4e5f6
Revises:
Create Date: 2025-06-05 00:00:00.000000

Creates all application tables. Schemas (core, vault), extensions (pgcrypto,
uuid-ossp), and vault_role are pre-created by db/init/01-init.sh which runs
before this migration on every fresh container start.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "c1a2b3d4e5f6"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── core.jobs ────────────────────────────────────────────────
    op.create_table(
        "jobs",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("progress", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("result", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("type IN ('import', 'anonymize')", name="ck_jobs_type"),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'done', 'failed')", name="ck_jobs_status"
        ),
        sa.CheckConstraint("progress BETWEEN 0 AND 100", name="ck_jobs_progress"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index("idx_jobs_status", "jobs", ["status"], schema="core")

    # ── core.students ────────────────────────────────────────────
    op.create_table(
        "students",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("middle_name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    # ── core.guardians ───────────────────────────────────────────
    op.create_table(
        "guardians",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("middle_name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("relation_type", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "relation_type IN ('mother', 'father', 'guardian')",
            name="ck_guardians_relation_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    # ── core.student_guardian ────────────────────────────────────
    op.create_table(
        "student_guardian",
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column("guardian_id", UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["core.students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["guardian_id"], ["core.guardians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id", "guardian_id"),
        schema="core",
    )

    # ── vault.pseudonym_map ──────────────────────────────────────
    op.create_table(
        "pseudonym_map",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("field_name", sa.Text(), nullable=False),
        sa.Column("original_hash", sa.Text(), nullable=False),
        sa.Column("pseudonym", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("entity_type", "entity_id", "field_name", name="uq_pseudonym_map"),
        sa.PrimaryKeyConstraint("id"),
        schema="vault",
    )

    # Grant vault_role privileges on new vault tables (idempotent for future migrations too)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON vault.pseudonym_map TO vault_role")


def downgrade() -> None:
    op.execute("REVOKE ALL ON vault.pseudonym_map FROM vault_role")
    op.drop_table("pseudonym_map", schema="vault")
    op.drop_table("student_guardian", schema="core")
    op.drop_table("guardians", schema="core")
    op.drop_table("students", schema="core")
    op.drop_index("idx_jobs_status", table_name="jobs", schema="core")
    op.drop_table("jobs", schema="core")
