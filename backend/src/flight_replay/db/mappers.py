"""Map SQLAlchemy rows to domain objects (NormalizedTelemetryRecord)"""

from __future__ import annotations

from flight_replay.db.models import Flight
from flight_replay.db.models import TelemetryPoint as TelemetryPointRow
from flight_replay.normalize import NormalizedTelemetryRecord


def orm_point_to_normalized(point: TelemetryPointRow, flight: Flight) -> NormalizedTelemetryRecord:
    """
    TelemetryPointRow = one DB sample (no aricraft columns).
    Flight = aircraft / synthetic for this flight.
    Together they fill NormalizedTelemetryRecord (what the API already expects).
    """
    return NormalizedTelemetryRecord(
        schema_version=point.schema_version,
        flight_id=point.flight_id,
        sequence=point.sequence,
        timestamp=point.timestamp,
        elapsed_ms=point.elapsed_ms,
        latitude=point.latitude,
        longitude=point.longitude,
        altitude_ft=point.altitude_ft,
        heading_true_deg=point.heading_true_deg,
        pitch_deg=point.pitch_deg,
        bank_deg=point.bank_deg,
        indicated_airspeed_kt=point.indicated_airspeed_kt,
        vertical_speed_fpm=point.vertical_speed_fpm,
        phase=point.phase,
        on_ground=point.on_ground,
        aircraft_type=flight.aircraft_type,
        tail_number=flight.tail_number,
        throttle_pct=point.throttle_pct,
        flaps_deg=point.flaps_deg,
        gear_down=point.gear_down,
        synthetic=flight.synthetic,
    )
