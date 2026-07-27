# flight-replay (backend)

Python package for flight telemetry validation, stats, normalization, JSONL→Postgres import, and a FastAPI layer that serves flights from the database to the replay UI.

## Setup

### Option A — Full stack via Compose (recommended smoke path)

From the **repo root**:

```bash
docker compose up -d --build
```

Then from `backend/`, import against the published DB port:

```bash
cd backend
uv sync --extra dev
export DATABASE_URL=postgresql+psycopg://flight:flight@localhost:5432/flight_replay
uv run flight-replay import ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl \
  --origin KMOB --destination KPNS
```

API: [http://localhost:8000](http://localhost:8000). The container runs migrations on start.

### Option B — DB in Compose, API on the host (faster reload)

```bash
# repo root
docker compose up -d db

cd backend
uv sync --extra dev
export DATABASE_URL=postgresql+psycopg://flight:flight@localhost:5432/flight_replay
uv run alembic upgrade head
uv run flight-replay import ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl \
  --origin KMOB --destination KPNS
make api
```

Do not run Compose `api` and `make api` together (both use port 8000).

Optional env (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+psycopg://flight:flight@localhost:5432/flight_replay` | Host CLI / local `make api` |
| `FLIGHT_REPLAY_DATA_DIR` | `<repo>/data/raw` | JSONL paths for the file-backed store (tests / override only) |

Inside the **API container**, Compose sets `DATABASE_URL` with host `db` (not `localhost`).

## Docker Compose

From the **repo root**:

```bash
docker compose up -d --build    # db + api
docker compose logs -f api
docker compose ps
docker compose down             # keep Postgres volume
# docker compose down -v      # wipe DB data
```

| Service | Role |
|---------|------|
| `db` | Postgres 16 (`flight` / `flight` / `flight_replay`), port 5432 |
| `api` | Built from [`Dockerfile`](Dockerfile); `alembic upgrade head` then uvicorn on 8000 |

`replay` is not in Compose yet (Phase 3).

## CLI

Run from `backend/`:

```bash
uv run flight-replay --help
uv run flight-replay validate ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl
uv run flight-replay stats ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl
uv run flight-replay normalize ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl -o ../data/normalized/kmob-kpns.jsonl
uv run flight-replay import ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl --origin KMOB --destination KPNS
```

`import` upserts a `flights` row and replaces that flight’s `telemetry_points` (idempotent re-run). Optional `--flight-id` overrides the id stored in the DB.

## Migrations

```bash
uv run alembic upgrade head          # apply migrations (host)
uv run alembic revision --autogenerate -m "describe change"
uv run alembic current
```

Schema is owned by Alembic (`alembic/versions/`), not `create_all` in app code. The Compose `api` image also runs `alembic upgrade head` on startup.

## API

The API defaults to **Postgres** via `PostgresFlightStore` (request-scoped SQLAlchemy session). Import a flight before expecting `/flights` to return data.

```bash
make api
# equivalent:
# uv run uvicorn flight_replay.api.app:app --reload --app-dir src --port 8000
```

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness |
| `GET` | `/flights` | Flight summaries from the DB |
| `GET` | `/flights/{id}` | One summary |
| `GET` | `/flights/{id}/telemetry` | Normalized points (optional filters below) |
| `GET` | `/flights/{id}/events` | Event list (empty until Phase 4 detectors) |

### Telemetry query params

All optional. Omit them for the full flight (what the React UI uses today).

| Param | Meaning |
|-------|---------|
| `start_ms` | Include points with `elapsed_ms >= start_ms` |
| `end_ms` | Include points with `elapsed_ms <= end_ms` |
| `limit` | Max number of points |
| `offset` | Skip the first N points (after filters) |

Examples:

```bash
curl -s http://localhost:8000/flights
curl -s "http://localhost:8000/flights/KMOB-KPNS-20260721-001/telemetry?limit=2"
curl -s http://localhost:8000/flights/KMOB-KPNS-20260721-001/events
```

CORS allows `http://localhost:5173` (Vite). OpenAPI UI: [http://localhost:8000/docs](http://localhost:8000/docs).

Demo flight id after import: `KMOB-KPNS-20260721-001`.

API unit tests still inject `FileFlightStore` via FastAPI `dependency_overrides` so they do not require Postgres. Integration tests that hit the DB skip automatically when Postgres is down.

## Quality checks

From `backend/`:

```bash
make fmt     # auto-format + apply safe ruff fixes
make check   # format check, lint, mypy, pytest (CI-style)
make test    # pytest with coverage
make api     # run FastAPI with reload
```

## Layout

- `Dockerfile` / `.dockerignore` — image for Compose `api`
- `src/flight_replay/` — Pydantic models, readers, normalize, stats, CLI
- `src/flight_replay/db/` — SQLAlchemy session/models, import, `PostgresFlightStore`
- `src/flight_replay/api/` — FastAPI app, routes, schemas, `FlightStore` Protocol + file store for tests
- `alembic/` — migrations
- `tests/` — pytest (API `TestClient`, import mapper, optional DB integration)
