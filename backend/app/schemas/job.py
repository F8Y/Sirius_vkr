"""Pydantic v2 DTOs for job endpoints and Redis Stream contract."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class JobType(StrEnum):
    """Allowed job types."""

    IMPORT = "import"
    ANONYMIZE = "anonymize"


class JobStatus(StrEnum):
    """Allowed job statuses."""

    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


# ── API DTOs ────────────────────────────────────────────────


class JobPayload(BaseModel):
    """Payload embedded in a job."""

    file_path: str | None = None
    dataset_id: str | None = None


class JobCreate(BaseModel):
    """Request body for POST /api/v1/jobs."""

    type: JobType
    payload: JobPayload = Field(default_factory=JobPayload)

    @model_validator(mode="after")
    def _require_file_path_for_import(self) -> "JobCreate":
        """An import job must point at a dataset to read (file_path)."""
        if self.type == JobType.IMPORT and not self.payload.file_path:
            raise ValueError("import jobs require payload.file_path")
        return self


class JobResponse(BaseModel):
    """Response body for job endpoints."""

    id: uuid.UUID
    type: JobType
    status: JobStatus
    progress: int
    error: str | None = None
    result: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Redis Stream contract ───────────────────────────────────


class JobStreamMessage(BaseModel):
    """Message published to Redis Stream — mirrored by Go worker struct."""

    job_id: str
    type: JobType
    payload: JobPayload
    created_at: str  # ISO 8601 string for cross-language compat
