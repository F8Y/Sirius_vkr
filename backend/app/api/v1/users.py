"""API v1 — user & role administration (admin-only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import AssignRolesRequest, UserResponse
from app.services import auth_service
from app.services.auth_service import AuthError

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[UserResponse]:
    """List all accounts (admin only)."""
    result = await db.execute(select(User).order_by(User.created_at))
    return [auth_service.to_user_response(u) for u in result.scalars().all()]


@router.put("/{user_id}/roles", response_model=UserResponse)
async def assign_roles(
    user_id: uuid.UUID,
    body: AssignRolesRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Replace a user's role set (admin only) — the only way to grant teacher/admin."""
    user = await auth_service.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
        )
    try:
        user = await auth_service.set_user_roles(db, user, body.roles)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return auth_service.to_user_response(user)
