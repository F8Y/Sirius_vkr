"""Сириус 27 — Backend API."""

import contextlib
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.database import async_session_factory, engine
from app.core.redis import close_redis, init_redis
from app.services.auth_service import ensure_bootstrap_admin


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle."""
    # Startup
    redis = await init_redis()

    # Ensure consumer group exists for the stream
    with contextlib.suppress(Exception):
        await redis.xgroup_create(
            name=settings.stream_name,
            groupname=settings.consumer_group,
            id="0",
            mkstream=True,
        )

    # Idempotently provision a bootstrap admin when configured via env.
    if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
        async with async_session_factory() as session:
            await ensure_bootstrap_admin(
                session,
                settings.bootstrap_admin_email,
                settings.bootstrap_admin_password,
            )

    yield

    # Shutdown
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="Сириус 27 API",
    description="API для управления данными регионального центра «Сириус 27»",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, Any]:
    """Check availability of Postgres and Redis."""
    status_report: dict[str, Any] = {"status": "ok", "services": {}}

    # Check Postgres
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status_report["services"]["postgres"] = "ok"
    except Exception as e:
        status_report["status"] = "degraded"
        status_report["services"]["postgres"] = f"error: {e}"

    # Check Redis
    try:
        from app.core.redis import redis_client

        if redis_client is not None:
            await redis_client.ping()
            status_report["services"]["redis"] = "ok"
        else:
            status_report["status"] = "degraded"
            status_report["services"]["redis"] = "not initialized"
    except Exception as e:
        status_report["status"] = "degraded"
        status_report["services"]["redis"] = f"error: {e}"

    return status_report
