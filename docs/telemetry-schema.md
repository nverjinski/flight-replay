# Telemetry schema

Contract for raw flight telemetry JSONL files consumed by the `flight-replay` backend.

Raw files live under `data/raw/`. Normalized output (flat records with a monotonic `sequence`) is written under `data/normalized/` by the CLI and is described in [Normalization](#normalization).

## Format

- **Encoding:** UTF-8
- **Container:** JSON Lines (`.jsonl`) — one JSON object per line, no wrapping array
- **Current version:** `schema_version: "1.0"`
- **Sample rate (synthetic demo):** approximately 1 Hz (`elapsed_seconds` increases by ~1 each line)

Blank lines should be ignored by readers. Malformed JSON or schema violations are errors and must report a **1-based line number**.

## Example (`1.0`)

```json
{
  "schema_version": "1.0",
  "synthetic": true,
  "flight_id": "KMOB-KPNS-20260721-001",
  "timestamp": "2026-07-21T19:00:00Z",
  "elapsed_seconds": 0,
  "phase": "preflight",
  "aircraft": {
    "type": "Cessna 172S",
    "tail_number": "N172NV"
  },
  "position": {
    "latitude_deg": 30.6912,
    "longitude_deg": -88.2428,
    "altitude_msl_ft": 218.9
  },
  "attitude": {
    "heading_true_deg": 141.4,
    "pitch_deg": 0.0,
    "bank_deg": 0.0
  },
  "performance": {
    "indicated_airspeed_kt": 0.2,
    "vertical_speed_fpm": -3.0
  },
  "configuration": {
    "throttle_pct": 12.0,
    "flaps_deg": 0,
    "gear_down": true,
    "on_ground": true
  }
}
```

## Top-level fields (`1.0`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `schema_version` | string | must be `"1.0"` for this document | Selects which input model parses the line |
| `synthetic` | boolean | required | `true` if generated/simulated data |
| `flight_id` | string | required | Stable id for one flight (e.g. `KMOB-KPNS-20260721-001`) |
| `timestamp` | string (ISO-8601 datetime) | required | Sample time (UTC, e.g. `...Z`) |
| `elapsed_seconds` | number | `>= 0` | Seconds since flight start |
| `phase` | string | see [Flight phases](#flight-phases) | Labeled phase (ground truth for tests; detectors must not rely on this in production) |
| `aircraft` | object | required | See below |
| `position` | object | required | See below |
| `attitude` | object | required | See below |
| `performance` | object | required | See below |
| `configuration` | object | required | See below |

### `aircraft`

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Aircraft type name (e.g. `Cessna 172S`) |
| `tail_number` | string | Registration (e.g. `N172NV`) |

### `position`

| Field | Type | Constraints | Unit / meaning |
|-------|------|-------------|----------------|
| `latitude_deg` | number | `-90` … `90` | Degrees north |
| `longitude_deg` | number | `-180` … `180` | Degrees east |
| `altitude_msl_ft` | number | — | Feet above mean sea level |

### `attitude`

| Field | Type | Unit / meaning |
|-------|------|----------------|
| `heading_true_deg` | number | Degrees true |
| `pitch_deg` | number | Degrees (nose up positive) |
| `bank_deg` | number | Degrees (right wing down positive by convention in this dataset) |

### `performance`

| Field | Type | Unit / meaning |
|-------|------|----------------|
| `indicated_airspeed_kt` | number | Knots IAS |
| `vertical_speed_fpm` | number | Feet per minute |

### `configuration`

| Field | Type | Description |
|-------|------|-------------|
| `throttle_pct` | number | Throttle setting, percent |
| `flaps_deg` | number | Flap deflection, degrees |
| `gear_down` | boolean | Landing gear down |
| `on_ground` | boolean | Weight on wheels / on ground |

## Flight phases

Allowed `phase` values for `1.0`:

| Value | Meaning |
|-------|---------|
| `preflight` | Before taxi |
| `taxi_out` | Taxi to runway |
| `takeoff_roll` | Ground roll for takeoff |
| `initial_climb` | Early climb after liftoff |
| `climb` | Climb to cruise |
| `cruise` | Enroute cruise |
| `descent` | Descent from cruise |
| `approach` | Approach to landing |
| `landing` | Landing / touchdown segment |
| `taxi_in` | Taxi after landing |

Labeled phases in raw files are useful as **test ground truth**. Event detection (later phases of the project) should derive phases/events from telemetry fields, not by reading this label in production logic.

## Extra fields

Unknown keys at any object level are **ignored** by the `1.0` parser (forward-compatible). They are not stored unless a future schema version defines them.

Missing required fields, out-of-range coordinates, negative `elapsed_seconds`, or an unsupported `schema_version` are **validation errors**.

## Versioning

1. Each JSONL line must include `schema_version`.
2. The reader dispatches to a version-specific Pydantic input model (today: `"1.0"` → `TelemetryRecordV1`).
3. Unsupported versions fail validation with a clear error (and line number when reading a file).
4. Additive changes that older parsers can ignore may remain `"1.0"` with `extra="ignore"`.
5. Breaking or structured changes get a new version string (e.g. `"1.1"`) and a new model registered in the dispatcher.

## Normalization

Normalization is a **separate** step from input validation. It does not replace this schema; it produces a flat internal/export record for downstream UI and APIs.

Typical mapping from `1.0` → normalized:

| Normalized field | Source |
|------------------|--------|
| `schema_version` | input `schema_version` |
| `flight_id` | input `flight_id` |
| `sequence` | assigned by the stream (monotonic, `0`-based) — not present in raw JSONL |
| `timestamp` | input `timestamp` |
| `elapsed_ms` | `round(elapsed_seconds * 1000)` |
| `latitude` / `longitude` / `altitude_ft` | `position.*` |
| attitude / performance flats | `attitude.*`, `performance.*` |
| `phase`, `on_ground`, … | input fields |

`sequence` exists so later ingestion can detect duplicates, gaps, and out-of-order packets.

Normalized files are written under `data/normalized/` and must not overwrite `data/raw/`.

## Reference dataset

| Property | Value |
|----------|--------|
| File | `data/raw/mobile_to_pensacola_synthetic_telemetry.jsonl` |
| Records | 2641 |
| Route | Mobile (KMOB) → Pensacola (KPNS) |
| Aircraft | Cessna 172S / `N172NV` |
| `synthetic` | `true` |
