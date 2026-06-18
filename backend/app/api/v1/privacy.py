"""API v1 — privacy contour: consent register & data-subject requests (admin-only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.schemas.privacy import (
    ConsentItem,
    ConsentKpi,
    SubjectCard,
    SubjectRequestCreate,
    SubjectRequestItem,
    SubjectRequestUpdate,
    SubjectSummary,
    SubjectType,
    SyncResult,
)
from app.services import privacy_service

router = APIRouter(
    prefix="/api/v1/privacy",
    tags=["privacy"],
    dependencies=[Depends(require_admin)],
)


@router.get("/consents", response_model=list[ConsentItem])
async def list_consents(db: AsyncSession = Depends(get_db)) -> list[ConsentItem]:
    return await privacy_service.list_consents(db)


@router.get("/consents/kpi", response_model=ConsentKpi)
async def consent_kpi(db: AsyncSession = Depends(get_db)) -> ConsentKpi:
    return await privacy_service.consent_kpi(db)


@router.post("/consents/sync", response_model=SyncResult)
async def sync_consents(db: AsyncSession = Depends(get_db)) -> SyncResult:
    """Bootstrap a granted consent for every imported subject lacking one."""
    created = await privacy_service.sync_consents(db)
    return SyncResult(created=created)


@router.get("/subjects", response_model=list[SubjectSummary])
async def list_subjects(db: AsyncSession = Depends(get_db)) -> list[SubjectSummary]:
    return await privacy_service.list_subjects(db)


@router.get("/subjects/{subject_type}/{subject_id}", response_model=SubjectCard)
async def get_subject_card(
    subject_type: SubjectType,
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SubjectCard:
    return await privacy_service.get_subject_card(db, subject_type, subject_id)


@router.get("/requests", response_model=list[SubjectRequestItem])
async def list_requests(db: AsyncSession = Depends(get_db)) -> list[SubjectRequestItem]:
    return await privacy_service.list_requests(db)


@router.post("/requests", response_model=SubjectRequestItem, status_code=status.HTTP_201_CREATED)
async def create_request(
    body: SubjectRequestCreate, db: AsyncSession = Depends(get_db)
) -> SubjectRequestItem:
    return await privacy_service.create_request(db, body)


@router.patch("/requests/{request_id}", response_model=SubjectRequestItem)
async def update_request(
    request_id: uuid.UUID,
    body: SubjectRequestUpdate,
    db: AsyncSession = Depends(get_db),
) -> SubjectRequestItem:
    ok = await privacy_service.update_request_status(db, request_id, body.status)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Request {request_id} not found")
    items = await privacy_service.list_requests(db)
    for item in items:
        if item.id == request_id:
            return item
    raise HTTPException(status.HTTP_404_NOT_FOUND, f"Request {request_id} not found")
