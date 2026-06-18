"""API v1 — courses. Catalogue is readable by any authenticated user; creating
and publishing courses is restricted to teacher/admin."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_staff
from app.core.database import get_db
from app.models.user import User
from app.schemas.learning import CourseCreate, CourseDetail, CourseSummary
from app.services import learning_service

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


@router.get("", response_model=list[CourseSummary])
async def list_courses(
    direction: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CourseSummary]:
    return await learning_service.list_courses(db, direction)


@router.get("/{course_id}", response_model=CourseDetail)
async def get_course(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CourseDetail:
    course = await learning_service.get_course_detail(db, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    return course


@router.post("", response_model=CourseSummary, status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> CourseSummary:
    return await learning_service.create_course(db, body, current_user.id)


@router.put("/{course_id}/publish", response_model=CourseSummary)
async def publish_course(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
) -> CourseSummary:
    course = await learning_service.publish_course(db, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found or archived")
    return course
