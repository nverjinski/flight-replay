from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from flight_replay.readers import iter_normalized


@dataclass(frozen=True, slots=True)
class FlightStats:
    flight_id: str
    point_count: int
    duration_ms: int
    phases: tuple[str, ...]
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    alt_min_ft: float
    alt_max_ft: float
    ias_min_kt: float
    ias_max_kt: float


def compute_stats(path: Path | str) -> FlightStats:
    path = Path(path)

    flight_id: str | None = None
    count = 0
    max_elapsed_ms = 0
    phases: set[str] = set()

    lat_min = lat_max = 0.0
    lon_min = lon_max = 0.0
    alt_min = alt_max = 0.0
    ias_min = ias_max = 0.0

    for rec in iter_normalized(path):
        if count == 0:
            flight_id = rec.flight_id
            lat_min = lat_max = rec.latitude
            lon_min = lon_max = rec.longitude
            alt_min = alt_max = rec.altitude_ft
            ias_min = ias_max = rec.indicated_airspeed_kt
        else:
            lat_min = min(lat_min, rec.latitude)
            lat_max = max(lat_max, rec.latitude)
            lon_min = min(lon_min, rec.longitude)
            lon_max = max(lon_max, rec.longitude)
            alt_min = min(alt_min, rec.altitude_ft)
            alt_max = max(alt_max, rec.altitude_ft)
            ias_min = min(ias_min, rec.indicated_airspeed_kt)
            ias_max = max(ias_max, rec.indicated_airspeed_kt)

        phases.add(rec.phase)
        max_elapsed_ms = max(max_elapsed_ms, rec.elapsed_ms)
        count += 1

    if flight_id is None or count == 0:
        raise ValueError(f"no telemetry records in {path}")

    return FlightStats(
        flight_id=flight_id,
        point_count=count,
        duration_ms=max_elapsed_ms,
        phases=tuple(sorted(phases)),
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        alt_min_ft=alt_min,
        alt_max_ft=alt_max,
        ias_min_kt=ias_min,
        ias_max_kt=ias_max,
    )
