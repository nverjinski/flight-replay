from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from flight_replay.cli import app

runner = CliRunner()
FIXTURES = Path(__file__).parent / "fixtures"
RAW = Path(__file__).resolve().parents[2] / "data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl"


def test_cli_validate_ok() -> None:
    result = runner.invoke(app, ["validate", str(FIXTURES / "valid_two.jsonl")])
    assert result.exit_code == 0
    assert "ok=" in result.stdout


def test_cli_validate_bad_exits_nonzero() -> None:
    print(FIXTURES)
    result = runner.invoke(app, ["validate", str(FIXTURES / "malformed.jsonl")])
    assert result.exit_code == 1


def test_cli_stats() -> None:
    result = runner.invoke(app, ["stats", str(FIXTURES / "valid_two.jsonl")])
    assert result.exit_code == 0
    assert "flight_id:" in result.stdout


def test_cli_normalize(tmp_path: Path) -> None:
    out = tmp_path / "out.jsonl"
    result = runner.invoke(
        app,
        ["normalize", str(FIXTURES / "valid_two.jsonl"), "-o", str(out)],
    )
    assert result.exit_code == 0
    assert out.is_file()
    lines = out.read_text().strip().splitlines()
    assert len(lines) == 2
