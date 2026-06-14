"""ORM models for students and guardians.

PII columns (names, email, phone) are stored as pgcrypto-encrypted ``bytea``.
They are written/read through the ``vault.encrypt_pii`` / ``vault.decrypt_pii``
SQL functions (see Batch 1 migration) — never assign raw plaintext to these
columns and expect it to be protected. ``birth_date`` is a quasi-identifier and
stays in the clear (it is generalized during anonymization, not encrypted).
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, LargeBinary, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    # Encrypted PII (bytea) — see module docstring.
    last_name: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    first_name: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    middle_name: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    email: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    # Quasi-identifier — kept in the clear, generalized at anonymization time.
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))


class Guardian(Base):
    __tablename__ = "guardians"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    # Encrypted PII (bytea) — see module docstring.
    last_name: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    first_name: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    middle_name: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    email: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    relation_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))


class StudentGuardian(Base):
    """M:N link between students and guardians."""

    __tablename__ = "student_guardian"
    __table_args__ = {"schema": "core"}

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.students.id", ondelete="CASCADE"),
        primary_key=True,
    )
    guardian_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.guardians.id", ondelete="CASCADE"),
        primary_key=True,
    )
