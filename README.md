# Flight Replay

Telemetry debrief platform demo (KMOB→KPNS synthetic flight).

## Status

**Phase 1 complete** — thin FastAPI telemetry API + React replay UI (map, charts, playback).  
See [ROADMAP.md](ROADMAP.md) for later phases.

## Layout

- `backend/` — Python package (CLI + FastAPI)
- `frontend/` — Vite React TypeScript replay UI
- `data/raw/` — original nested telemetry JSONL
- `data/normalized/` — flat JSONL from `flight-replay normalize`
- `docs/` — schema notes

## Quick start

### 1. Backend API

```bash
cd backend
uv sync --extra dev
make api
```

API listens on [http://localhost:8000](http://localhost:8000). Interactive docs: `/docs`.

Optional: point at a custom data directory:

```bash
export FLIGHT_REPLAY_DATA_DIR="/absolute/path/to/flight-replay/data/raw"
make api
```

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
curl "http://localhost:8000/flights/KMOB-KPNS-20260721-001/telemetry" | head -c 400
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
