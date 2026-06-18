"""API v1 — student performance registry (teacher/admin).

Names are decrypted server-side via ``vault.decrypt_pii``; the response carries
display names and learning progress only, never ciphertext."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff
from app.core.database import get_db
from app.schemas.learning import StudentRegistryItem
from app.services import learning_service

router = APIRouter(
    prefix="/api/v1/students",
    tags=["students"],
    dependencies=[Depends(require_staff)],
)


@router.get("", response_model=list[StudentRegistryItem])
async def list_students(db: AsyncSession = Depends(get_db)) -> list[StudentRegistryItem]:
    return await learning_service.list_student_registry(db)
