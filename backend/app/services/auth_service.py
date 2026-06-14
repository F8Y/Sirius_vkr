"""Authentication & user/role business logic — kept out of the HTTP layer."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import Role, User, UserRole
from app.schemas.auth import RoleName, UserResponse


class AuthError(Exception):
    """Raised for recoverable auth failures (mapped to HTTP errors in routers)."""


def to_user_response(user: User) -> UserResponse:
    """Serialize a User (with roles loaded) to the public DTO."""
    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        roles=sorted(role.name for role in user.roles),
        created_at=user.created_at,
    )


async def _roles_by_name(db: AsyncSession, names: list[RoleName]) -> list[Role]:
    wanted = [name.value for name in names]
    result = await db.execute(select(Role).where(Role.name.in_(wanted)))
    return list(result.scalars().all())


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def register_user(
    db: AsyncSession, email: str, password: str, roles: list[RoleName]
) -> User:
    """Create a new account. ``email`` is the plaintext login; password is hashed."""
    role_objs = await _roles_by_name(db, roles)
    if len(role_objs) != len(set(roles)):
        raise AuthError("Unknown role requested")

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise AuthError("Email already registered") from exc

    for role in role_objs:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    """Return the user if credentials are valid and the account is active."""
    user = await get_user_by_email(db, email)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def set_user_roles(db: AsyncSession, user: User, roles: list[RoleName]) -> User:
    """Replace a user's role set (admin operation)."""
    role_objs = await _roles_by_name(db, roles)
    if len(role_objs) != len(set(roles)):
        raise AuthError("Unknown role requested")

    await db.execute(delete(UserRole).where(UserRole.user_id == user.id))
    for role in role_objs:
        db.add(UserRole(user_id=user.id, role_id=role.id))
    await db.commit()
    await db.refresh(user)
    return user


async def ensure_bootstrap_admin(db: AsyncSession, email: str, password: str) -> None:
    """Idempotently ensure an admin account exists (called on startup)."""
    existing = await get_user_by_email(db, email)
    if existing is not None:
        return
    await register_user(db, email, password, [RoleName.ADMIN])
