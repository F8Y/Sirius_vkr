"""learning portal: course content, schedule, gamification

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-17 00:00:00.000000

Batch 5 (PHASE_2_PLAN). The learning contour skeleton (courses / groups /
enrollments / activities) was created in Batch 1; this migration adds the
structures the student/parent/teacher portals read but that did not yet exist:

  * course content    — core.modules → core.lessons (lesson.material_url is the
                        downloadable "материал"); a course detail is a tree of
                        modules → lessons.
  * weekly schedule   — core.schedule_slots (a recurring slot per group/weekday).
  * progress          — enrollments.progress (0..100), feeds the student registry
                        and the child dashboard.
  * gamification       — core.student_stats (xp / level / streak) and
                        core.badges / core.student_badges for the achievements
                        screen.

No PII lives in any of these tables — they describe learning activity, not the
data subject. Student names are still read only through vault.decrypt_pii.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── course content: modules → lessons ───────────────────────
    op.create_table(
        "modules",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("course_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["core.courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index("ix_modules_course_id", "modules", ["course_id"], schema="core")

    op.create_table(
        "lessons",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("module_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("material_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["module_id"], ["core.modules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index("ix_lessons_module_id", "lessons", ["module_id"], schema="core")

    # ── enrollment progress (0..100) ────────────────────────────
    op.add_column(
        "enrollments",
        sa.Column("progress", sa.Integer(), server_default=sa.text("0"), nullable=False),
        schema="core",
    )
    op.create_check_constraint(
        "ck_enrollments_progress",
        "enrollments",
        "progress BETWEEN 0 AND 100",
        schema="core",
    )

    # ── weekly schedule slots ───────────────────────────────────
    op.create_table(
        "schedule_slots",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("group_id", UUID(as_uuid=True), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("starts_at", sa.Time(), nullable=False),
        sa.Column("ends_at", sa.Time(), nullable=False),
        sa.Column("room", sa.Text(), nullable=True),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_schedule_slots_weekday"),
        sa.ForeignKeyConstraint(["group_id"], ["core.groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )
    op.create_index("ix_schedule_slots_group_id", "schedule_slots", ["group_id"], schema="core")

    # ── gamification: per-student stats ─────────────────────────
    op.create_table(
        "student_stats",
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column("xp", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("level", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("streak_days", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["core.students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id"),
        schema="core",
    )

    # ── gamification: badge catalogue + awards ──────────────────
    op.create_table(
        "badges",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_badges_code"),
        schema="core",
    )

    op.create_table(
        "student_badges",
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column("badge_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "awarded_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["core.students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["badge_id"], ["core.badges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id", "badge_id"),
        schema="core",
    )


def downgrade() -> None:
    op.drop_table("student_badges", schema="core")
    op.drop_table("badges", schema="core")
    op.drop_table("student_stats", schema="core")
    op.drop_index("ix_schedule_slots_group_id", table_name="schedule_slots", schema="core")
    op.drop_table("schedule_slots", schema="core")
    op.drop_constraint("ck_enrollments_progress", "enrollments", schema="core", type_="check")
    op.drop_column("enrollments", "progress", schema="core")
    op.drop_index("ix_lessons_module_id", table_name="lessons", schema="core")
    op.drop_table("lessons", schema="core")
    op.drop_index("ix_modules_course_id", table_name="modules", schema="core")
    op.drop_table("modules", schema="core")
