from __future__ import annotations

import pytest
from pydantic import ValidationError

from flight_replay.models import (
    UnsupportedSchemaVersionError,
    parse_telemetry_dict,
)
from tests.conftest import sample_record  # or: from conftest import sample_record


def test_valid_full_record() -> None:
    rec = parse_telemetry_dict(sample_record())
    assert rec.flight_id == "TEST-FLIGHT-001"
    assert rec.position.latitude_deg == 30.6912


def test_missing_required_nested_field() -> None:
    data = sample_record()
    del data["position"]["latitude_deg"]
    with pytest.raises(ValidationError):
        parse_telemetry_dict(data)


def test_invalid_latitude() -> None:
    with pytest.raises(ValidationError):
        parse_telemetry_dict(sample_record(position={"latitude_deg": 999}))


def test_invalid_longitude() -> None:
    with pytest.raises(ValidationError):
        parse_telemetry_dict(sample_record(position={"longitude_deg": -200}))


def test_negative_elapsed() -> None:
    with pytest.raises(ValidationError):
        parse_telemetry_dict(sample_record(elapsed_seconds=-1))


def test_unknown_schema_version() -> None:
    with pytest.raises(UnsupportedSchemaVersionError):
        parse_telemetry_dict(sample_record(schema_version="9.9"))


def test_unknown_field_is_ignored() -> None:
    # documents extra="ignore" policy
    rec = parse_telemetry_dict(sample_record(extra_future_field="hello"))
    assert rec.flight_id == "TEST-FLIGHT-001"
    assert not hasattr(rec, "extra_future_field")
