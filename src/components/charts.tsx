"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES_COLORS = ["#6E8BFF", "#2FBF8F", "#D9A441", "#E5545C", "#9B7EDE"];

const axis = { stroke: "rgb(138 151 168)", fontSize: 11, fontFamily: "var(--font-mono)" };
const grid = "rgb(138 151 168 / 0.15)";
const tooltipStyle = {
  backgroundColor: "rgb(24 33 46)",
  border: "1px solid rgb(39 51 68)",
  borderRadius: 8,
  fontSize: 12,
  color: "#E7EDF3",
};

export function ScoreBars({
  data,
  bars,
  unit = "",
  height = 260,
}: {
  data: Record<string, unknown>[];
  bars: { key: string; name: string }[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit={unit} />
        <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(138 151 168 / 0.08)" }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HistoryLines({
  data,
  lines,
  unit = "",
  height = 260,
}: {
  data: Record<string, unknown>[];
  lines: { key: string; name: string }[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit={unit} width={64} />
        <RTooltip contentStyle={tooltipStyle} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {lines.map((l, i) => (
          <Line
            key={l.key}
            dataKey={l.key}
            name={l.name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryRadar({
  companies,
  height = 300,
}: {
  companies: { name: string; margins: number | null; growth: number | null; sales: number | null }[];
  height?: number;
}) {
  const data = [
    { axis: "Margins", ...Object.fromEntries(companies.map((c) => [c.name, c.margins ?? 0])) },
    { axis: "Growth", ...Object.fromEntries(companies.map((c) => [c.name, c.growth ?? 0])) },
    { axis: "Sales", ...Object.fromEntries(companies.map((c) => [c.name, c.sales ?? 0])) },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={grid} />
        <PolarAngleAxis dataKey="axis" tick={{ ...axis, fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={axis} axisLine={false} />
        <RTooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {companies.map((c, i) => (
          <Radar
            key={c.name}
            dataKey={c.name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            fillOpacity={0.14}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
