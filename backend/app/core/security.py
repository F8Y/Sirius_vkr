"""Password hashing and JWT token helpers.

Passwords are hashed with bcrypt via ``pwdlib``. Access tokens are signed JWTs
(``HS256`` with ``settings.secret_key``). This module knows nothing about PII
encryption — account credentials and personal data are handled separately.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

_password_hash = PasswordHash((BcryptHasher(),))


def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash for ``plain_password``."""
    return _password_hash.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check ``plain_password`` against a stored hash."""
    return _password_hash.verify(plain_password, password_hash)


def create_access_token(subject: uuid.UUID | str, expires_minutes: int | None = None) -> str:
    """Create a signed JWT whose ``sub`` claim is the user id."""
    minutes = (
        expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    )
    now = datetime.now(tz=UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT, raising ``jwt.PyJWTError`` on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
