/**
 * ReportCardArtifactCard — renders a Steward AI `report_card` artifact.
 * Shows KPI metric tiles, an optional inline bar sparkline, and a deep-link
 * button that navigates to the matching CRM reports page.
 */
"use client";

import Link from "next/link";
import type { StewardReportCardArtifact } from "@/app/components/ai/steward-artifact-types";

interface Props {
  artifact: StewardReportCardArtifact;
}

// ─── Inline SVG Sparkline ──────────────────────────────────────────────────────
function SparkBar({ labels, values }: { labels: string[]; values: number[] }) {
  if (!values || values.length === 0) return null;

  const W = 320;
  const H = 72;
  const PAD = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const max = Math.max(...values, 1);
  const barCount = values.length;
  const gap = 3;
  const barW = Math.max(4, (chartW - gap * (barCount - 1)) / barCount);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded"
      aria-label="Giving by month bar chart"
      role="img"
    >
      {values.map((v, i) => {
        const barH = Math.max(2, (v / max) * chartH);
        const x = PAD.left + i * (barW + gap);
        const y = PAD.top + chartH - barH;
        const isLast = i === barCount - 1;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={isLast ? "#16a34a" : "#bbf7d0"}
            />
            {barCount <= 12 && labels[i] && (
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                fontSize={7}
                fill="#94a3b8"
              >
                {/* Show only short label (e.g. "Jan") */}
                {String(labels[i]).slice(0, 3)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Trend icon ───────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") {
    return (
      <svg className="h-3 w-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7 7 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg className="h-3 w-3 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
      </svg>
    );
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ReportCardArtifactCard({ artifact }: Props) {
  const { title, fiscalYearLabel, metrics, deepLink, deepLinkLabel, chartData } = artifact;

  return (
    <article className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          {/* Bar chart icon */}
          <svg className="h-4 w-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16V8m4 8v-5m4 5v-3" />
          </svg>
          <h4 className="text-sm font-semibold text-emerald-900">{title || "CRM Report"}</h4>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] text-emerald-700 font-medium">
          {fiscalYearLabel ?? "Report"}
        </span>
      </header>

      {/* KPI metric tiles */}
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-emerald-50/50 border-b border-emerald-100">
          {metrics.map((m, i) => (
            <div key={i} className="bg-white px-3 py-2.5">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide truncate">{m.label}</p>
              <p className="mt-0.5 text-base font-bold text-slate-800 tabular-nums leading-tight">{m.value}</p>
              {(m.delta || m.trend) && (
                <div className="mt-0.5 flex items-center gap-1">
                  <TrendIcon trend={m.trend} />
                  {m.delta && (
                    <span className={`text-[10px] font-medium ${m.trend === "up" ? "text-emerald-600" : m.trend === "down" ? "text-rose-500" : "text-slate-400"}`}>
                      {m.delta}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Optional sparkline chart */}
      {chartData && chartData.labels.length > 0 && (
        <div className="px-3 py-2 border-b border-emerald-50">
          <p className="text-[10px] font-medium text-slate-400 mb-1">Monthly giving</p>
          <SparkBar labels={chartData.labels} values={chartData.values} />
        </div>
      )}

      {/* Deep link footer */}
      {deepLink && (
        <div className="px-3 py-2 flex items-center justify-end">
          <Link
            href={deepLink}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            {deepLinkLabel ?? "View Full Report"}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      )}
    </article>
  );
}
