"""ORM models for the access layer: users, roles, user_roles (M:N).

``users.email`` is the login identifier and is stored in plaintext — it is NOT
personal data subject to encryption. Only the password is hashed. Keeping email
readable is what makes authentication (lookup-by-email) possible. Do not confuse
this with ``students.email`` / ``guardians.email``, which ARE encrypted PII.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Role(Base):
    """One of the four fixed roles: child / parent / teacher / admin."""

    __tablename__ = "roles"
    __table_args__ = {"schema": "core"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class User(Base):
    """A login account. ``email`` is plaintext; ``password_hash`` is hashed."""

    __tablename__ = "users"
    __table_args__ = {"schema": "core"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()"), onupdate=datetime.now
    )

    roles: Mapped[list[Role]] = relationship(
        "Role",
        secondary="core.user_roles",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class UserRole(Base):
    """M:N association between users and roles."""

    __tablename__ = "user_roles"
    __table_args__ = {"schema": "core"}

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("core.roles.id", ondelete="CASCADE"),
        primary_key=True,
    )
