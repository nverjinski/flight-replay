"""
SQLAlchemy ORM tables (persistence).

Not the same as:
    - flight_replay.models -> Pydantic nested JSON
    - flight_replay.api.schemas -> HTTP response models
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """All ORM models inherit from this. Alembic will use Base.metadata"""


class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    aircraft_type: Mapped[str] = mapped_column(String(64))
    tail_number: Mapped[str] = mapped_column(String(32))
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    origin_label: Mapped[str | None] = mapped_column(String(16), nullable=True)
    destination_label: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # One flight -> many points / events. back_populates wires both sides.
    points: Mapped[list[TelemetryPoint]] = relationship(
        back_populates="flight", cascade="all, delete-orphan"
    )
    events: Mapped[list[Event]] = relationship(
        back_populates="flight", cascade="all, delete-orphan"
    )


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"
    __table_args__ = (
        UniqueConstraint("flight_id", "sequence", name="uq_telemetry_flight_sequence"),
        Index("ix_telemetry_flight_elapsed", "flight_id", "elapsed_ms"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    flight_id: Mapped[str] = mapped_column(String(64), ForeignKey("flights.id", ondelete="CASCADE"))

    # Identity / time (mirrors NormalizedTelemetryRecord)
    schema_version: Mapped[str] = mapped_column(String(16))
    sequence: Mapped[int] = mapped_column(Integer)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    elapsed_ms: Mapped[int] = mapped_column(Integer)

    # Position / attitude / performance / config
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    altitude_ft: Mapped[float] = mapped_column(Float)
    heading_true_deg: Mapped[float] = mapped_column(Float)
    pitch_deg: Mapped[float] = mapped_column(Float)
    bank_deg: Mapped[float] = mapped_column(Float)
    indicated_airspeed_kt: Mapped[float] = mapped_column(Float)
    vertical_speed_fpm: Mapped[float] = mapped_column(Float)
    phase: Mapped[str] = mapped_column(String(32))
    on_ground: Mapped[bool] = mapped_column(Boolean)
    throttle_pct: Mapped[float] = mapped_column(Float)
    flaps_deg: Mapped[float] = mapped_column(Float)
    gear_down: Mapped[bool] = mapped_column(Boolean)

    flight: Mapped[Flight] = relationship(back_populates="points")


class Event(Base):
    """Empty until future detectors write rows here."""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    flight_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("flights.id", ondelete="CASCADE"),
        index=True,
    )
    type: Mapped[str] = mapped_column(String(64))
    elapsed_ms: Mapped[int] = mapped_column(Integer)
    # Free-form extras later (severity, severity, …). JSON maps to Postgres jsonb-ish JSON.
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    flight: Mapped[Flight] = relationship(back_populates="events")
