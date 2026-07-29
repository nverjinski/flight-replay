from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from flight_replay.api.app import create_app
from flight_replay.api.schemas import TelemetryIngestPoint
from flight_replay.db.import_flight import ingest_point_values
from flight_replay.db.models import Flight
from flight_replay.db.store import PostgresFlightStore


def _sample_ingest_point(**overrides: object) -> TelemetryIngestPoint:
    data: dict[str, object] = {
        "schema_version": "1.0",
        "sequence": 0,
        "timestamp": datetime(2026, 7, 21, 19, 0, 0, tzinfo=UTC),
        "elapsed_ms": 0,
        "latitude": 30.6912,
        "longitude": -88.2428,
        "altitude_ft": 218.9,
        "heading_true_deg": 141.4,
        "pitch_deg": 0.0,
        "bank_deg": 0.0,
        "indicated_airspeed_kt": 0.2,
        "vertical_speed_fpm": -3.0,
        "phase": "preflight",
        "on_ground": True,
        "throttle_pct": 12.0,
        "flaps_deg": 0.0,
        "gear_down": True,
        "aircraft_type": "Cessna 172S",
        "tail_number": "N172NV",
        "synthetic": True,
        "origin_label": "KMOB",
        "destination_label": "KPNS",
    }
    data.update(overrides)
    return TelemetryIngestPoint.model_validate(data)


def _sample_ingest_json(**overrides: object) -> dict[str, object]:
    """JSON-serializable body point (timestamp as ISO string)."""
    point = _sample_ingest_point(**overrides)
    return point.model_dump(mode="json")


def test_ingest_point_values_omits_flight_metadata() -> None:
    point = _sample_ingest_point()
    values = ingest_point_values("LIVE-TEST-001", point)

    assert values["flight_id"] == "LIVE-TEST-001"
    assert values["sequence"] == 0
    assert values["latitude"] == point.latitude
    assert "aircraft_type" not in values
    assert "tail_number" not in values
    assert "synthetic" not in values
    assert "origin_label" not in values
    assert "destination_label" not in values


def test_append_telemetry_idempotent(db_session: Session) -> None:
    flight_id = "TEST-APPEND-001"
    store = PostgresFlightStore(db_session)
    point = _sample_ingest_point()

    try:
        first = store.append_telemetry(flight_id, [point])
        assert first.inserted == 1
        assert first.skipped == 0

        flight = db_session.get(Flight, flight_id)
        assert flight is not None
        assert flight.aircraft_type == "Cessna 172S"
        assert flight.origin_label == "KMOB"
        assert flight.destination_label == "KPNS"

        second = store.append_telemetry(flight_id, [point])
        assert second.inserted == 0
        assert second.skipped == 1

        points = store.get_telemetry(flight_id)
        assert points is not None
        assert len(points) == 1
        assert points[0].aircraft_type == "Cessna 172S"

        # Second sequence appends
        next_point = _sample_ingest_point(sequence=1, elapsed_ms=1000)
        third = store.append_telemetry(flight_id, [next_point])
        assert third.inserted == 1
        assert third.skipped == 0
        points = store.get_telemetry(flight_id)
        assert points is not None
        assert len(points) == 2
    finally:
        flight = db_session.get(Flight, flight_id)
        if flight is not None:
            db_session.delete(flight)
            db_session.commit()


def test_post_telemetry_validation_422() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/flights/LIVE-TEST-001/telemetry",
        json={"points": [{"sequence": 0}]},
    )
    assert response.status_code == 422


def test_post_telemetry_empty_points_400() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/flights/LIVE-TEST-001/telemetry",
        json={"points": []},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_post_telemetry_roundtrip(db_session: Session) -> None:
    """Hits real Postgres via the app (same get_db path as production)."""
    # db_session fixture already skipped if Postgres is down
    flight_id = "TEST-POST-APPEND-001"
    client = TestClient(create_app())

    try:
        response = client.post(
            f"/flights/{flight_id}/telemetry",
            json={"points": [_sample_ingest_json()]},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["flight_id"] == flight_id
        assert body["inserted"] == 1
        assert body["skipped"] == 0

        again = client.post(
            f"/flights/{flight_id}/telemetry",
            json={"points": [_sample_ingest_json()]},
        )
        assert again.status_code == 201
        assert again.json()["inserted"] == 0
        assert again.json()["skipped"] == 1

        got = client.get(f"/flights/{flight_id}/telemetry")
        assert got.status_code == 200
        assert len(got.json()) == 1
    finally:
        flight = db_session.get(Flight, flight_id)
        if flight is not None:
            db_session.delete(flight)
            db_session.commit()
