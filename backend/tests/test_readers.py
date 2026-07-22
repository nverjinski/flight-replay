from __future__ import annotations

from pathlib import Path

import pytest

from flight_replay.readers import iter_normalized, iter_raw_records, validate_file

FIXTURES = Path(__file__).parent / "fixtures"


def test_validate_valid_file() -> None:
    report = validate_file(FIXTURES / "valid_two.jsonl")
    assert report.ok_count == 2
    assert report.error_count == 0


def test_blank_lines_counted_and_skipped() -> None:
    report = validate_file(FIXTURES / "blank_and_valid.jsonl")
    assert report.blank_count >= 1
    assert report.ok_count >= 1
    assert report.error_count == 0


def test_malformed_json_reports_line_number() -> None:
    report = validate_file(FIXTURES / "malformed.jsonl")
    assert report.error_count >= 1
    assert any(e.line_number == 2 for e in report.errors)


def test_iter_raw_records_fail_fast_includes_line() -> None:
    with pytest.raises(ValueError, match="line 2"):
        list(iter_raw_records(FIXTURES / "malformed.jsonl"))


def test_iter_normalized_sequences() -> None:
    records = list(iter_normalized(FIXTURES / "valid_two.jsonl"))
    assert [r.sequence for r in records] == [0, 1]