"""Alembic async migration environment for Сириус 27."""

import asyncio
from logging.config import fileConfig
from typing import Any

from alembic import context
from sqlalchemy import Connection, pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Load all models so their tables are registered on Base.metadata.
import app.models  # noqa: F401
from app.core.config import settings
from app.models.base import Base

alembic_cfg = context.config
fileConfig(alembic_cfg.config_file_name)  # type: ignore[arg-type]

target_metadata = Base.metadata


def _include_object(
    obj: Any, name: str | None, type_: str, reflected: bool, compare_to: Any
) -> bool:
    """Limit Alembic autogenerate to the schemas we own."""
    if type_ == "table":
        schema = getattr(obj, "schema", None)
        return schema in ("core", "vault")
    return True


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    url = settings.database_url.replace("+asyncpg", "")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        include_object=_include_object,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live DB using asyncpg."""
    cfg_section = alembic_cfg.get_section(alembic_cfg.config_ini_section, {})
    cfg_section["sqlalchemy.url"] = settings.database_url

    connectable = async_engine_from_config(
        cfg_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
