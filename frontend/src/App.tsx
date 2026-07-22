import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFlights, fetchTelemetry } from "./api/flights";
import { PlaybackControls } from "./components/PlaybackControls";
import { TelemetryCharts } from "./components/TelemetryCharts";
import { ReplayMap } from "./components/ReplayMap";
import { usePlayback } from "./hooks/usePlayback";
import { getPhaseMarkers } from "./lib/phaseMarkers";

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

  const points = telemetryQuery.data ?? [];
  const playback = usePlayback(points);
  const markers = useMemo(() => getPhaseMarkers(points), [points]);

  // Slim, stable series for Recharts — rebuilt only when telemetry loads.
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        elapsed_ms: p.elapsed_ms,
        altitude_ft: p.altitude_ft,
        indicated_airspeed_kt: p.indicated_airspeed_kt,
      })),
    [points],
  );

  if (flightsQuery.isPending || telemetryQuery.isPending) {
    return <p className="app">Loading flight…</p>;
  }

  if (flightsQuery.isError) {
    return (
      <p className="app">
        Failed to load flights. Is the API running on{" "}
        {import.meta.env.VITE_API_BASE_URL}?
        <br />
        {(flightsQuery.error as Error).message}
      </p>
    );
  }

  if (telemetryQuery.isError) {
    return (
      <p className="app">
        Telemetry error: {(telemetryQuery.error as Error).message}
      </p>
    );
  }

  const flight = flightsQuery.data[0];
  if (!flight || points.length === 0) {
    return <p className="app">No flight data.</p>;
  }

  const current = playback.current!;
  const durationMs = points[points.length - 1].elapsed_ms;

  return (
    <main className="app">
      <header className="app-header">
        <h1>Flight Replay</h1>
        <p>
          {flight.aircraft_type} · {flight.tail_number} · {flight.id}
        </p>
      </header>
      <ReplayMap
        points={points}
        current={current}
        sampleIndex={playback.index}
        playing={playback.playing}
      />

      <div className="hud">
        <div>
          <span>Altitude</span>
          {current.altitude_ft.toFixed(0)} ft
        </div>
        <div>
          <span>IAS</span>
          {current.indicated_airspeed_kt.toFixed(0)} kt
        </div>
        <div>
          <span>Heading</span>
          {current.heading_true_deg.toFixed(0)}°
        </div>
        <div>
          <span>VS</span>
          {current.vertical_speed_fpm.toFixed(0)} fpm
        </div>
      </div>

      <PlaybackControls
        elapsedMs={current.elapsed_ms}
        durationMs={durationMs}
        phase={current.phase}
        playing={playback.playing}
        speed={playback.speed}
        markers={markers}
        onToggle={playback.toggle}
        onSpeed={playback.setSpeed}
        onScrubElapsed={playback.scrubToElapsed}
      />

      <TelemetryCharts
        data={chartData}
        currentElapsedMs={current.elapsed_ms}
      />
    </main>
  );
}
