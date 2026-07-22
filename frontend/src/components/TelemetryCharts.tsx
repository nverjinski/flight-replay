import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

type SeriesProps = {
  data: ChartPoint[];
  dataKey: "altitude_ft" | "indicated_airspeed_kt";
  stroke: string;
};

/** Static series — memoized so playback ticks do not rebuild Recharts paths. */
const ChartSeries = memo(function ChartSeries({ data, dataKey, stroke }: SeriesProps) {
  return (
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
      </LineChart>
    </ResponsiveContainer>
  );
});

type BlockProps = {
  title: string;
  data: ChartPoint[];
  dataKey: "altitude_ft" | "indicated_airspeed_kt";
  stroke: string;
  cursorPct: number;
};

function ChartBlock({ title, data, dataKey, stroke, cursorPct }: BlockProps) {
  // YAxis width is 56px; keep the overlay cursor over the plot (not the axis).
  const cursorLeft = `calc(56px + (100% - 56px) * ${cursorPct / 100})`;

  return (
    <div className="chart-block">
      <h2>{title}</h2>
      <div className="chart-plot">
        <ChartSeries data={data} dataKey={dataKey} stroke={stroke} />
        <div className="chart-cursor" style={{ left: cursorLeft }} aria-hidden />
      </div>
    </div>
  );
}

/**
 * Synced altitude (ft) and indicated airspeed (kt) charts vs elapsed flight
 * time. Series are memoized; the playback cursor is a cheap CSS overlay so
 * Recharts is not rebuilt on every index tick (avoids DevTools OOM at 50×).
 */
export const TelemetryCharts = memo(function TelemetryCharts({
  data,
  currentElapsedMs,
}: Props) {
  const domain = useMemo(() => {
    if (data.length === 0) {
      return { min: 0, max: 1 };
    }
    return {
      min: data[0].elapsed_ms,
      max: data[data.length - 1].elapsed_ms,
    };
  }, [data]);

  const cursorPct =
    domain.max === domain.min
      ? 0
      : ((currentElapsedMs - domain.min) / (domain.max - domain.min)) * 100;

  return (
    <section className="charts">
      <ChartBlock
        title="Altitude (ft)"
        data={data}
        dataKey="altitude_ft"
        stroke="#5ec8ff"
        cursorPct={cursorPct}
      />
      <ChartBlock
        title="Indicated airspeed (kt)"
        data={data}
        dataKey="indicated_airspeed_kt"
        stroke="#7dffa3"
        cursorPct={cursorPct}
      />
    </section>
  );
});
