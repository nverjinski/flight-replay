from __future__ import annotations

from flight_replay.models import parse_telemetry_dict
from flight_replay.normalize import normalize_record
from tests.conftest import sample_record  # adjust import as needed


def test_normalize_preserves_identity_and_timestamp() -> None:
    raw = parse_telemetry_dict(sample_record())
    norm = normalize_record(raw, sequence=0)
    assert norm.flight_id == raw.flight_id
    assert norm.timestamp == raw.timestamp
    assert norm.latitude == raw.position.latitude_deg
    assert norm.elapsed_ms == 0


def test_normalize_assigns_sequence() -> None:
    raw = parse_telemetry_dict(sample_record())
    a = normalize_record(raw, sequence=0)
    b = normalize_record(raw, sequence=1)
    assert a.sequence == 0
    assert b.sequence == 1


def test_normalize_rejects_negative_sequence() -> None:
    import pytest
    from flight_replay.models import parse_telemetry_dict

    raw = parse_telemetry_dict(sample_record())
    with pytest.raises(ValueError):
        normalize_record(raw, sequence=-1)