# Flight Replay

Telemetry debrief platform demo (KMOB→KPNS synthetic flight).

## Status

**Phases 0–1 complete; Phase 2 in progress** — Postgres + SQLAlchemy + Alembic + import; API serves the React replay UI from the DB.  
See [ROADMAP.md](ROADMAP.md) for later phases. Backend details: [backend/README.md](backend/README.md).

## Layout

- `backend/` — Python package (CLI + FastAPI + DB)
- `frontend/` — Vite React TypeScript replay UI
- `data/raw/` — original nested telemetry JSONL
- `data/normalized/` — flat JSONL from `flight-replay normalize`
- `docs/` — schema notes
- `docker-compose.yml` — local Postgres

## Quick start

### 1. Postgres + backend API

```bash
docker compose up -d db

cd backend
uv sync --extra dev
uv run alembic upgrade head
uv run flight-replay import ../data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl \
  --origin KMOB --destination KPNS
make api
```

API listens on [http://localhost:8000](http://localhost:8000). Interactive docs: `/docs`.

Default DB URL (override with `DATABASE_URL`):  
`postgresql+psycopg://flight:flight@localhost:5432/flight_replay`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_MAPBOX_TOKEN to a Mapbox public token (pk....)
npm install
npm run dev
```

Open the Vite URL (usually [http://localhost:5173](http://localhost:5173)).

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | FastAPI origin |
| `VITE_MAPBOX_TOKEN` | `pk.…` | Mapbox GL basemap |

Never commit real tokens (`.env` is gitignored).

### 3. Smoke-check the API

```bash
curl http://localhost:8000/health
curl http://localhost:8000/flights
curl "http://localhost:8000/flights/KMOB-KPNS-20260721-001/telemetry?limit=2"
curl http://localhost:8000/flights/KMOB-KPNS-20260721-001/events
```

## Demo checklist

- Play / pause, scrub timeline, change speed (1×–50×)
- Map trail + aircraft follow heading; pan shows recenter control
- Altitude + IAS charts track the playback cursor
- Phase ticks on the timeline (from JSONL `phase` until Phase 4)

## Quality

```bash
# Backend
cd backend && make check

# Frontend
cd frontend && npm run build
```
