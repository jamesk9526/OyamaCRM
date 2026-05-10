/**
 * DonorRetention — circular gauge showing year-over-year donor retention rate.
 * Uses real data from /api/reports/donor-retention.
 */
"use client";

import Card from "@/app/components/ui/Card";
import CircularProgress from "@/app/components/ui/CircularProgress";
import { useState } from "react";

interface DonorRetentionProps {
  retained: number;
  total: number;
  /** Pre-computed rate (0–100). If undefined, computed from retained/total. */
  rate?: number;
  loading?: boolean;
}

export default function DonorRetention({ retained, total, rate, loading }: DonorRetentionProps) {
  const [displayMode, setDisplayMode] = useState<"rate" | "counts">("rate");
  const [hoverSegment, setHoverSegment] = useState<"retained" | "lapsed" | null>(null);
  const percentage = rate ?? (total > 0 ? Math.round((retained / total) * 100) : 0);
  const retainedPct = Math.max(0, Math.min(100, percentage));
  const lapsed = Math.max(total - retained, 0);
  const lapsedPct = Math.max(0, 100 - retainedPct);

  const summaryText = displayMode === "counts"
    ? `${retained} retained • ${lapsed} lapsed`
    : `${retained} out of ${total} donors retained`;

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Donor Retention</h3>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setDisplayMode("rate")}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
              displayMode === "rate"
                ? "bg-green-50 text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Rate
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("counts")}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
              displayMode === "counts"
                ? "bg-green-50 text-green-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Counts
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center py-4">
        {loading ? (
          <div className="w-44 h-44 rounded-full bg-gray-200 animate-pulse" />
        ) : (
          <div className="relative group">
            <button
              type="button"
              onClick={() => setDisplayMode((mode) => (mode === "rate" ? "counts" : "rate"))}
              className="rounded-full transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-300"
              title="Click to toggle retention views"
            >
              <CircularProgress percentage={retainedPct} size={180} strokeWidth={14} />
            </button>
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow">
                <div>{retainedPct}% retained</div>
                <div>{lapsedPct}% lapsed</div>
              </div>
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Year-over-Year</p>
        
        <div className="mt-4 text-center">
          {loading ? (
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="text-sm text-gray-600">
              {summaryText}
            </p>
          )}
        </div>

        {!loading && total > 0 && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2 w-full rounded-full overflow-hidden border border-gray-200 flex">
              <button
                type="button"
                onMouseEnter={() => setHoverSegment("retained")}
                onMouseLeave={() => setHoverSegment(null)}
                className="bg-green-500 transition-opacity hover:opacity-90"
                style={{ width: `${retainedPct}%` }}
                title={`Retained: ${retained} (${retainedPct}%)`}
              />
              <button
                type="button"
                onMouseEnter={() => setHoverSegment("lapsed")}
                onMouseLeave={() => setHoverSegment(null)}
                className="bg-gray-300 transition-opacity hover:opacity-90"
                style={{ width: `${lapsedPct}%` }}
                title={`Lapsed: ${lapsed} (${lapsedPct}%)`}
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              {hoverSegment === "retained" && `Retained: ${retained} donors (${retainedPct}%)`}
              {hoverSegment === "lapsed" && `Lapsed: ${lapsed} donors (${lapsedPct}%)`}
              {!hoverSegment && "Hover the bar to inspect retention split"}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
