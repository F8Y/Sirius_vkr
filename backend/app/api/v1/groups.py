"""API v1 — groups and group membership (teacher/admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff
from app.core.database import get_db
from app.schemas.learning import GroupDetail, GroupMembersUpdate, GroupSummary
from app.services import learning_service

router = APIRouter(
    prefix="/api/v1/groups",
    tags=["groups"],
    dependencies=[Depends(require_staff)],
)


@router.get("", response_model=list[GroupSummary])
async def list_groups(
    course_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[GroupSummary]:
    return await learning_service.list_groups(db, course_id)


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> GroupDetail:
    group = await learning_service.get_group_detail(db, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Group {group_id} not found")
    return group


@router.put("/{group_id}/members", response_model=GroupDetail)
async def update_members(
    group_id: uuid.UUID,
    body: GroupMembersUpdate,
    db: AsyncSession = Depends(get_db),
) -> GroupDetail:
    """Transfer the listed students into this group (within the same course)."""
    group = await learning_service.update_group_members(db, group_id, body.student_ids)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Group {group_id} not found")
    return group
