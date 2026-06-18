"""API v1 — dataset upload (admin-only) feeding the import pipeline."""

import uuid
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobPayload, JobResponse, JobType
from app.services.job_service import create_job as svc_create_job

router = APIRouter(prefix="/api/v1/data", tags=["data"])

_ALLOWED_SUFFIXES = {".csv", ".xlsx"}
# The Go importer looks for these base names inside the upload directory.
_KNOWN_BASES = {"students", "guardians", "student_guardian"}


@router.post("/upload", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    _: User = Depends(require_admin),
) -> Job:
    """Receive CSV/Excel files, persist them, and enqueue an import job.

    Bulk PII handling — admin only (§1). Files are stored under
    ``<import_dir>/<job-scoped uuid>/`` preserving their original names so the
    worker can locate ``students.csv`` / ``guardians.csv`` / etc.
    """
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files uploaded")

    batch_id = uuid.uuid4()
    target_dir = Path(settings.import_dir) / str(batch_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    saved_any = False
    for upload in files:
        name = Path(upload.filename or "").name
        suffix = Path(name).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Unsupported file type {suffix!r}; expected CSV or Excel",
            )
        if Path(name).stem.lower() not in _KNOWN_BASES:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Unexpected file {name!r}; name it students/guardians/student_guardian",
            )
        content = await upload.read()
        (target_dir / name).write_bytes(content)
        saved_any = True

    if not saved_any:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No valid files in upload")

    body = JobCreate(
        type=JobType.IMPORT,
        payload=JobPayload(file_path=str(target_dir)),
    )
    return await svc_create_job(body, db, redis)
