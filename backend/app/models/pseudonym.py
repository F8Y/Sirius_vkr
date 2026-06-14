"""ORM model for vault.pseudonym_map — managed by Alembic, accessed via vault_role."""

import uuid
from datetime import datetime

from sqlalchemy import Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PseudonymMap(Base):
    """Reversible pseudonymization mapping stored in the isolated vault schema."""

    __tablename__ = "pseudonym_map"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "field_name", name="uq_pseudonym_map"),
        {"schema": "vault"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    field_name: Mapped[str] = mapped_column(Text, nullable=False)
    original_hash: Mapped[str] = mapped_column(Text, nullable=False)
    pseudonym: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
