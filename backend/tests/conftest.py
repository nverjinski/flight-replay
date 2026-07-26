from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Any

from flight_replay.db.session import SessionLocal, engine


def sample_record(**overrides: Any) -> dict[str, Any]:
    """A minimal valid 1.0 telemetry dict. Pass overrides to mutate fields."""
    record: dict[str, Any] = {
        "schema_version": "1.0",
        "synthetic": True,
        "flight_id": "TEST-FLIGHT-001",
        "timestamp": "2026-07-21T19:00:00Z",
        "elapsed_seconds": 0,
        "phase": "preflight",
        "aircraft": {"type": "Cessna 172S", "tail_number": "N172NV"},
        "position": {
            "latitude_deg": 30.6912,
            "longitude_deg": -88.2428,
            "altitude_msl_ft": 218.9,
        },
        "attitude": {
            "heading_true_deg": 141.4,
            "pitch_deg": 0.0,
            "bank_deg": 0.0,
        },
        "performance": {
            "indicated_airspeed_kt": 0.2,
            "vertical_speed_fpm": -3.0,
        },
        "configuration": {
            "throttle_pct": 12.0,
            "flaps_deg": 0,
            "gear_down": True,
            "on_ground": True,
        },
    }
    # shallow overrides for top-level keys; nested overrides need care
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(record.get(key), dict):
            merged = {**record[key], **value}
            record[key] = merged
        else:
            record[key] = value
    return record


@pytest.fixture
def db_session() -> Session:  # type: ignore[misc]
    """
    Real Postgres session for integration tests.
    Skips the test if the DB isn't reachable (Compose down, wrong URL, etc.).
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"Postgres not available: {exc}")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()