from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import typer

from flight_replay.normalize import normalized_to_dict
from flight_replay.readers import iter_normalized, validate_file
from flight_replay.stats import compute_stats

app = typer.Typer(help="Flight telemetry tools")


@app.command()
def validate(
    path: Path = typer.Argument(..., help="Path to telemetry JSONL file"),
) -> None:
    """Validate every line of a telemetry JSONL file."""
    if not path.is_file():
        typer.echo(f"File not found: {path}", err=True)
        raise typer.Exit(1)

    report = validate_file(path)
    typer.echo(str(report))  # uses ValidationReport.__str__

    if report.error_count > 0:
        raise typer.Exit(1)


@app.command()
def stats(
    path: Path = typer.Argument(..., help="Path to telemetry JSONL file"),
) -> None:
    """Print a one-pass summary of a telemetry JSONL file."""
    if not path.is_file():
        typer.echo(f"File not found: {path}", err=True)
        raise typer.Exit(1)

    try:
        summary = compute_stats(path)
    except ValueError as e:
        typer.echo(str(e), err=True)
        raise typer.Exit(1)

    typer.echo(f"flight_id:   {summary.flight_id}")
    typer.echo(f"points:      {summary.point_count}")
    typer.echo(f"duration_ms: {summary.duration_ms}")
    typer.echo(f"phases:      {', '.join(summary.phases)}")
    typer.echo(f"lat:         {summary.lat_min} .. {summary.lat_max}")
    typer.echo(f"lon:         {summary.lon_min} .. {summary.lon_max}")
    typer.echo(f"alt_ft:      {summary.alt_min_ft} .. {summary.alt_max_ft}")
    typer.echo(f"ias_kt:      {summary.ias_min_kt} .. {summary.ias_max_kt}")


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


@app.command()
def normalize(
    path: Path = typer.Argument(..., help="Path to telemetry JSONL file"),
    output: Path = typer.Option(..., "--output", "-o", help="Where to write normalized JSONL"),
) -> None:
    """Write flat, sequenced telemetry JSONL."""

    if not path.is_file():
        typer.echo(f"File not found: {path}", err=True)
        raise typer.Exit(1)

    output.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    try:
        with output.open("w", encoding="utf-8") as out:
            for record in iter_normalized(path):
                payload = normalized_to_dict(record)
                out.write(json.dumps(payload, default=_json_default) + "\n")
                count += 1

    except ValueError as e:
        # iter_raw_records wraps bad lines as ValueError
        typer.echo(str(e), err=True)
        raise typer.Exit(1)

    typer.echo(f"Wrote {count} records to {output}")


if __name__ == "__main__":
    app()
