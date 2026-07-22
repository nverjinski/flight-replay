from __future__ import annotations

import os
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from flight_replay.normalize import NormalizedTelemetryRecord
from flight_replay.readers import iter_normalized


class FlightStore(Protocol):
    """
    A Protocol is like a TypeScript interface.

    We do NOT put real logic here. The `...` means:
    "any class that implements these methods is a FlightStore."

    The real logic lives in FileFlightStore below.
    """

    def list_flight_ids(self) -> list[str]: ...

    def get_telemetry(self, flight_id: str) -> list[NormalizedTelemetryRecord] | None: ...


class FileFlightStore:
    """Looks up flights by id and reads telemetry from JSONL files on disk."""

    def __init__(self, flights: Mapping[str, Path]) -> None:
        # Copy into a normal dict so we own the mapping.
        # Example: {"KMOB-KPNS-20260721-001": Path(".../file.jsonl")}
        self._flights = dict(flights)

    def list_flight_ids(self) -> list[str]:
        return sorted(self._flights.keys())

    def get_telemetry(self, flight_id: str) -> list[NormalizedTelemetryRecord] | None:
        path = self._flights.get(flight_id)
        if path is None:
            # Unknown id — route will turn this into HTTP 404.
            return None

        # iter_normalized is a generator (lazy). list(...) reads every point now.
        return list(iter_normalized(path))


def _default_data_dir() -> Path:
    """
    deps.py lives at:
      backend/src/flight_replay/api/deps.py

    parents[0] = api/
    parents[1] = flight_replay/
    parents[2] = src/
    parents[3] = backend/
    parents[4] = repo root (flight-replay/)
    """
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / "data" / "raw"


@lru_cache
def get_flight_store() -> FileFlightStore:
    """
    Build the store once per process.

    @lru_cache means: first call creates it, later calls reuse the same object.
    """
    data_dir = Path(os.environ.get("FLIGHT_REPLAY_DATA_DIR", str(_default_data_dir())))

    return FileFlightStore(
        {
            "KMOB-KPNS-20260721-001": data_dir / "mobile_to_pensacola_synthetic_telemetry.jsonl",
        }
    )


def flight_store_dep() -> FlightStore:
    """
    FastAPI will call this when a route says:
      store: FlightStore = Depends(flight_store_dep)

    We return FlightStore (the Protocol) so routes don't care
    whether it's files today or Postgres later.
    """
    return get_flight_store()
