import type { FlightSummary, TelemetryPoint } from "../types/telemetry";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set");
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function fetchFlights(): Promise<FlightSummary[]> {
  return getJson<FlightSummary[]>("/flights");
}

export function fetchFlight(flightId: string): Promise<FlightSummary> {
  return getJson<FlightSummary>(`/flights/${encodeURIComponent(flightId)}`);
}

export function fetchTelemetry(flightId: string): Promise<TelemetryPoint[]> {
  return getJson<TelemetryPoint[]>(
    `/flights/${encodeURIComponent(flightId)}/telemetry`,
  );
}