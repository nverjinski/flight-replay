from pathlib import Path

from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from flight_replay.db.models import Flight, TelemetryPoint
from flight_replay.normalize import NormalizedTelemetryRecord
from flight_replay.readers import iter_normalized


def import_flight_jsonl(
    path: Path,
    *,
    session: Session,
    flight_id: str | None = None,
    origin_label: str | None = None,
    destination_label: str | None = None,
    chunk_size: int = 500,
) -> int:
    """Import normalized points. Returns number of points written."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"file not found: {path}")
    stream = iter_normalized(path)
    try:
        first = next(stream)
    except StopIteration:
        raise ValueError(f"file is empty: {path}")

    resolved_id = flight_id or first.flight_id

    # Upsert flight metadata (merge = load-or-create pattern)
    flight = session.get(Flight, resolved_id)
    if flight is None:
        flight = Flight(
            id=resolved_id,
            aircraft_type=first.aircraft_type,
            tail_number=first.tail_number,
            synthetic=first.synthetic,
            origin_label=origin_label,
            destination_label=destination_label,
        )
        session.add(flight)
        session.flush()
    else:
        flight.aircraft_type = first.aircraft_type
        flight.tail_number = first.tail_number
        flight.synthetic = first.synthetic
        if origin_label is not None:
            flight.origin_label = origin_label
        if destination_label is not None:
            flight.destination_label = destination_label

    # Replace points (idempotent re-import)
    session.execute(delete(TelemetryPoint).where(TelemetryPoint.flight_id == resolved_id))

    # Bulk insert in chunks (include `first`, then the rest of the generator)
    chunk: list[dict[str, object]] = [point_values(first, flight_id=resolved_id)]
    total = 0

    def flush() -> None:
        nonlocal total, chunk
        if not chunk:
            return
        session.execute(insert(TelemetryPoint), chunk)
        total += len(chunk)
        chunk = []

    try:
        for record in stream:
            if record.flight_id != resolved_id:
                raise ValueError(f"flight_id mismatch: {record.flight_id} != {resolved_id}")
            chunk.append(point_values(record, flight_id=resolved_id))
            if len(chunk) >= chunk_size:
                flush()
        flush()
        session.commit()
    except Exception:
        session.rollback()
        raise

    return total


def point_values(record: NormalizedTelemetryRecord, *, flight_id: str) -> dict[str, object]:
    """Return a dict of point values for the given record."""
    return {
        "flight_id": flight_id,
        "schema_version": record.schema_version,
        "sequence": record.sequence,
        "timestamp": record.timestamp,
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
        "aircraft_type": record.aircraft_type,
        "tail_number": record.tail_number,
        "throttle_pct": record.throttle_pct,
        "flaps_deg": record.flaps_deg,
        "gear_down": record.gear_down,
        "synthetic": record.synthetic,
    }
