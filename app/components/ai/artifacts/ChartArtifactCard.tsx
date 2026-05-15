/**
 * ChartArtifactCard — renders a Steward AI `chart` artifact as a pure SVG chart.
 * Supported types: bar, line, stacked_bar, pie, donut.
 * No charting library required — all rendering is done via inline SVG.
 */
"use client";

import { useState } from "react";
import type { StewardChartArtifact } from "@/app/components/ai/steward-artifact-types";

interface Props {
  artifact: StewardChartArtifact;
}

// ─── Default series colours ────────────────────────────────────────────────────
const DEFAULT_COLOURS = ["#16a34a", "#2563eb", "#d97706", "#db2777", "#7c3aed", "#0891b2"];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtValue(v: number, prefix = ""): string {
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
  return `${prefix}${v.toLocaleString()}`;
}

// ─── Bar chart renderer ────────────────────────────────────────────────────────
function BarChart({
  labels,
  series,
  yAxisPrefix = "",
}: {
  labels: string[];
  series: StewardChartArtifact["series"];
  yAxisPrefix?: string;
}) {
  const W = 440;
  const H = 180;
  const PAD = { top: 16, right: 12, bottom: 32, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(...allValues, 1);

  const barCount = labels.length;
  const seriesCount = series.length;
  const groupW = chartW / Math.max(barCount, 1);
  const gap = 3;
  const innerGap = 2;
  const barW = Math.max(4, (groupW - gap * 2 - innerGap * (seriesCount - 1)) / seriesCount);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + chartH - f * chartH,
    label: fmtValue(f * max, yAxisPrefix),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart">
      {gridLines.map((gl, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={PAD.left + chartW} y1={gl.y} y2={gl.y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PAD.left - 4} y={gl.y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{gl.label}</text>
        </g>
      ))}

      {labels.map((label, i) => {
        const groupX = PAD.left + i * groupW + gap;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = s.data[i] ?? 0;
              const barH = Math.max(1, (v / max) * chartH);
              const x = groupX + si * (barW + innerGap);
              const y = PAD.top + chartH - barH;
              const colour = s.color ?? DEFAULT_COLOURS[si % DEFAULT_COLOURS.length];
              return (
                <rect key={si} x={x} y={y} width={barW} height={barH} rx={2} fill={colour} opacity={0.85}>
                  <title>{`${s.name}: ${fmtValue(v, yAxisPrefix)}`}</title>
                </rect>
              );
            })}
            <text
              x={groupX + (seriesCount * (barW + innerGap)) / 2 - innerGap / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize={7.5}
              fill="#94a3b8"
            >
              {String(label).slice(0, 6)}
            </text>
          </g>
        );
      })}

      <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

// ─── Stacked bar chart renderer ────────────────────────────────────────────────
function StackedBarChart({
  labels,
  series,
  yAxisPrefix = "",
}: {
  labels: string[];
  series: StewardChartArtifact["series"];
  yAxisPrefix?: string;
}) {
  const W = 440;
  const H = 180;
  const PAD = { top: 16, right: 12, bottom: 32, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Compute stacked totals per label
  const stackTotals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.data[i] ?? 0), 0));
  const max = Math.max(...stackTotals, 1);

  const barW = Math.max(6, chartW / Math.max(labels.length, 1) - 6);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + chartH - f * chartH,
    label: fmtValue(f * max, yAxisPrefix),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stacked bar chart">
      {gridLines.map((gl, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={PAD.left + chartW} y1={gl.y} y2={gl.y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PAD.left - 4} y={gl.y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{gl.label}</text>
        </g>
      ))}

      {labels.map((label, i) => {
        const cx = PAD.left + i * (chartW / Math.max(labels.length, 1)) + (chartW / Math.max(labels.length, 1) - barW) / 2;
        let yOffset = PAD.top + chartH;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = s.data[i] ?? 0;
              const barH = Math.max(v > 0 ? 1 : 0, (v / max) * chartH);
              yOffset -= barH;
              const colour = s.color ?? DEFAULT_COLOURS[si % DEFAULT_COLOURS.length];
              const y = yOffset;
              yOffset = y; // already decremented above
              return (
                <rect key={si} x={cx} y={y} width={barW} height={barH} fill={colour} opacity={0.85}>
                  <title>{`${s.name}: ${fmtValue(v, yAxisPrefix)}`}</title>
                </rect>
              );
            })}
            <text x={cx + barW / 2} y={H - 6} textAnchor="middle" fontSize={7.5} fill="#94a3b8">
              {String(label).slice(0, 6)}
            </text>
          </g>
        );
      })}

      <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

