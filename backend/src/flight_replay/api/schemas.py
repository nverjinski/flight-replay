from __future__ import annotations

from dataclasses import asdict
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from flight_replay.normalize import NormalizedTelemetryRecord


class TelemetryPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")  # or ignore; forbid is stricter for API

    schema_version: str
    flight_id: str
    sequence: int
    timestamp: datetime
    elapsed_ms: int
    latitude: float
    longitude: float
    altitude_ft: float
    heading_true_deg: float
    pitch_deg: float
    bank_deg: float
    indicated_airspeed_kt: float
    vertical_speed_fpm: float
    phase: str
    on_ground: bool
    aircraft_type: str
    tail_number: str
    throttle_pct: float
    flaps_deg: float
    gear_down: bool
    synthetic: bool


class FlightSummary(BaseModel):
    id: str
    # point_count: int  # optional for Phase 1; nice for UI headers


class HealthResponse(BaseModel):
    status: str


def to_telemetry_point(record: NormalizedTelemetryRecord) -> TelemetryPoint:
    """Turn our internal dataclass into the API Pydantic model."""
    return TelemetryPoint.model_validate(asdict(record))
