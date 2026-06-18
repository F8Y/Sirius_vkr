"""API v1 — learning analytics summary (teacher/admin)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff
from app.core.database import get_db
from app.schemas.learning import AnalyticsSummary
from app.services import learning_service

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_staff)],
)


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(db: AsyncSession = Depends(get_db)) -> AnalyticsSummary:
    return await learning_service.analytics_summary(db)
