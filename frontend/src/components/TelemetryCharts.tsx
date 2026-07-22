import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = {
  elapsed_ms: number;
  altitude_ft: number;
  indicated_airspeed_kt: number;
};

type Props = {
  data: ChartPoint[];
  currentElapsedMs: number;
};

function formatMin(elapsedMs: number): string {
  return `${(elapsedMs / 60000).toFixed(1)}m`;
}

type BlockProps = {
  title: string;
  data: ChartPoint[];
  dataKey: "altitude_ft" | "indicated_airspeed_kt";
  stroke: string;
  currentElapsedMs: number;
};

/**
 * Chart block with a Recharts ReferenceLine cursor so the marker shares the
 * same X scale as the series/tooltip (CSS overlays drift with axis margins).
 * `data` must be a stable reference from the parent to keep playback cheap.
 */
const ChartBlock = memo(function ChartBlock({
  title,
  data,
  dataKey,
  stroke,
  currentElapsedMs,
}: BlockProps) {
  return (
    <div className="chart-block">
      <h2>{title}</h2>
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} syncId="flight-replay">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
            <XAxis
              dataKey="elapsed_ms"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatMin}
              stroke="#8b9bb4"
            />
            <YAxis stroke="#8b9bb4" width={56} />
            <Tooltip
              labelFormatter={(v) => `t = ${formatMin(Number(v))}`}
              contentStyle={{ background: "#0f1720", border: "1px solid #2a3544" }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              dot={false}
              stroke={stroke}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            <ReferenceLine
              x={currentElapsedMs}
              stroke="#ffb020"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

/**
 * Synced altitude (ft) and indicated airspeed (kt) charts vs elapsed flight
 * time. Playback cursor is a ReferenceLine on the shared time axis.
 */
export const TelemetryCharts = memo(function TelemetryCharts({
  data,
  currentElapsedMs,
}: Props) {
  return (
    <section className="charts">
      <ChartBlock
        title="Altitude (ft)"
        data={data}
        dataKey="altitude_ft"
        stroke="#5ec8ff"
        currentElapsedMs={currentElapsedMs}
      />
      <ChartBlock
        title="Indicated airspeed (kt)"
        data={data}
        dataKey="indicated_airspeed_kt"
        stroke="#7dffa3"
        currentElapsedMs={currentElapsedMs}
      />
    </section>
  );
});