// ─── Line chart renderer ───────────────────────────────────────────────────────
function LineChart({
  labels,
  series,
  yAxisPrefix = "",
}: {
  labels: string[];
  series: StewardChartArtifact["series"];
  yAxisPrefix?: string;
}) {
  const W = 440;
  const H = 180;
  const PAD = { top: 16, right: 12, bottom: 32, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(...allValues, 1);
  const count = labels.length;

  function cx(i: number) {
    return PAD.left + (i / Math.max(count - 1, 1)) * chartW;
  }
  function cy(v: number) {
    return PAD.top + chartH - (v / max) * chartH;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + chartH - f * chartH,
    label: fmtValue(f * max, yAxisPrefix),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">
      {gridLines.map((gl, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={PAD.left + chartW} y1={gl.y} y2={gl.y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PAD.left - 4} y={gl.y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{gl.label}</text>
        </g>
      ))}

      {series.map((s, si) => {
        const colour = s.color ?? DEFAULT_COLOURS[si % DEFAULT_COLOURS.length];
        const pts = s.data.map((v, i) => `${cx(i)},${cy(v)}`).join(" ");
        const areaPath = [
          `M ${cx(0)},${PAD.top + chartH}`,
          ...s.data.map((v, i) => `L ${cx(i)},${cy(v)}`),
          `L ${cx(s.data.length - 1)},${PAD.top + chartH}`,
          "Z",
        ].join(" ");

        return (
          <g key={si}>
            <path d={areaPath} fill={colour} opacity={0.08} />
            <polyline points={pts} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={cx(i)} cy={cy(v)} r={3} fill={colour} stroke="white" strokeWidth={1}>
                <title>{`${s.name}: ${fmtValue(v, yAxisPrefix)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {labels.map((label, i) => (
        <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize={7.5} fill="#94a3b8">
          {String(label).slice(0, 6)}
        </text>
      ))}

      <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

// ─── Pie / Donut chart renderer ────────────────────────────────────────────────
function PieChart({
  series,
  donut = false,
  yAxisPrefix = "",
}: {
  series: StewardChartArtifact["series"];
  donut?: boolean;
  yAxisPrefix?: string;
}) {
  const W = 220;
  const H = 180;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(cx, cy) - 12;
  const innerR = donut ? R * 0.52 : 0;

  // Flatten: use first data point per series as slice value
  const slices = series.map((s, i) => ({
    name: s.name,
    value: s.data[0] ?? 0,
    color: s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length],
  })).filter((s) => s.value > 0);

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  // Build SVG arcs
  let startAngle = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);

    const d = donut
      ? `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const midAngle = startAngle + angle / 2;
    startAngle = endAngle;
    return { d, color: sl.color, name: sl.name, value: sl.value, pct: Math.round((sl.value / total) * 100), midAngle };
  });

  const totalFormatted = fmtValue(total, yAxisPrefix);

  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-36 shrink-0" role="img" aria-label={donut ? "Donut chart" : "Pie chart"}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.9} stroke="white" strokeWidth={1.5}>
            <title>{`${p.name}: ${fmtValue(p.value, yAxisPrefix)} (${p.pct}%)`}</title>
          </path>
        ))}
        {donut && (
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fontWeight="600" fill="#1e293b">{totalFormatted}</text>
        )}
        {donut && (
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill="#94a3b8">total</text>
        )}
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1 min-w-0">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 min-w-0">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="truncate max-w-[120px]">{p.name}</span>
            <span className="text-slate-400 shrink-0">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Icon helpers ──────────────────────────────────────────────────────────────
function ChartIcon({ type }: { type: string }) {
  if (type === "line") {
    return (
      <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <polyline points="3,17 9,11 13,15 21,7" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "pie" || type === "donut") {
    return (
      <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 0 1 10 10h-10z" />
        <circle cx={12} cy={12} r={10} />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M8 16V8m4 8v-5m4 5v-3" />
    </svg>
  );
}

function chartTitle(type: string, title?: string): string {
  if (title) return title;
  if (type === "line") return "Trend Chart";
  if (type === "pie") return "Pie Chart";
  if (type === "donut") return "Donut Chart";
  if (type === "stacked_bar") return "Stacked Bar Chart";
  return "Bar Chart";
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChartArtifactCard({ artifact }: Props) {
  const { title, chartType = "bar", labels, series, yAxisPrefix, yAxisLabel } = artifact;
  const [copied, setCopied] = useState(false);

  const isPieOrDonut = chartType === "pie" || chartType === "donut";

  // Pie/donut only need series with data; bar/line/stacked need labels too
  if (!series || series.length === 0) return null;
  if (!isPieOrDonut && (!labels || labels.length === 0)) return null;

  async function handleCopy() {
    if (isPieOrDonut) {
      const rows = series.map((s) => `${s.name}\t${s.data[0] ?? 0}`);
      try {
        await navigator.clipboard.writeText(rows.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* ignore */ }
      return;
    }
    const rows = [["Period", ...series.map((s) => s.name)].join("\t")];
    for (let i = 0; i < labels.length; i++) {
      rows.push([labels[i], ...series.map((s) => String(s.data[i] ?? ""))].join("\t"));
    }
    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ChartIcon type={chartType} />
          <h4 className="text-sm font-semibold text-slate-800">{chartTitle(chartType, title)}</h4>
        </div>
        <div className="flex items-center gap-2">
          {yAxisLabel && <span className="text-[10px] text-slate-400">{yAxisLabel}</span>}
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {copied ? "Copied" : "Copy data"}
          </button>
        </div>
      </header>

      {/* Chart body */}
      <div className={`px-2 pt-2 pb-1 ${isPieOrDonut ? "px-4 py-3" : ""}`}>
        {chartType === "line" && <LineChart labels={labels} series={series} yAxisPrefix={yAxisPrefix} />}
        {chartType === "bar" && <BarChart labels={labels} series={series} yAxisPrefix={yAxisPrefix} />}
        {chartType === "stacked_bar" && <StackedBarChart labels={labels} series={series} yAxisPrefix={yAxisPrefix} />}
        {chartType === "pie" && <PieChart series={series} donut={false} yAxisPrefix={yAxisPrefix} />}
        {chartType === "donut" && <PieChart series={series} donut={true} yAxisPrefix={yAxisPrefix} />}
      </div>

      {/* Series legend — only for multi-series non-pie charts */}
      {!isPieOrDonut && series.length > 1 && (
        <div className="flex flex-wrap gap-3 px-3 pb-2.5">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color ?? DEFAULT_COLOURS[i % DEFAULT_COLOURS.length] }}
              />
              <span className="text-[10px] text-slate-500">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
