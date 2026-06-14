"""restrict EXECUTE on vault PII functions to the application role

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14 00:00:00.000000

Security hardening (follow-up to the Batch 1 review): the previous migration
granted EXECUTE on vault.encrypt_pii / vault.decrypt_pii to PUBLIC. Although not
exploitable today (PUBLIC lacks USAGE on the vault schema), it contradicts the
least-privilege model. Here we revoke EXECUTE from PUBLIC and grant it only to
the application role that connects to the database (CURRENT_USER at migration
time — the same role the backend/worker use). The function owner keeps EXECUTE
implicitly, so this is env-agnostic and does not break the app.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("REVOKE EXECUTE ON FUNCTION vault.encrypt_pii(text) FROM PUBLIC")
    op.execute("REVOKE EXECUTE ON FUNCTION vault.decrypt_pii(bytea) FROM PUBLIC")
    # Explicit grant to the connecting application role (least privilege).
    op.execute("GRANT EXECUTE ON FUNCTION vault.encrypt_pii(text) TO CURRENT_USER")
    op.execute("GRANT EXECUTE ON FUNCTION vault.decrypt_pii(bytea) TO CURRENT_USER")


def downgrade() -> None:
    op.execute("REVOKE EXECUTE ON FUNCTION vault.encrypt_pii(text) FROM CURRENT_USER")
    op.execute("REVOKE EXECUTE ON FUNCTION vault.decrypt_pii(bytea) FROM CURRENT_USER")
    op.execute("GRANT EXECUTE ON FUNCTION vault.encrypt_pii(text) TO PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION vault.decrypt_pii(bytea) TO PUBLIC")
