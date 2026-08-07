import type {
  FlightSummary,
  TelemetryPoint,
  TelemetryQuery,
} from "../types/telemetry";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set");
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(
      `API ${path} failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

export function fetchFlights(): Promise<FlightSummary[]> {
  return getJson<FlightSummary[]>("/flights");
}

export function fetchFlight(flightId: string): Promise<FlightSummary> {
  return getJson<FlightSummary>(`/flights/${encodeURIComponent(flightId)}`);
}

export function fetchTelemetry(
  flightId: string,
  query: TelemetryQuery = {},
): Promise<TelemetryPoint[]> {
  const params = new URLSearchParams();
  if (query.start_ms != null) params.set("start_ms", String(query.start_ms));
  if (query.end_ms != null) params.set("end_ms", String(query.end_ms));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.after_sequence != null)
    params.set("after_sequence", String(query.after_sequence));

  const qs = params.toString();
  const path = `/flights/${encodeURIComponent(flightId)}/telemetry${qs ? `?${qs}` : ""}`;

  return getJson<TelemetryPoint[]>(path);
}
