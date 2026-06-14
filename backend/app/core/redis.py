"""Async Redis client."""

from collections.abc import AsyncGenerator

import redis.asyncio as aioredis

from app.core.config import settings

redis_client: aioredis.Redis | None = None


async def init_redis() -> aioredis.Redis:
    """Create and return the global Redis connection."""
    global redis_client
    redis_client = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    return redis_client


async def close_redis() -> None:
    """Close the global Redis connection."""
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """FastAPI dependency — yields the Redis client."""
    if redis_client is None:
        raise RuntimeError("Redis is not initialized")
    yield redis_client
