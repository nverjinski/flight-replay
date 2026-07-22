import { useQuery } from "@tanstack/react-query";
import { fetchFlights, fetchTelemetry } from "./api/flights";

export default function App() {
  const flightsQuery = useQuery({
    queryKey: ["flights"],
    queryFn: fetchFlights,
  });

  const flightId = flightsQuery.data?.[0]?.id;

  const telemetryQuery = useQuery({
    queryKey: ["telemetry", flightId],
    queryFn: () => fetchTelemetry(flightId!),
    enabled: Boolean(flightId),
  });

  if (flightsQuery.isPending) {
    return <p>Loading flights…</p>;
  }

  if (flightsQuery.isError) {
    return (
      <p>
        Failed to load flights. Is the API running on{" "}
        {import.meta.env.VITE_API_BASE_URL}?
        <br />
        {(flightsQuery.error as Error).message}
      </p>
    );
  }

  const flight = flightsQuery.data[0];

  if (!flight) {
    return <p>No flights registered.</p>;
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>Flight Replay</h1>
      <p>
        {flight.aircraft_type} · {flight.tail_number} · {flight.id}
      </p>
      <p>
        {flight.point_count} points · {(flight.duration_ms / 1000 / 60).toFixed(1)}{" "}
        min · phases: {flight.phases.join(", ")}
      </p>

      {telemetryQuery.isPending && <p>Loading telemetry…</p>}
      {telemetryQuery.isError && (
        <p>Telemetry error: {(telemetryQuery.error as Error).message}</p>
      )}
      {telemetryQuery.data && (
        <div>
          <p>
            Loaded <strong>{telemetryQuery.data.length}</strong> telemetry points.
          </p>
          <pre style={{ fontSize: 12, overflow: "auto", background: "#f4f4f4", padding: 12 }}>
            {JSON.stringify(telemetryQuery.data[0], null, 2)}
          </pre>
          <pre style={{ fontSize: 12, overflow: "auto", background: "#f4f4f4", padding: 12 }}>
            {JSON.stringify(telemetryQuery.data.at(-1), null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}