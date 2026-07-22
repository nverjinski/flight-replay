from __future__ import annotations

from dataclasses import asdict
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from flight_replay.normalize import NormalizedTelemetryRecord
from flight_replay.stats import FlightStats


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
    point_count: int
    duration_ms: int
    aircraft_type: str
    tail_number: str
    origin_label: str | None = None  # e.g. "KMOB" — optional if you don't parse it yet
    destination_label: str | None = None
    phases: list[str]
    synthetic: bool


class HealthResponse(BaseModel):
    status: str


def to_telemetry_point(record: NormalizedTelemetryRecord) -> TelemetryPoint:
    """Turn our internal dataclass into the API Pydantic model."""
    return TelemetryPoint.model_validate(asdict(record))


def to_flight_summary(
    *,
    registry_id: str,
    stats: FlightStats,
    aircraft_type: str,
    tail_number: str,
    synthetic: bool,
    origin_label: str | None = None,
    destination_label: str | None = None,
) -> FlightSummary:
    return FlightSummary(
        id=registry_id,
        point_count=stats.point_count,
        duration_ms=stats.duration_ms,
        aircraft_type=aircraft_type,
        tail_number=tail_number,
        origin_label=origin_label,
        destination_label=destination_label,
        phases=list(stats.phases),
        synthetic=synthetic,
    )
