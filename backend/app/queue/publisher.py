"""Publish job messages to Redis Stream."""

import redis.asyncio as aioredis

from app.core.config import settings
from app.schemas.job import JobStreamMessage


async def ensure_consumer_group(redis: aioredis.Redis) -> None:
    """Create the consumer group if it does not exist yet."""
    try:
        await redis.xgroup_create(
            name=settings.stream_name,
            groupname=settings.consumer_group,
            id="0",
            mkstream=True,
        )
    except aioredis.ResponseError as e:
        # Group already exists — that's fine
        if "BUSYGROUP" not in str(e):
            raise


async def publish_job(redis: aioredis.Redis, message: JobStreamMessage) -> str:
    """Publish a job message to the Redis Stream. Returns the stream message ID."""
    await ensure_consumer_group(redis)

    msg_id = await redis.xadd(
        name=settings.stream_name,
        fields={"data": message.model_dump_json()},
    )
    return str(msg_id)
