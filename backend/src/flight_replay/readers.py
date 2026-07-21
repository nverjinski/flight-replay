from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from flight_replay.models import (
    TelemetryRecordV1,
    UnsupportedSchemaVersionError,
    parse_telemetry_dict,
)
from flight_replay.normalize import NormalizedTelemetryRecord, normalize_record


@dataclass(frozen=True, slots=True)
class LineError:
    line_number: int
    message: str

    def __str__(self) -> str:
        # Indent continuation lines so multi-line Pydantic messages stay readable.
        indented = self.message.replace("\n", "\n  ")
        return f"line {self.line_number}: {indented}"


@dataclass(frozen=True, slots=True)
class ValidationReport:
    ok_count: int
    error_count: int
    blank_count: int
    errors: tuple[LineError, ...]  # first N samples is fine

    def __str__(self) -> str:
        header = f"ok={self.ok_count} errors={self.error_count} blanks={self.blank_count}"
        if not self.errors:
            return header

        lines = [header, "sample errors:"]
        lines.extend(f"  {error}" for error in self.errors)
        if self.error_count > len(self.errors):
            omitted = self.error_count - len(self.errors)
            lines.append(f"  ... and {omitted} more")
        return "\n".join(lines)


def iter_raw_records(path: Path | str) -> Iterator[TelemetryRecordV1]:
    """Yield valid records. Raises on first bad line (strict iterator)."""
    path = Path(path)

    with path.open(encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                yield parse_telemetry_dict(data)
            except json.JSONDecodeError as e:
                raise ValueError(f"line {line_number}: {e}") from e
            except (ValidationError, UnsupportedSchemaVersionError) as e:
                raise ValueError(f"line {line_number}: {e}") from e


def validate_file(path: Path | str, *, max_errors: int = 20) -> ValidationReport:
    """Scan whole file; collect errors with line numbers; do not raise on bad lines."""
    path = Path(path)

    ok_count = 0
    error_count = 0
    blank_count = 0
    errors: list[LineError] = []

    with path.open(encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                blank_count += 1
                continue
            try:
                data = json.loads(line)
                parse_telemetry_dict(data)
            except json.JSONDecodeError as e:
                error_count += 1
                if len(errors) < max_errors:
                    errors.append(LineError(line_number, f"JSON decode error: {e}"))
            except (ValidationError, UnsupportedSchemaVersionError) as e:
                error_count += 1
                if len(errors) < max_errors:
                    errors.append(LineError(line_number, f"Validation error: {e}"))
            else:
                ok_count += 1

    return ValidationReport(ok_count, error_count, blank_count, tuple(errors))


def iter_normalized(path: Path | str) -> Iterator[NormalizedTelemetryRecord]:
    """Stream raw → normalize with sequence 0, 1, 2, ..."""
    for sequence, raw in enumerate(iter_raw_records(path)):
        yield normalize_record(raw, sequence)
