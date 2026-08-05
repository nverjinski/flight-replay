from flight_replay.normalize import NormalizedTelemetryRecord

def record_to_ingest_point(record: NormalizedTelemetryRecord) -> dict:
    """Shape matching TelemetryIngestPoint (API JSON)."""

    return {
        "schema_version": record.schema_version,
        "sequence": record.sequence,
        "timestamp": record.timestamp.isoformat(),
        "elapsed_ms": record.elapsed_ms,
        "latitude": record.latitude,
        "longitude": record.longitude,
        "altitude_ft": record.altitude_ft,
        "heading_true_deg": record.heading_true_deg,
        "pitch_deg": record.pitch_deg,
        "bank_deg": record.bank_deg,
        "indicated_airspeed_kt": record.indicated_airspeed_kt,
        "vertical_speed_fpm": record.vertical_speed_fpm,
        "phase": record.phase,
        "on_ground": record.on_ground,
        "throttle_pct": record.throttle_pct,
        "flaps_deg": record.flaps_deg,
        "gear_down": record.gear_down,
        "aircraft_type": record.aircraft_type,
        "tail_number": record.tail_number,
        "synthetic": record.synthetic,
    }