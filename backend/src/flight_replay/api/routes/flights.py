from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from flight_replay.api.deps import FlightStore, flight_store_dep
from flight_replay.api.schemas import (
    FlightEvent,
    FlightSummary,
    TelemetryPoint,
    TelemetryIngestRequest,
    TelemetryIngestResult,
    to_telemetry_point,
)

router = APIRouter(tags=["flights"])


@router.get("/flights", response_model=list[FlightSummary])
def list_flights(
    store: FlightStore = Depends(flight_store_dep),
) -> list[FlightSummary]:
    return store.list_summaries()


@router.get("/flights/{flight_id}", response_model=FlightSummary)
def get_flight_summary(
    flight_id: str,
    store: FlightStore = Depends(flight_store_dep),
) -> FlightSummary:
    summary = store.get_summary(flight_id)
    if summary is None:
        raise HTTPException(
            status_code=404,
            detail=f"Flight not found: {flight_id}",
        )
    return summary


@router.get(
    "/flights/{flight_id}/telemetry",
    response_model=list[TelemetryPoint],
)
def get_flight_telemetry(
    flight_id: str,
    start_ms: int | None = None,
    end_ms: int | None = None,
    limit: int | None = None,
    offset: int = 0,
    after_sequence: int | None = None,
    store: FlightStore = Depends(flight_store_dep),
) -> list[TelemetryPoint]:
    records = store.get_telemetry(
        flight_id, 
        start_ms=start_ms, 
        end_ms=end_ms, 
        limit=limit, 
        offset=offset, 
        after_sequence=after_sequence,
    )
    if records is None:
        raise HTTPException(
            status_code=404,
            detail=f"Flight not found: {flight_id}",
        )

    return [to_telemetry_point(record) for record in records]


@router.get(
    "/flights/{flight_id}/events",
    response_model=list[FlightEvent],
)
def get_flight_events(
    flight_id: str, store: FlightStore = Depends(flight_store_dep)
) -> list[FlightEvent]:
    """Get events for a flight."""
    events = store.get_events(flight_id)
    if events is None:
        raise HTTPException(
            status_code=404,
            detail=f"Flight not found: {flight_id}",
        )
    return events

@router.post(
    "/flights/{flight_id}/telemetry",
    response_model=TelemetryIngestResult,
    status_code=201,
)
def post_flight_telemetry(
    flight_id: str, 
    body: TelemetryIngestRequest,
    store: FlightStore = Depends(flight_store_dep),
)->TelemetryIngestResult:
    """Append telemetry points to a flight."""

    if not body.points:
        raise HTTPException(
            status_code=400,
            detail="Points must not be empty",
        )
    
    return store.append_telemetry(flight_id, body.points);
