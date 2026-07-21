# flight-replay (backend)

Python package for flight telemetry validation, stats, and normalization.

## Setup

```bash
cd backend
uv sync --extra dev
```

## CLI

```bash
uv run flight-replay --help
```

## Quality checks

```bash
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest
```

## Layout

- `src/flight_replay/` — package source
- `tests/` — pytest suite
