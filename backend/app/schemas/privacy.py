"""Pydantic v2 DTOs for the privacy contour (consents & subject-rights requests)."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class SubjectType(StrEnum):
    STUDENT = "student"
    GUARDIAN = "guardian"


class RequestType(StrEnum):
    """Data-subject right being exercised (152-ФЗ)."""

    EXPORT = "export"  # art. 14 — right of access
    DELETE = "delete"  # art. 20 — right to object / erase


class RequestStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    REJECTED = "rejected"


# ── Consents ────────────────────────────────────────────────


class ConsentItem(BaseModel):
    """A single consent record joined with the decrypted subject name."""

    id: uuid.UUID
    subject_type: SubjectType
    subject_id: uuid.UUID
    subject_name: str
    purpose: str
    granted: bool
    granted_at: datetime | None = None
    revoked_at: datetime | None = None


class ConsentKpi(BaseModel):
    """Aggregate figures for the privacy dashboard plates."""

    subjects_total: int
    consents_total: int
    granted: int
    revoked: int
    subjects_without_consent: int


class SyncResult(BaseModel):
    created: int


# ── Subject-rights requests ─────────────────────────────────


class SubjectRequestCreate(BaseModel):
    subject_type: SubjectType
    subject_id: uuid.UUID
    request_type: RequestType
    note: str | None = None


class SubjectRequestUpdate(BaseModel):
    status: RequestStatus


class SubjectRequestItem(BaseModel):
    id: uuid.UUID
    subject_type: SubjectType
    subject_id: uuid.UUID
    subject_name: str
    request_type: RequestType
    status: RequestStatus
    note: str | None = None
    created_at: datetime
    due_at: datetime
    resolved_at: datetime | None = None
    overdue: bool


# ── Subject card ────────────────────────────────────────────


class SubjectSummary(BaseModel):
    subject_type: SubjectType
    subject_id: uuid.UUID
    subject_name: str


class SubjectCard(BaseModel):
    """Full registry card for one data subject (consents + rights)."""

    subject: SubjectSummary
    consents: list[ConsentItem]
    requests: list[SubjectRequestItem]
