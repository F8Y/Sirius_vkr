#!/bin/bash
# =============================================================
# Сириус 27 — PostgreSQL init script
# Runs once on first container start (via /docker-entrypoint-initdb.d).
#
# Shell script (not plain .sql) so that env vars — VAULT_ROLE_PASSWORD,
# POSTGRES_DB — are interpolated by the Postgres entrypoint.
#
# Scope: infrastructure only — extensions, schemas, roles, search_path.
# All tables are managed by Alembic migrations (backend/).
# =============================================================
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- ── Extensions ───────────────────────────────────────────
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- ── Schemas ──────────────────────────────────────────────
    CREATE SCHEMA IF NOT EXISTS core;
    CREATE SCHEMA IF NOT EXISTS vault;

    -- ── Vault role (isolated access to vault schema only) ────
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vault_role') THEN
            CREATE ROLE vault_role LOGIN PASSWORD '${VAULT_ROLE_PASSWORD}';
        END IF;
    END
    \$\$;

    -- vault_role: access to vault schema only
    GRANT USAGE ON SCHEMA vault TO vault_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA vault
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vault_role;

    -- Explicitly deny vault_role access to core schema
    REVOKE ALL ON SCHEMA core FROM vault_role;

    -- ── Default search_path for main app user ────────────────
    ALTER DATABASE "${POSTGRES_DB}" SET search_path TO core, public;
EOSQL
