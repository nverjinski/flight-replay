# flight-replay (backend)

Python package for flight telemetry validation, stats, normalization, and a thin FastAPI layer that serves normalized points to the replay UI.

## Setup

```bash
cd backend
uv sync --extra dev
```

Optional env (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `FLIGHT_REPLAY_DATA_DIR` | `<repo>/data/raw` | Directory containing registered JSONL flights |

## CLI

```bash
uv run flight-replay --help
uv run flight-replay validate ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl
uv run flight-replay stats ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl
uv run flight-replay normalize ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl -o ../data/normalized/kmob-kpns.jsonl
```

## API

```bash
make api
# equivalent:
# uv run uvicorn flight_replay.api.app:app --reload --app-dir src --port 8000
```

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness |
| `GET` | `/flights` | Registered flight summaries |
| `GET` | `/flights/{id}` | One summary |
| `GET` | `/flights/{id}/telemetry` | Full normalized point array |

CORS allows `http://localhost:5173` (Vite). OpenAPI UI: [http://localhost:8000/docs](http://localhost:8000/docs).

Registered demo flight: `KMOB-KPNS-20260721-001` → `mobile_to_pensacola_synthetic_telemetry.jsonl`.

## Quality checks

From `backend/`:

```bash
make fmt     # auto-format + apply safe ruff fixes
make check   # format check, lint, mypy, pytest (CI-style)
make test    # pytest with coverage
make api     # run FastAPI with reload
```

## Layout

- `src/flight_replay/` — models, readers, normalize, stats, CLI
- `src/flight_replay/api/` — FastAPI app, routes, schemas, file-backed store
- `tests/` — pytest suite (including API `TestClient` tests)
