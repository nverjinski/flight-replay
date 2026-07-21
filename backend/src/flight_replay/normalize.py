from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

from flight_replay.models import TelemetryRecordV1


@dataclass(frozen=True, slots=True)
class NormalizedTelemetryRecord:
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

    # useful extras for later UI / debrief:
    aircraft_type: str
    tail_number: str
    throttle_pct: float
    flaps_deg: float
    gear_down: bool
    synthetic: bool


def normalize_record(raw: TelemetryRecordV1, sequence: int) -> NormalizedTelemetryRecord:
    if sequence < 0:
        raise ValueError(f"sequence must be >= 0, got {sequence}")

    return NormalizedTelemetryRecord(
        schema_version=raw.schema_version,
        flight_id=raw.flight_id,
        sequence=sequence,
        timestamp=raw.timestamp,
        elapsed_ms=int(round(raw.elapsed_seconds * 1000)),
        latitude=raw.position.latitude_deg,
        longitude=raw.position.longitude_deg,
        altitude_ft=raw.position.altitude_msl_ft,
        heading_true_deg=raw.attitude.heading_true_deg,
        pitch_deg=raw.attitude.pitch_deg,
        bank_deg=raw.attitude.bank_deg,
        indicated_airspeed_kt=raw.performance.indicated_airspeed_kt,
        vertical_speed_fpm=raw.performance.vertical_speed_fpm,
        phase=raw.phase.value,  # StrEnum → plain str
        on_ground=raw.configuration.on_ground,
        aircraft_type=raw.aircraft.type,
        tail_number=raw.aircraft.tail_number,
        throttle_pct=float(raw.configuration.throttle_pct),
        flaps_deg=float(raw.configuration.flaps_deg),
        gear_down=raw.configuration.gear_down,
        synthetic=raw.synthetic,
    )


def normalized_to_dict(record: NormalizedTelemetryRecord) -> dict[str, Any]:
    """For writing JSONL later. datetime needs ISO formatting at write time."""
    return asdict(record)
