"""Pydantic v2 DTOs for authentication and user/role management."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field


class RoleName(StrEnum):
    """The four fixed roles."""

    CHILD = "child"
    PARENT = "parent"
    TEACHER = "teacher"
    ADMIN = "admin"


# Roles a user may assign to themselves at registration. Elevated roles
# (teacher, admin) can only be granted by an admin afterwards.
SELF_ASSIGNABLE_ROLES = frozenset({RoleName.CHILD, RoleName.PARENT})


class RegisterRequest(BaseModel):
    """Request body for POST /api/v1/auth/register."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    roles: list[RoleName] = Field(default_factory=lambda: [RoleName.CHILD])


class UserResponse(BaseModel):
    """Public representation of a user account."""

    id: uuid.UUID
    # Plain str (not EmailStr): this is an output DTO, and strict email
    # validation needlessly rejects valid internal domains like ``*.local``.
    email: str
    is_active: bool
    roles: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """OAuth2-style bearer token response."""

    access_token: str
    token_type: str = "bearer"


class AssignRolesRequest(BaseModel):
    """Admin request to set a user's roles (replaces the existing set)."""

    roles: list[RoleName] = Field(min_length=1)
