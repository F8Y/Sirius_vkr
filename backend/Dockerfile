# ── Stage 1: Install dependencies ──────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy only the dependency manifest first (layer cache)
COPY pyproject.toml .

# Install project dependencies into a virtualenv inside /app/.venv
RUN uv venv .venv && \
    uv pip install --python .venv/bin/python --no-cache .

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM python:3.12-slim AS runner

WORKDIR /app

# Copy virtualenv from builder
COPY --from=builder /app/.venv .venv

# Copy application source and Alembic config
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Run migrations then start the API server.
# Using shell form so the && chain works correctly.
CMD alembic upgrade head && \
    uvicorn app.main:app --host 0.0.0.0 --port 8000
