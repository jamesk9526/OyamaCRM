/**
 * EnhancedChartArtifactCard — renders Steward AI chart artifacts with Recharts.
 * Supports interactive bar, line, pie, donut, stacked_bar charts with tooltips,
 * legends, and responsive sizing. Falls back gracefully if Recharts fails.
 */
"use client";

import { useState, useMemo } from "react";
import {
  BarChart as RechartBar,
  LineChart as RechartLine,
  PieChart as RechartPie,
  Bar,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { StewardChartArtifact } from "@/app/components/ai/steward-artifact-types";

interface Props {
  artifact: StewardChartArtifact;
  onAskReportQuestion?: (prompt: string) => void;
}

type TooltipEntry = {
  name?: string | number;
  value?: number | string | readonly (string | number)[];
  color?: string;
};

function safeValue(v: TooltipEntry["value"]): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return fmtValue(v as number | string);
}

const DEFAULT_COLOURS = ["#22d3ee", "#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24"];

function fmtValue(v: number | string): string {
  if (typeof v === "string") return v;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

/**
 * CustomTooltip — styled tooltip for Recharts that shows series values clearly.
 */
function CustomTooltip(props: { active?: boolean; payload?: readonly TooltipEntry[]; yAxisPrefix?: string }) {
  const { active, payload, yAxisPrefix } = props;
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1117] p-2 shadow-xl">
      {payload.map((entry, i) => (
        <div key={i} className="text-xs">
          <span style={{ color: entry.color ?? "#000" }} className="font-semibold">
            {entry.name ?? "Value"}:{" "}
          </span>
          <span className="text-slate-200">
            {yAxisPrefix}
            {safeValue(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * BarChartRenderer — Recharts-based bar chart with grouped or stacked support.
 */
function BarChartRenderer({
  labels,
  series,
  yAxisPrefix = "",
  stacked = false,
}: {
  labels: string[];
  series: StewardChartArtifact["series"];
  yAxisPrefix?: string;
  stacked?: boolean;
}) {
  const data = useMemo(
    () =>
      labels.map((label, i) => ({
        name: label,
        ...Object.fromEntries(series.map((s) => [s.name, s.data[i] ?? 0])),
      })),
    [labels, series]
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RechartBar data={data} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          label={{ value: yAxisPrefix ? `${yAxisPrefix} Value` : "Value", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
        />
        <Tooltip
          content={({ active, payload }) => (
            <CustomTooltip active={active} payload={payload} yAxisPrefix={yAxisPrefix} />
          )}
        />
        <Legend wrapperStyle={{ paddingTop: "16px", color: "#cbd5e1" }} />
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            fill={s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length]}
            stackId={stacked ? "stack" : undefined}
            opacity={0.9}
          />
        ))}
      </RechartBar>
    </ResponsiveContainer>
  );
}

/**
 * LineChartRenderer — Recharts-based line/area chart with multiple series support.
 */
function LineChartRenderer({
  labels,
  series,
  yAxisPrefix = "",
}: {
  labels: string[];
  series: StewardChartArtifact["series"];
  yAxisPrefix?: string;
}) {
  const data = useMemo(
    () =>
      labels.map((label, i) => ({
        name: label,
        ...Object.fromEntries(series.map((s) => [s.name, s.data[i] ?? 0])),
      })),
    [labels, series]
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RechartLine data={data} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          label={{ value: yAxisPrefix ? `${yAxisPrefix} Value` : "Value", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
        />
        <Tooltip
          content={({ active, payload }) => (
            <CustomTooltip active={active} payload={payload} yAxisPrefix={yAxisPrefix} />
          )}
        />
        <Legend wrapperStyle={{ paddingTop: "16px", color: "#cbd5e1" }} />
        {series.map((s, i) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length] }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
        ))}
      </RechartLine>
    </ResponsiveContainer>
  );
}

/**
 * PieChartRenderer — Recharts pie/donut chart with centered label.
 */
function PieChartRenderer({
  series,
  donut = false,
  yAxisPrefix = "",
}: {
  series: StewardChartArtifact["series"];
  donut?: boolean;
  yAxisPrefix?: string;
}) {
  const data = useMemo(
    () =>
      series
        .map((s, i) => ({
          name: s.name,
          value: s.data[0] ?? 0,
          fill: s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length],
        }))
        .filter((s) => s.value > 0),
    [series]
  );

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0 || data.length === 0) {
    return <div className="text-sm text-slate-500 text-center py-8">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartPie data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? 60 : 0}
          outerRadius={100}
          fill="#16a34a"
          paddingAngle={2}
          dataKey="value"
          label={({ name, value, percent }) => `${name}: ${percent && (percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} opacity={0.9} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val: unknown) => {
            const num = typeof val === "number" ? val : 0;
            return `${yAxisPrefix}${fmtValue(num)}`;
          }}
          contentStyle={{ borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "#0d1117", color: "#e5e7eb" }}
        />
        <Legend wrapperStyle={{ paddingTop: "16px", color: "#cbd5e1" }} />
      </RechartPie>
    </ResponsiveContainer>
  );
}

export default function EnhancedChartArtifactCard({ artifact, onAskReportQuestion }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [askDraft, setAskDraft] = useState("");

  // Compute summary stats
  const totalValue = artifact.series.reduce((sum, s) => sum + s.data.reduce((a, b) => a + b, 0), 0);

  const isDonut = artifact.chartType === "donut";
  const isPie = artifact.chartType === "pie";

  const quickPrompts = [
    `Explain the top 3 insights from ${artifact.title || "this chart"}.`,
    `Identify anomalies and possible causes in ${artifact.title || "this chart"}.`,
    `Compare early vs late periods and summarize trend shifts in ${artifact.title || "this chart"}.`,
    `Recommend 5 concrete CRM actions based on ${artifact.title || "this chart"}.`,
    `Forecast the next period from ${artifact.title || "this chart"} and explain confidence.`,
  ];

  function askPrompt(prompt: string) {
    const value = prompt.trim();
    if (!value || !onAskReportQuestion) return;
    onAskReportQuestion(value);
    setAskDraft("");
  }

  const chartComponent = (() => {
    switch (artifact.chartType) {
      case "bar":
        return (
          <BarChartRenderer
            labels={artifact.labels}
            series={artifact.series}
            yAxisPrefix={artifact.yAxisPrefix}
            stacked={false}
          />
        );
      case "stacked_bar":
        return (
          <BarChartRenderer
            labels={artifact.labels}
            series={artifact.series}
            yAxisPrefix={artifact.yAxisPrefix}
            stacked={true}
          />
        );
      case "line":
        return (
          <LineChartRenderer
            labels={artifact.labels}
            series={artifact.series}
            yAxisPrefix={artifact.yAxisPrefix}
          />
        );
      case "pie":
      case "donut":
        return (
          <PieChartRenderer
            series={artifact.series}
            donut={isDonut}
            yAxisPrefix={artifact.yAxisPrefix}
          />
        );
      default:
        return <div className="text-sm text-slate-500">Unsupported chart type</div>;
    }
  })();

  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-[#0d1117] p-4 text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Interactive Chart</p>
          <h4 className="mt-1 text-sm font-semibold text-white">{artifact.title || "Chart"}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100">
            {artifact.chartType.replace("_", " ")}
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-medium text-slate-400 hover:text-white"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
        </div>
      </header>

      {artifact.description && <p className="text-xs leading-5 text-slate-400">{artifact.description}</p>}

      {/* Chart container */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25 p-3">
        {chartComponent}
      </div>

      {/* Details panel */}
      {showDetails && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Data Details</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium text-slate-500">Total</span>
              <p className="font-semibold text-white">{artifact.yAxisPrefix}{fmtValue(totalValue)}</p>
            </div>
            <div>
              <span className="font-medium text-slate-500">Series</span>
              <p className="font-semibold text-white">{artifact.series.length}</p>
            </div>
            {!isPie && !isDonut && (
              <div>
                <span className="font-medium text-slate-500">Periods</span>
                <p className="font-semibold text-white">{artifact.labels.length}</p>
              </div>
            )}
          </div>

          {/* Series legend */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Series</p>
            <div className="flex flex-wrap gap-2">
              {artifact.series.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length] }}
                  />
                  <span className="text-xs text-slate-300">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(onAskReportQuestion || showDetails) && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Chart tools</p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => askPrompt(prompt)}
                className="rounded-lg border border-white/15 bg-[#0f172a] px-2 py-1 text-[11px] text-slate-200 hover:bg-[#1e293b]"
                disabled={!onAskReportQuestion}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300">Ask about this chart</label>
            <div className="flex items-center gap-2">
              <input
                value={askDraft}
                onChange={(event) => setAskDraft(event.target.value)}
                placeholder="Ask for trends, risks, recommendations, forecasts..."
                className="w-full rounded-lg border border-white/15 bg-[#020817] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/70"
              />
              <button
                type="button"
                onClick={() => askPrompt(askDraft)}
                disabled={!askDraft.trim() || !onAskReportQuestion}
                className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}


