"""Privacy contour business logic: consent register & data-subject requests.

Subject names are reconstructed from the encrypted PII columns through the
``vault.decrypt_pii`` SQL function — the single sanctioned decryption path. Raw
plaintext never lives in these tables.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.privacy import (
    ConsentItem,
    ConsentKpi,
    RequestStatus,
    SubjectCard,
    SubjectRequestCreate,
    SubjectRequestItem,
    SubjectSummary,
    SubjectType,
)

# Statutory window for answering a data-subject request (152-ФЗ, ~10 working days).
_DUE_DAYS = 10

# Default lawful purpose used when bootstrapping the consent register.
_DEFAULT_PURPOSE = "Оказание образовательных услуг"

# Reconstruct a display name from the encrypted columns of a core table.
_NAME_EXPR = (
    "trim(vault.decrypt_pii(t.last_name) || ' ' || vault.decrypt_pii(t.first_name) "
    "|| coalesce(' ' || vault.decrypt_pii(t.middle_name), ''))"
)

_SUBJECT_TABLE = {SubjectType.STUDENT: "core.students", SubjectType.GUARDIAN: "core.guardians"}


async def _subject_name(db: AsyncSession, subject_type: SubjectType, subject_id: uuid.UUID) -> str:
    table = _SUBJECT_TABLE[subject_type]
    row = await db.execute(
        text(f"SELECT {_NAME_EXPR} AS name FROM {table} t WHERE t.id = :sid"),
        {"sid": subject_id},
    )
    name = row.scalar_one_or_none()
    return name or "—"


# ── Consents ────────────────────────────────────────────────


async def list_consents(db: AsyncSession) -> list[ConsentItem]:
    """All consent records, joined with the decrypted subject name."""
    sql = text(
        f"""
        SELECT c.id, c.subject_type, c.subject_id, c.purpose, c.granted,
               c.granted_at, c.revoked_at,
               COALESCE(s_name.name, g_name.name, '—') AS subject_name
        FROM vault.consent c
        LEFT JOIN LATERAL (
            SELECT {_NAME_EXPR} AS name FROM core.students t
            WHERE c.subject_type = 'student' AND t.id = c.subject_id
        ) s_name ON true
        LEFT JOIN LATERAL (
            SELECT {_NAME_EXPR} AS name FROM core.guardians t
            WHERE c.subject_type = 'guardian' AND t.id = c.subject_id
        ) g_name ON true
        ORDER BY c.created_at DESC
        """
    )
    rows = await db.execute(sql)
    return [ConsentItem(**dict(r._mapping)) for r in rows]


async def consent_kpi(db: AsyncSession) -> ConsentKpi:
    subjects_total = (
        await db.execute(
            text(
                "SELECT (SELECT count(*) FROM core.students) "
                "+ (SELECT count(*) FROM core.guardians)"
            )
        )
    ).scalar_one()
    consents_total = (await db.execute(text("SELECT count(*) FROM vault.consent"))).scalar_one()
    granted = (
        await db.execute(text("SELECT count(*) FROM vault.consent WHERE granted"))
    ).scalar_one()
    revoked = (
        await db.execute(text("SELECT count(*) FROM vault.consent WHERE revoked_at IS NOT NULL"))
    ).scalar_one()
    subjects_with = (
        await db.execute(
            text("SELECT count(DISTINCT (subject_type, subject_id)) FROM vault.consent")
        )
    ).scalar_one()
    return ConsentKpi(
        subjects_total=subjects_total,
        consents_total=consents_total,
        granted=granted,
        revoked=revoked,
        subjects_without_consent=max(subjects_total - subjects_with, 0),
    )


async def sync_consents(db: AsyncSession) -> int:
    """Idempotently create a granted consent for every subject that lacks one.

    Bootstraps the register so it reflects the imported population — every data
    subject enters the system with a recorded lawful basis for processing.
    """
    sql = text(
        """
        INSERT INTO vault.consent (subject_type, subject_id, purpose, granted, granted_at)
        SELECT src.subject_type, src.id, :purpose, true, now()
        FROM (
            SELECT 'student'::text AS subject_type, id FROM core.students
            UNION ALL
            SELECT 'guardian'::text AS subject_type, id FROM core.guardians
        ) src
        WHERE NOT EXISTS (
            SELECT 1 FROM vault.consent c
            WHERE c.subject_type = src.subject_type AND c.subject_id = src.id
        )
        """
    )
    result = await db.execute(sql, {"purpose": _DEFAULT_PURPOSE})
    await db.commit()
    return result.rowcount or 0


# ── Subject-rights requests ─────────────────────────────────


def _request_item(row_mapping: dict) -> SubjectRequestItem:
    data = dict(row_mapping)
    due_at: datetime = data["due_at"]
    resolved = data.get("resolved_at")
    overdue = (
        resolved is None
        and due_at < datetime.now(tz=UTC)
        and data["status"]
        in (
            RequestStatus.NEW,
            RequestStatus.IN_PROGRESS,
        )
    )
    return SubjectRequestItem(overdue=overdue, **data)


async def list_requests(db: AsyncSession) -> list[SubjectRequestItem]:
    sql = text(
        f"""
        SELECT r.id, r.subject_type, r.subject_id, r.request_type, r.status,
               r.note, r.created_at, r.due_at, r.resolved_at,
               COALESCE(s_name.name, g_name.name, '—') AS subject_name
        FROM vault.subject_request r
        LEFT JOIN LATERAL (
            SELECT {_NAME_EXPR} AS name FROM core.students t
            WHERE r.subject_type = 'student' AND t.id = r.subject_id
        ) s_name ON true
        LEFT JOIN LATERAL (
            SELECT {_NAME_EXPR} AS name FROM core.guardians t
            WHERE r.subject_type = 'guardian' AND t.id = r.subject_id
        ) g_name ON true
        ORDER BY r.created_at DESC
        """
    )
    rows = await db.execute(sql)
    return [_request_item(r._mapping) for r in rows]


async def create_request(db: AsyncSession, body: SubjectRequestCreate) -> SubjectRequestItem:
    now = datetime.now(tz=UTC)
    due = now + timedelta(days=_DUE_DAYS)
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO vault.subject_request
                (id, subject_type, subject_id, request_type, status, note, created_at, due_at)
            VALUES (:id, :stype, :sid, :rtype, 'new', :note, :created, :due)
            """
        ),
        {
            "id": new_id,
            "stype": body.subject_type.value,
            "sid": body.subject_id,
            "rtype": body.request_type.value,
            "note": body.note,
            "created": now,
            "due": due,
        },
    )
    await db.commit()
    name = await _subject_name(db, body.subject_type, body.subject_id)
    return SubjectRequestItem(
        id=new_id,
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        subject_name=name,
        request_type=body.request_type,
        status=RequestStatus.NEW,
        note=body.note,
        created_at=now,
        due_at=due,
        resolved_at=None,
        overdue=False,
    )


