"use client";
/**
 * GivingTrendChart — CSS bar chart showing monthly donation totals for the current year.
 * Fetches /api/reports/giving-by-month?year=YYYY.
 * When includeGrants=true, stacks awarded grant amounts on top of each bar in a lighter shade.
 * Renders 12 bars with hover tooltips and month labels.
 */

import { useEffect, useState } from "react";

interface MonthData {
  month: number;       // 1-12
  amount: number;      // donation total
  grantAmount: number; // awarded grant total (may be 0)
}

interface GivingTrendChartProps {
  /**
   * When true, grant amounts are stacked onto each bar and counted in the YTD total.
   * This matches the "Include Grants" toggle on the dashboard.
   */
  includeGrants?: boolean;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Format currency compactly: 1500 → "$1.5k", 15000 → "$15k" */
function formatCompact(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${n}`;
}

export default function GivingTrendChart({ includeGrants = false }: GivingTrendChartProps) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const year = new Date().getFullYear();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/giving-by-month?year=${year}`)
      .then((r) => r.json())
      .then((rows: MonthData[]) => {
        // Ensure all 12 months are present (fill zeros), pick up the new grantAmount field
        const filled = Array.from({ length: 12 }, (_, i) => {
          const found = rows.find((r) => r.month === i + 1);
          return {
            month: i + 1,
            amount: found?.amount ?? 0,
            grantAmount: found?.grantAmount ?? 0,
          };
        });
        setData(filled);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year]);

  /** Bar total = donations + grants (when includeGrants is on) */
  const barTotal = (d: MonthData) => d.amount + (includeGrants ? d.grantAmount : 0);
  const maxAmount = Math.max(...data.map(barTotal), 1);

  /** YTD total shown in the sub-header */
  const totalYTD = data.reduce((s, d) => s + barTotal(d), 0);
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="flex flex-col h-full min-h-[220px]">
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wider">YTD Total</span>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">
            {loading ? "—" : `$${totalYTD.toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Grants-included badge (visual feedback mirroring the toggle on Revenue Progress) */}
          {includeGrants && (
            <span className="text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5">
              + Grants
            </span>
          )}
          <span className="text-xs font-medium text-gray-400">{year}</span>
        </div>
      </div>

      {/* Bar chart */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-300 text-sm">Loading chart…</div>
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-1 px-1 relative">
          {data.map((d) => {
            const total = barTotal(d);
            const heightPct = maxAmount > 0 ? (total / maxAmount) * 100 : 0;
            // Donation portion as fraction of the total bar (for the stacked inner bar)
            const donationFrac = total > 0 ? d.amount / total : 1;
            const isHovered = hoveredMonth === d.month;
            const isCurrent = d.month === currentMonth;
            const isEmpty = total === 0;

            return (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-1 group"
                onMouseEnter={() => setHoveredMonth(d.month)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-10 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg shadow-lg whitespace-nowrap z-10 pointer-events-none"
                    style={{ left: "50%", transform: "translateX(-50%)" }}>
                    {MONTH_LABELS[d.month - 1]}: {formatCompact(d.amount)}
                    {includeGrants && d.grantAmount > 0 && ` + ${formatCompact(d.grantAmount)} grants`}
                  </div>
                )}

                {/* Bar container — fixed height with bar growing from bottom */}
                <div className="w-full flex-1 flex items-end" style={{ minHeight: "100px" }}>
                  {isEmpty ? (
                    /* Empty bar */
                    <div className="w-full rounded-t-sm bg-gray-100" style={{ height: "4%" }} />
                  ) : includeGrants && d.grantAmount > 0 ? (
                    /* Stacked bar: green (donations) on bottom, emerald-200 (grants) on top */
                    <div
                      className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse transition-all duration-200 cursor-pointer"
                      style={{ height: `${Math.max(heightPct, 8)}%` }}
                    >
                      {/* Donation segment (bottom) */}
                      <div
                        className={`w-full ${isCurrent ? "bg-green-500" : "bg-green-400"} ${isHovered ? "brightness-90" : ""}`}
                        style={{ flex: `0 0 ${donationFrac * 100}%` }}
                      />
                      {/* Grant segment (top, lighter) */}
                      <div
                        className="w-full bg-emerald-200"
                        style={{ flex: `0 0 ${(1 - donationFrac) * 100}%` }}
                      />
                    </div>
                  ) : (
                    /* Single-color bar (donations only) */
                    <div
                      className={`w-full rounded-t-sm transition-all duration-200 cursor-pointer
                        ${isCurrent ? "bg-green-500" : "bg-green-400"}
                        ${isHovered ? "!bg-green-600" : ""}
                      `}
                      style={{ height: `${Math.max(heightPct, 8)}%` }}
                    />
                  )}
                </div>

                {/* Month label */}
                <span className={`text-[9px] font-medium ${isCurrent ? "text-green-600" : "text-gray-400"}`}>
                  {MONTH_LABELS[d.month - 1]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Grant legend — only shown when grants are stacked */}
      {includeGrants && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />
            Donations
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200" />
            Grants
          </span>
        </div>
      )}
    </div>
  );
}
