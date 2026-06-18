"""API v1 — course enrolment (child self-service)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import RoleName
from app.schemas.learning import EnrollmentCreate, EnrollmentItem
from app.services import learning_service

router = APIRouter(prefix="/api/v1/enrollments", tags=["enrollments"])

require_child = require_roles(RoleName.CHILD)


@router.post("", response_model=EnrollmentItem, status_code=status.HTTP_201_CREATED)
async def enroll(
    body: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_child),
) -> EnrollmentItem:
    student_id = await learning_service.resolve_student_for_user(db, current_user.id)
    if student_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No student profile linked to this account")
    try:
        return await learning_service.create_enrollment(db, student_id, body.group_id)
    except learning_service.LearningError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
