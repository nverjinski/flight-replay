import pytest

from pathlib import Path
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.conftest import sample_record
from flight_replay.models import parse_telemetry_dict
from flight_replay.normalize import normalize_record
from flight_replay.db.import_flight import import_flight_jsonl, point_values
from flight_replay.db.models import Flight, TelemetryPoint


FIXTURES = Path(__file__).parent / "fixtures"


def test_point_values() -> None:
    """Test point_values() helper function"""
    raw = parse_telemetry_dict(sample_record())
    norm = normalize_record(raw, sequence=0)
    values = point_values(norm, flight_id="TEST-FLIGHT-001")
    assert values.get("flight_id") == "TEST-FLIGHT-001"
    assert values.get("schema_version") == norm.schema_version
    assert values.get("sequence") == norm.sequence
    assert values.get("timestamp") == norm.timestamp
    assert values.get("elapsed_ms") == norm.elapsed_ms
    assert values.get("latitude") == norm.latitude
    assert values.get("longitude") == norm.longitude
    assert values.get("altitude_ft") == norm.altitude_ft
    assert values.get("heading_true_deg") == norm.heading_true_deg
    assert values.get("pitch_deg") == norm.pitch_deg
    assert values.get("bank_deg") == norm.bank_deg
    assert values.get("indicated_airspeed_kt") == norm.indicated_airspeed_kt
    assert values.get("vertical_speed_fpm") == norm.vertical_speed_fpm

    assert "aircraft_type" not in values
    assert "tail_number" not in values
    assert "synthetic" not in values


def test_import_flight_jsonl_roundtrip(db_session: Session) -> None:
    """Writes to a real DB; skipped automatically if Postgres is down."""
    path = FIXTURES / "valid_two.jsonl"
    flight_id = "TEST-IMPORT-VALID-TWO"

    try:
        count = import_flight_jsonl(
            path,
            session=db_session,
            flight_id=flight_id,
            origin_label="TEST-ORIGIN",
            destination_label="TEST-DESTINATION",
        )
        assert count == 2
        flight = db_session.get(Flight, flight_id)
        assert flight is not None
        assert flight.origin_label == "TEST-ORIGIN"
        assert flight.destination_label == "TEST-DESTINATION"
        assert flight.aircraft_type == "Cessna 172S"

        n = db_session.scalar(
            select(func.count()).select_from(TelemetryPoint).where(
                TelemetryPoint.flight_id == flight_id
            )
        )
        assert n == 2
        # Re-import must replace, not double
        count2 = import_flight_jsonl(
            path,
            session=db_session,
            flight_id=flight_id,
        )
        assert count2 == 2
        n2 = db_session.scalar(
            select(func.count()).select_from(TelemetryPoint).where(
                TelemetryPoint.flight_id == flight_id
            )
        )
        assert n2 == 2

    finally:
        # import_flight commits, so clean up explicitly
        flight = db_session.get(Flight, flight_id)
        if flight is not None:
            db_session.delete(flight)  # CASCADE removes points via FK
            db_session.commit()