from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from flight_replay.api.deps import FlightStore, flight_store_dep
from flight_replay.api.schemas import (
    FlightSummary,
    TelemetryPoint,
    to_telemetry_point,
)

router = APIRouter(tags=["flights"])


@router.get("/flights", response_model=list[FlightSummary])
def list_flights(
    store: FlightStore = Depends(flight_store_dep),
) -> list[FlightSummary]:
    return store.list_summaries()


@router.get(
    "/flights/{flight_id}/telemetry",
    response_model=list[TelemetryPoint],
)
def get_flight_telemetry(
    flight_id: str,
    store: FlightStore = Depends(flight_store_dep),
) -> list[TelemetryPoint]:
    records = store.get_telemetry(flight_id)
    if records is None:
        raise HTTPException(
            status_code=404,
            detail=f"Flight not found: {flight_id}",
        )

    return [to_telemetry_point(record) for record in records]
