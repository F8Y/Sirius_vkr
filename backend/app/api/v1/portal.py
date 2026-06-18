"""API v1 — child/parent portal: personal dashboard, achievements, children list.

A child sees their own student record. A parent observes their children; the
dashboard/achievements endpoints accept an optional ``student_id`` to pick which
child to view (validated against the parent's linked children), defaulting to
the first child."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_portal, require_roles
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import RoleName
from app.schemas.learning import AchievementsResponse, ChildItem, DashboardResponse
from app.services import learning_service

router = APIRouter(prefix="/api/v1", tags=["portal"])

require_parent = require_roles(RoleName.PARENT)


async def _resolve_target_student(
    db: AsyncSession, user: User, student_id: uuid.UUID | None
) -> uuid.UUID:
    """Resolve which student the caller may view, honouring role boundaries."""
    role_names = {role.name for role in user.roles}

    if RoleName.CHILD.value in role_names:
        own = await learning_service.resolve_student_for_user(db, user.id)
        if own is not None and (student_id is None or student_id == own):
            return own

    if RoleName.PARENT.value in role_names:
        children = await learning_service.resolve_children_ids(db, user.id)
        if student_id is not None:
            if student_id not in children:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to view this student")
            return student_id
        if children:
            return children[0]

    raise HTTPException(status.HTTP_404_NOT_FOUND, "No student profile available")


@router.get("/me/dashboard", response_model=DashboardResponse)
async def my_dashboard(
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_portal),
) -> DashboardResponse:
    target = await _resolve_target_student(db, current_user, student_id)
    return await learning_service.get_dashboard(db, target)


@router.get("/me/achievements", response_model=AchievementsResponse)
async def my_achievements(
    student_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_portal),
) -> AchievementsResponse:
    target = await _resolve_target_student(db, current_user, student_id)
    return await learning_service.get_achievements(db, target)


@router.get("/children", response_model=list[ChildItem])
async def my_children(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_parent),
) -> list[ChildItem]:
    return await learning_service.list_children(db, current_user.id)
