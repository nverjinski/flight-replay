from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FlightPhase(StrEnum):
    PREFLIGHT = "preflight"
    TAXI_OUT = "taxi_out"
    TAKEOFF_ROLL = "takeoff_roll"
    INITIAL_CLIMB = "initial_climb"
    CLIMB = "climb"
    CRUISE = "cruise"
    DESCENT = "descent"
    APPROACH = "approach"
    LANDING = "landing"
    TAXI_IN = "taxi_in"


class Aircraft(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    tail_number: str


class Position(BaseModel):
    model_config = ConfigDict(extra="ignore")

    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=-180, le=180)
    altitude_msl_ft: float


class Attitude(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading_true_deg: float = Field(ge=0, lt=360)
    pitch_deg: float = Field(ge=-90, le=90)
    bank_deg: float = Field(ge=-180, le=180)

class Performance(BaseModel):
    model_config = ConfigDict(extra="ignore")

    indicated_airspeed_kt: float = Field(ge=0)
    vertical_speed_fpm: float

class Configuration(BaseModel):
    model_config = ConfigDict(extra="ignore")

    throttle_pct: int = Field(ge=0, le=100)
    flaps_deg: int = Field(ge=0, le=100)
    gear_down: bool
    on_ground: bool


class TelemetryRecordV1(BaseModel):
    model_config = ConfigDict(extra="ignore")

    schema_version: Literal["1.0"]
    synthetic: bool
    flight_id: str
    timestamp: datetime
    elapsed_seconds: float = Field(ge=0)
    phase: FlightPhase
    aircraft: Aircraft
    position: Position
    attitude: Attitude
    performance: Performance
    configuration: Configuration


class UnsupportedSchemaVersionError(ValueError):
    def __init__(self, version: object) -> None:
        super().__init__(f"Unsupported schema_version: {version!r}")
        self.version = version


def parse_telemetry_dict(data: dict[str, Any]) -> TelemetryRecordV1:
    version = data.get("schema_version")
    if version == "1.0":
        return TelemetryRecordV1.model_validate(data)
    raise UnsupportedSchemaVersionError(version)