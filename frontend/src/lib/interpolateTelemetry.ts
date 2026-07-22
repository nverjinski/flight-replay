import type { TelemetryPoint } from "../types/telemetry";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path heading blend (degrees, 0–360). */
function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

/**
 * Blend two consecutive telemetry samples for smooth map/HUD motion.
 * `t` is 0 at `from`, 1 at `to`. Phase/sequence stay on `from` until the index advances.
 */
export function interpolateTelemetry(
  from: TelemetryPoint,
  to: TelemetryPoint,
  t: number,
): TelemetryPoint {
  const u = Math.min(1, Math.max(0, t));
  if (u === 0 || from.sequence === to.sequence) {
    return from;
  }

  return {
    ...from,
    timestamp: from.timestamp,
    elapsed_ms: Math.round(lerp(from.elapsed_ms, to.elapsed_ms, u)),
    latitude: lerp(from.latitude, to.latitude, u),
    longitude: lerp(from.longitude, to.longitude, u),
    altitude_ft: lerp(from.altitude_ft, to.altitude_ft, u),
    heading_true_deg: lerpHeading(from.heading_true_deg, to.heading_true_deg, u),
    pitch_deg: lerp(from.pitch_deg, to.pitch_deg, u),
    bank_deg: lerp(from.bank_deg, to.bank_deg, u),
    indicated_airspeed_kt: lerp(from.indicated_airspeed_kt, to.indicated_airspeed_kt, u),
    vertical_speed_fpm: lerp(from.vertical_speed_fpm, to.vertical_speed_fpm, u),
    throttle_pct: lerp(from.throttle_pct, to.throttle_pct, u),
    flaps_deg: lerp(from.flaps_deg, to.flaps_deg, u),
  };
}
