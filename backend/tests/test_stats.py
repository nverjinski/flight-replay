from __future__ import annotations

from pathlib import Path

from flight_replay.stats import compute_stats

FIXTURES = Path(__file__).parent / "fixtures"


def test_compute_stats_on_fixture() -> None:
    s = compute_stats(FIXTURES / "valid_two.jsonl")
    assert s.point_count == 2
    assert s.flight_id  # non-empty
