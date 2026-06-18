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


class AnonymizeMode(StrEnum):
    """De-identification mode for an anonymize job.

    These are legally and technically distinct (see CLAUDE.md):
      * PSEUDONYMIZE — reversible token substitution; the data legally remains
        personal and is restorable through the vault.
      * ANONYMIZE    — irreversible transformation (masking, generalization,
        removal); no reverse mapping is kept.
    """

    PSEUDONYMIZE = "pseudonymize"
    ANONYMIZE = "anonymize"


class Dataset(StrEnum):
    """Datasets the anonymize pipeline can act on."""

    STUDENTS = "students"
    GUARDIANS = "guardians"


# ── API DTOs ────────────────────────────────────────────────


class JobPayload(BaseModel):
    """Payload embedded in a job.

    ``file_path`` drives import jobs; ``mode`` and ``dataset`` drive anonymize
    jobs. ``dataset_id`` is reserved for future addressing of a stored dataset.
    """

    file_path: str | None = None
    dataset_id: str | None = None
    mode: AnonymizeMode | None = None
    dataset: Dataset | None = None


class JobCreate(BaseModel):
    """Request body for POST /api/v1/jobs."""

    type: JobType
    payload: JobPayload = Field(default_factory=JobPayload)

    @model_validator(mode="after")
    def _validate_payload(self) -> "JobCreate":
        """Enforce the payload each job type needs to run."""
        if self.type == JobType.IMPORT and not self.payload.file_path:
            raise ValueError("import jobs require payload.file_path")
        if self.type == JobType.ANONYMIZE and self.payload.mode is None:
            raise ValueError("anonymize jobs require payload.mode (pseudonymize | anonymize)")
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
