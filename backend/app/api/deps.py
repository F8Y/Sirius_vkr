"""Shared FastAPI dependencies: current-user resolution and RBAC guards."""

import uuid
from collections.abc import Awaitable, Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.auth import RoleName
from app.services.auth_service import get_user_by_id

# tokenUrl powers the Swagger "Authorize" button (matches the /login route).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a bearer JWT, or raise 401."""
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise _credentials_exc
        user_id = uuid.UUID(subject)
    except (jwt.PyJWTError, ValueError) as exc:
        raise _credentials_exc from exc

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _credentials_exc
    return user


def require_roles(*roles: RoleName) -> Callable[[User], Awaitable[User]]:
    """Dependency factory: allow only users holding at least one of ``roles``."""
    allowed = {role.value for role in roles}

    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if allowed.isdisjoint({role.name for role in current_user.roles}):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this operation",
            )
        return current_user

    return _guard


# Convenience guard for admin-only / sensitive PII operations.
require_admin = require_roles(RoleName.ADMIN)
