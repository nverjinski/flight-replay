import type { TelemetryPoint } from "../types/telemetry";

export type PhaseMarker = {
  index: number;
  phase: string;
  elapsed_ms: number;
};

/** Wherever `phase` changes — temporary ground truth until Phase 4 detectors. */
export function getPhaseMarkers(points: TelemetryPoint[]): PhaseMarker[] {
  if (points.length === 0) {
    return [];
  }

  const markers: PhaseMarker[] = [
    {
      index: 0,
      phase: points[0].phase,
      elapsed_ms: points[0].elapsed_ms,
    },
  ];

  for (let i = 1; i < points.length; i++) {
    if (points[i].phase !== points[i - 1].phase) {
      markers.push({
        index: i,
        phase: points[i].phase,
        elapsed_ms: points[i].elapsed_ms,
      });
    }
  }

  return markers;
}