"""auth, roles, learning entities, consent, PII encryption

Revision ID: a1b2c3d4e5f6
Revises: c1a2b3d4e5f6
Create Date: 2026-06-13 00:00:00.000000

Batch 1 (PHASE_2_PLAN). Adds the access model (users / roles / user_roles),
links subjects to accounts (students.user_id / guardians.user_id), creates the
learning contour (courses / groups / enrollments / activities) and the consent
register in the vault schema, and turns direct PII columns of students/guardians
into pgcrypto-encrypted bytea.

IMPORTANT — two different "email" notions, never to be confused:
  * core.users.email      — login / account identifier. Stored in plaintext
                            (the password is what is hashed). MUST stay readable
                            so authentication can look users up by email.
  * core.students.email,
    core.guardians.email  — personal data (PII). Encrypted with pgcrypto.
Encrypting PII must not touch the authentication path.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "c1a2b3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# PII columns that get encrypted in core.students / core.guardians.
_STUDENT_PII = ("last_name", "first_name", "middle_name", "email", "phone")
_GUARDIAN_PII = ("last_name", "first_name", "middle_name", "email", "phone")


def upgrade() -> None:
    # ── core.roles ───────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "name IN ('child', 'parent', 'teacher', 'admin')", name="ck_roles_name"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_roles_name"),
        schema="core",
    )
    op.bulk_insert(
        sa.table("roles", sa.column("name", sa.Text()), schema="core"),
        [{"name": "child"}, {"name": "parent"}, {"name": "teacher"}, {"name": "admin"}],
    )

    # ── core.users (login accounts — email is plaintext, NOT PII) ─
    op.create_table(
        "users",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
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
        sa.UniqueConstraint("email", name="uq_users_email"),
        schema="core",
    )

    # ── core.user_roles (M:N) ────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["core.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["core.roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
        schema="core",
    )

    # ── link subjects to accounts ────────────────────────────────
    for tbl in ("students", "guardians"):
        op.add_column(
            tbl,
            sa.Column("user_id", UUID(as_uuid=True), nullable=True),
            schema="core",
        )
        op.create_foreign_key(
            f"fk_{tbl}_user_id",
            tbl,
            "users",
            ["user_id"],
            ["id"],
            source_schema="core",
            referent_schema="core",
            ondelete="SET NULL",
        )

    # ── learning contour ─────────────────────────────────────────
    op.create_table(
        "courses",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("direction", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("author_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
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
            "status IN ('draft', 'published', 'archived')", name="ck_courses_status"
        ),
        sa.ForeignKeyConstraint(["author_id"], ["core.users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    op.create_table(
        "groups",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("course_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("teacher_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["core.courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id"], ["core.users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    op.create_table(
        "enrollments",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("student_id", UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column(
            "enrolled_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'dropped')", name="ck_enrollments_status"
        ),
        sa.ForeignKeyConstraint(["student_id"], ["core.students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["core.groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "group_id", name="uq_enrollments_student_group"),
        schema="core",
    )

    op.create_table(
        "activities",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("type IN ('competition', 'event')", name="ck_activities_type"),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    # ── vault: PII encryption key + helper functions ─────────────
    # The symmetric key lives in the isolated vault schema and is generated
    # at migration time, so no secret is committed to the repository.
    op.create_table(
        "encryption_keys",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_encryption_keys_name"),
        schema="vault",
    )
    op.execute(
        "INSERT INTO vault.encryption_keys (name, key) "
        "VALUES ('pii', encode(gen_random_bytes(32), 'hex'))"
    )

    # SECURITY DEFINER: callers encrypt/decrypt PII without ever reading the
    # key table directly. search_path is pinned to avoid function hijacking.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION vault.encrypt_pii(plaintext text)
        RETURNS bytea
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = vault, public
        AS $func$
            SELECT CASE
                WHEN plaintext IS NULL THEN NULL
                ELSE pgp_sym_encrypt(
                    plaintext,
                    (SELECT key FROM vault.encryption_keys WHERE name = 'pii')
                )
            END
        $func$;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION vault.decrypt_pii(ciphertext bytea)
        RETURNS text
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = vault, public
        AS $func$
            SELECT CASE
                WHEN ciphertext IS NULL THEN NULL
                ELSE pgp_sym_decrypt(
                    ciphertext,
                    (SELECT key FROM vault.encryption_keys WHERE name = 'pii')
                )
            END
        $func$;
        """
    )
    op.execute("GRANT EXECUTE ON FUNCTION vault.encrypt_pii(text) TO PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION vault.decrypt_pii(bytea) TO PUBLIC")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON vault.encryption_keys TO vault_role")

    # ── encrypt PII columns of students / guardians ──────────────
    # No rows exist yet (import is Batch 2); the USING clause keeps the ALTER
    # correct should any plaintext rows already be present.
    for col in _STUDENT_PII:
        op.execute(
            f"ALTER TABLE core.students "
            f"ALTER COLUMN {col} TYPE bytea USING vault.encrypt_pii({col})"
        )
    for col in _GUARDIAN_PII:
        op.execute(
            f"ALTER TABLE core.guardians "
            f"ALTER COLUMN {col} TYPE bytea USING vault.encrypt_pii({col})"
        )

    # ── vault.consent (privacy register, §4) ─────────────────────
    op.create_table(
        "consent",
        sa.Column(
            "id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("subject_type", sa.Text(), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("granted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("granted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "subject_type IN ('student', 'guardian')", name="ck_consent_subject_type"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="vault",
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON vault.consent TO vault_role")


def downgrade() -> None:
    op.execute("REVOKE ALL ON vault.consent FROM vault_role")
    op.drop_table("consent", schema="vault")

    # Decrypt PII columns back to text (functions must still exist here).
    for col in _GUARDIAN_PII:
        op.execute(
            f"ALTER TABLE core.guardians "
            f"ALTER COLUMN {col} TYPE text USING vault.decrypt_pii({col})"
        )
    for col in _STUDENT_PII:
        op.execute(
            f"ALTER TABLE core.students "
            f"ALTER COLUMN {col} TYPE text USING vault.decrypt_pii({col})"
        )

    op.execute("DROP FUNCTION IF EXISTS vault.decrypt_pii(bytea)")
    op.execute("DROP FUNCTION IF EXISTS vault.encrypt_pii(text)")
    op.execute("REVOKE ALL ON vault.encryption_keys FROM vault_role")
    op.drop_table("encryption_keys", schema="vault")

    op.drop_table("activities", schema="core")
    op.drop_table("enrollments", schema="core")
    op.drop_table("groups", schema="core")
    op.drop_table("courses", schema="core")

    for tbl in ("students", "guardians"):
        op.drop_constraint(f"fk_{tbl}_user_id", tbl, schema="core", type_="foreignkey")
        op.drop_column(tbl, "user_id", schema="core")

    op.drop_table("user_roles", schema="core")
    op.drop_table("users", schema="core")
    op.drop_table("roles", schema="core")
