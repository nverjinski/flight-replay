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

From `backend/`:

```bash
make fmt     # auto-format + apply safe ruff fixes
make check   # format check, lint, mypy, pytest (CI-style)
make test    # pytest with coverage
```

`make check` treats “no tests collected” as OK until the test suite exists.

Equivalent manual commands:

```bash
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest
```

## Layout

- `src/flight_replay/` — package source
- `tests/` — pytest suite
