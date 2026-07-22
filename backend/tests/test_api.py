from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from flight_replay.api.app import create_app
from flight_replay.api.deps import FileFlightStore, flight_store_dep

FIXTURE = Path(__file__).parent / "fixtures" / "valid_two.jsonl"


def test_health() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_flights() -> None:
    app = create_app()
    store = FileFlightStore({"TEST-FLIGHT-001": FIXTURE})
    app.dependency_overrides[flight_store_dep] = lambda: store

    client = TestClient(app)
    response = client.get("/flights")

    assert response.status_code == 200
    assert response.json() == [{"id": "TEST-FLIGHT-001"}]


def test_telemetry_ok() -> None:
    app = create_app()
    store = FileFlightStore({"TEST-FLIGHT-001": FIXTURE})
    app.dependency_overrides[flight_store_dep] = lambda: store

    client = TestClient(app)
    response = client.get("/flights/TEST-FLIGHT-001/telemetry")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["sequence"] == 0
    assert data[1]["sequence"] == 1
    assert "latitude" in data[0]
    assert "elapsed_ms" in data[0]


def test_telemetry_404() -> None:
    app = create_app()
    store = FileFlightStore({})  # no flights registered
    app.dependency_overrides[flight_store_dep] = lambda: store

    client = TestClient(app)
    response = client.get("/flights/does-not-exist/telemetry")

    assert response.status_code == 404
