"""ORM model for vault.subject_request — data-subject rights requests (§4, 152-ФЗ).

Records a personal-data subject's exercise of their rights under art. 14 / 20 of
152-ФЗ: access/export of their data or its deletion. Lives in the isolated
``vault`` schema alongside the consent register and pseudonym map.
"""

import uuid
from datetime import datetime

from sqlalchemy import Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SubjectRequest(Base):
    __tablename__ = "subject_request"
    __table_args__ = {"schema": "vault"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    subject_type: Mapped[str] = mapped_column(Text, nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # request_type: 'export' (art. 14 — access) | 'delete' (art. 20 — objection).
    request_type: Mapped[str] = mapped_column(Text, nullable=False)
    # status: 'new' | 'in_progress' | 'done' | 'rejected'.
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'new'"))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    # Statutory deadline: 152-ФЗ requires a response within 10 working days
    # (approximated here as +10 days from submission).
    due_at: Mapped[datetime] = mapped_column(nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
