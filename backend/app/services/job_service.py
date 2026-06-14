"""Job creation service — separates business logic from the HTTP layer."""

from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.queue.publisher import publish_job
from app.schemas.job import JobCreate, JobStreamMessage


async def create_job(body: JobCreate, db: AsyncSession, redis: aioredis.Redis) -> Job:
    """Persist a new Job and enqueue it to the Redis Stream."""
    job = Job(
        type=body.type.value,
        status="pending",
        progress=0,
    )
    db.add(job)
    await db.flush()

    stream_msg = JobStreamMessage(
        job_id=str(job.id),
        type=body.type,
        payload=body.payload,
        created_at=datetime.now(tz=UTC).isoformat(),
    )

    await db.commit()
    await db.refresh(job)

    # Publish only after the row is visible to the worker
    await publish_job(redis, stream_msg)

    return job