async def update_request_status(
    db: AsyncSession, request_id: uuid.UUID, status: RequestStatus
) -> bool:
    resolved = (
        datetime.now(tz=UTC) if status in (RequestStatus.DONE, RequestStatus.REJECTED) else None
    )
    result = await db.execute(
        text(
            """
            UPDATE vault.subject_request
            SET status = :status, resolved_at = :resolved
            WHERE id = :id
            """
        ),
        {"status": status.value, "resolved": resolved, "id": request_id},
    )
    await db.commit()
    return (result.rowcount or 0) > 0


# ── Subject card & directory ────────────────────────────────


async def list_subjects(db: AsyncSession) -> list[SubjectSummary]:
    """Directory of all data subjects (students + guardians) with names."""
    sql = text(
        f"""
        SELECT 'student' AS subject_type, t.id AS subject_id, {_NAME_EXPR} AS subject_name
        FROM core.students t
        UNION ALL
        SELECT 'guardian' AS subject_type, t.id AS subject_id, {_NAME_EXPR} AS subject_name
        FROM core.guardians t
        ORDER BY subject_name
        """
    )
    rows = await db.execute(sql)
    return [SubjectSummary(**dict(r._mapping)) for r in rows]


async def get_subject_card(
    db: AsyncSession, subject_type: SubjectType, subject_id: uuid.UUID
) -> SubjectCard:
    name = await _subject_name(db, subject_type, subject_id)
    consents = [c for c in await list_consents(db) if c.subject_id == subject_id]
    requests = [r for r in await list_requests(db) if r.subject_id == subject_id]
    return SubjectCard(
        subject=SubjectSummary(
            subject_type=subject_type, subject_id=subject_id, subject_name=name
        ),
        consents=consents,
        requests=requests,
    )
