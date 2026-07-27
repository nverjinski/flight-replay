FROM python:3.12-slim

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dependency layer first (better Docker cache)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# App source + migrations
COPY README.md ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
# Inside Compose, hostname is the service name `db`, not localhost
ENV DATABASE_URL=postgresql+psycopg://flight:flight@db:5432/flight_replay

EXPOSE 8000

# Migrate then serve. `exec` replaces the shell so signals reach uvicorn.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn flight_replay.api.app:app --host 0.0.0.0 --port 8000"]