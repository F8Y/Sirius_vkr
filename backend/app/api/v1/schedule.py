"""API v1 — weekly schedule (all authenticated users).

Staff see the full timetable; a child sees only their own groups' slots, a
parent sees the union of their children's groups."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import RoleName
from app.schemas.learning import ScheduleItem
from app.services import learning_service

router = APIRouter(prefix="/api/v1/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleItem])
async def get_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ScheduleItem]:
    role_names = {role.name for role in current_user.roles}
    staff = {RoleName.TEACHER.value, RoleName.ADMIN.value}
    if role_names & staff:
        return await learning_service.list_schedule(db)

    # Child/parent: restrict to the relevant students' groups.
    student_ids: list = []
    if RoleName.CHILD.value in role_names:
        own = await learning_service.resolve_student_for_user(db, current_user.id)
        if own is not None:
            student_ids.append(own)
    if RoleName.PARENT.value in role_names:
        student_ids.extend(await learning_service.resolve_children_ids(db, current_user.id))

    return await learning_service.list_schedule(db, student_ids)
