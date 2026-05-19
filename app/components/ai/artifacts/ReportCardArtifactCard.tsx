/**
 * ReportCardArtifactCard — renders a Steward AI `report_card` artifact.
 * Shows KPI metric tiles, an optional inline bar sparkline, and a deep-link
 * button that navigates to the matching CRM reports page.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import type { StewardReportCardArtifact } from "@/app/components/ai/steward-artifact-types";

interface Props {
  artifact: StewardReportCardArtifact;
  onOpenReport?: (path: string, label?: string) => void;
  onAskReportQuestion?: (prompt: string) => void;
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
              fill={isLast ? "#22d3ee" : "#334155"}
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
      <svg className="h-3 w-3 text-cyan-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
export default function ReportCardArtifactCard({ artifact, onOpenReport, onAskReportQuestion }: Props) {
  const { title, fiscalYearLabel, metrics, deepLink, deepLinkLabel, chartData } = artifact;
  const [askDraft, setAskDraft] = useState("");

  const quickPrompts = [
    `Summarize the top KPI drivers in ${title || "this report"}.`,
    `Find the biggest risk in ${title || "this report"} and propose mitigation.`,
    `Recommend 5 donor stewardship actions from ${title || "this report"}.`,
    `Explain weekly, monthly, and fiscal comparisons for ${title || "this report"}.`,
    `Draft a board-ready narrative from ${title || "this report"}.`,
  ];

  function askPrompt(prompt: string) {
    const value = prompt.trim();
    if (!value || !onAskReportQuestion) return;
    onAskReportQuestion(value);
    setAskDraft("");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Bar chart icon */}
          <svg className="h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16V8m4 8v-5m4 5v-3" />
          </svg>
          <h4 className="text-sm font-semibold text-white">{title || "CRM Report"}</h4>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-medium text-cyan-100">
          {fiscalYearLabel ?? "Report"}
        </span>
      </header>

      {/* KPI metric tiles */}
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-b border-white/10 bg-white/10">
          {metrics.map((m, i) => (
            <div key={i} className="bg-[#0d1117] px-4 py-3">
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{m.label}</p>
              <p className="mt-1 text-lg font-semibold leading-tight text-white tabular-nums">{m.value}</p>
              {(m.delta || m.trend) && (
                <div className="mt-0.5 flex items-center gap-1">
                  <TrendIcon trend={m.trend} />
                  {m.delta && (
                    <span className={`text-[10px] font-medium ${m.trend === "up" ? "text-cyan-300" : m.trend === "down" ? "text-rose-400" : "text-slate-500"}`}>
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
        <div className="border-b border-white/10 px-4 py-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Monthly giving</p>
          <SparkBar labels={chartData.labels} values={chartData.values} />
        </div>
      )}

      {/* Deep link footer */}
      {deepLink && (
        <div className="flex items-center justify-end px-4 py-3">
          {onOpenReport ? (
            <button
              type="button"
              onClick={() => onOpenReport(deepLink, deepLinkLabel)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              {deepLinkLabel ?? "View Full Report"}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ) : (
            <Link
              href={deepLink}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              {deepLinkLabel ?? "View Full Report"}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          )}
        </div>
      )}

      {onAskReportQuestion && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-cyan-200">Report tools</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => askPrompt(prompt)}
                className="rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={askDraft}
              onChange={(event) => setAskDraft(event.target.value)}
              placeholder="Ask a custom question about this report..."
              className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-300/65"
            />
            <button
              type="button"
              onClick={() => askPrompt(askDraft)}
              disabled={!askDraft.trim()}
              className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
