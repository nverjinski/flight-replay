from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from flight_replay.api.schemas import TelemetryIngestPoint, TelemetryIngestResult, FlightEvent, FlightSummary, to_flight_summary
from flight_replay.db.mappers import orm_point_to_normalized
from flight_replay.db.models import Flight
from flight_replay.db.models import TelemetryPoint as TelemetryPointRow
from flight_replay.normalize import NormalizedTelemetryRecord
from flight_replay.db.import_flight import ingest_point_values
from flight_replay.stats import FlightStats


class PostgresFlightStore:
    """FlightStore backed by Postgres. One Session per request (injected)."""

    def __init__(self, session: Session) -> None:
        # Keep the session on the instance so methods can use self._session
        self._session = session

    def list_flight_ids(self) -> list[str]:
        stmt = select(Flight.id).order_by(Flight.id)
        return list(self._session.scalars(stmt).all())

    def get_telemetry(
        self,
        flight_id: str,
        *,
        start_ms: int | None = None,
        end_ms: int | None = None,
        limit: int | None = None,
        offset: int = 0,
        after_sequence: int | None = None,
    ) -> list[NormalizedTelemetryRecord] | None:
        """Get telemetry points for a flight."""
        flight = self._session.get(Flight, flight_id)
        if flight is None:
            return None

        stmt = (
            select(TelemetryPointRow)
            .where(TelemetryPointRow.flight_id == flight_id)
            .order_by(TelemetryPointRow.elapsed_ms, TelemetryPointRow.sequence)
        )

        if start_ms is not None:
            stmt = stmt.where(TelemetryPointRow.elapsed_ms >= start_ms)
        if end_ms is not None:
            stmt = stmt.where(TelemetryPointRow.elapsed_ms <= end_ms)
        if after_sequence is not None:
            stmt = stmt.where(TelemetryPointRow.sequence > after_sequence)
        if offset:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        rows = self._session.scalars(stmt).all()
        return [orm_point_to_normalized(row, flight) for row in rows]

    def get_summary(self, flight_id: str) -> FlightSummary | None:
        """Get summary for a single flight."""
        flight = self._session.get(Flight, flight_id)

        if flight is None:
            return None

        count = self._session.scalar(
            select(func.count())
            .select_from(TelemetryPointRow)
            .where(TelemetryPointRow.flight_id == flight_id)
        )
        point_count = int(count or 0)

        max_elapsed_ms = self._session.scalar(
            select(func.max(TelemetryPointRow.elapsed_ms)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        duration_ms = int(max_elapsed_ms or 0)

        phase_rows = self._session.scalars(
            select(TelemetryPointRow.phase)
            .where(TelemetryPointRow.flight_id == flight_id)
            .distinct()
        ).all()
        phases = tuple(phase_rows)

        lat_min = self._session.scalar(
            select(func.min(TelemetryPointRow.latitude)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        lat_min = float(lat_min or 0.0)

        lat_max = self._session.scalar(
            select(func.max(TelemetryPointRow.latitude)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        lat_max = float(lat_max or 0.0)

        lon_min = self._session.scalar(
            select(func.min(TelemetryPointRow.longitude)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        lon_min = float(lon_min or 0.0)

        lon_max = self._session.scalar(
            select(func.max(TelemetryPointRow.longitude)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        lon_max = float(lon_max or 0.0)

        alt_min = self._session.scalar(
            select(func.min(TelemetryPointRow.altitude_ft)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        alt_min = float(alt_min or 0.0)

        alt_max = self._session.scalar(
            select(func.max(TelemetryPointRow.altitude_ft)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        alt_max = float(alt_max or 0.0)

        ias_min = self._session.scalar(
            select(func.min(TelemetryPointRow.indicated_airspeed_kt)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        ias_min = float(ias_min or 0.0)

        ias_max = self._session.scalar(
            select(func.max(TelemetryPointRow.indicated_airspeed_kt)).where(
                TelemetryPointRow.flight_id == flight_id
            )
        )
        ias_max = float(ias_max or 0.0)

        flight_stats = FlightStats(
            flight_id=flight_id,
            point_count=point_count,
            duration_ms=duration_ms,
            phases=phases,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            alt_min_ft=alt_min,
            alt_max_ft=alt_max,
            ias_min_kt=ias_min,
            ias_max_kt=ias_max,
        )
        return to_flight_summary(
            registry_id=flight_id,
            stats=flight_stats,
            aircraft_type=flight.aircraft_type,
            tail_number=flight.tail_number,
            synthetic=flight.synthetic,
            origin_label=flight.origin_label,
            destination_label=flight.destination_label,
        )

    def list_summaries(self) -> list[FlightSummary]:
        """List all flight summaries."""
        summaries: list[FlightSummary] = []
        for flight_id in self.list_flight_ids():
            summary = self.get_summary(flight_id)
            if summary is not None:
                summaries.append(summary)

        return summaries

    def get_events(self, flight_id: str) -> list[FlightEvent] | None:
        if self._session.get(Flight, flight_id) is None:
            return None
        return []

    def upsert_flight(
        self,
        flight_id: str,
        *,
        aircraft_type: str,
        tail_number: str,
        synthetic: bool,
        origin_label: str | None,
        destination_label: str | None,
    ) -> None:
        """Upsert a flight."""
        flight = self._session.get(Flight, flight_id)
        if flight is None:
            self._session.add(
                Flight(
                    id=flight_id,
                    aircraft_type=aircraft_type,
                    tail_number=tail_number,
                    synthetic=synthetic,
                    origin_label=origin_label,
                    destination_label=destination_label,
                )
            )
            self._session.flush()
        else:
            flight.aircraft_type = aircraft_type
            flight.tail_number = tail_number
            flight.synthetic = synthetic
            if origin_label is not None:
                flight.origin_label = origin_label
            if destination_label is not None:
                flight.destination_label = destination_label
            self._session.flush()


    def append_telemetry(
        self,
        flight_id: str,
        points: list[TelemetryIngestPoint],
    ) -> TelemetryIngestResult:
        """Append telemetry points to a flight."""

        if not points:
            return TelemetryIngestResult(flight_id=flight_id, inserted=0, skipped=0)

        first = points[0]
        flight = self.upsert_flight(flight_id, aircraft_type=first.aircraft_type, tail_number=first.tail_number, synthetic=first.synthetic, origin_label=first.origin_label, destination_label=first.destination_label)

        rows = [ingest_point_values(flight_id, p) for p in points]

        stmt = (pg_insert(TelemetryPointRow)
        .values(rows)
        .on_conflict_do_nothing(constraint="uq_telemetry_flight_sequence")
        .returning(TelemetryPointRow.id))

        result = self._session.execute(stmt)
        inserted_ids = result.scalars().all()
        inserted = len(inserted_ids)
        skipped = len(rows) - inserted

        self._session.commit()

        return TelemetryIngestResult(flight_id=flight_id, inserted=inserted, skipped=skipped)

