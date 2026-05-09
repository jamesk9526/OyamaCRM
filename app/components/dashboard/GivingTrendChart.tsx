"use client";
/**
 * GivingTrendChart — CSS bar chart showing monthly donation totals for the current year.
 * Fetches /api/reports/giving-by-month?year=YYYY. Renders 12 green bars with
 * hover tooltips and month labels. Gray bars = no donations that month.
 */

import { useEffect, useState } from "react";

interface MonthData {
  month: number;    // 1-12
  amount: number;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Format currency compactly: 1500 → "$1.5k", 15000 → "$15k" */
function formatCompact(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${n}`;
}

export default function GivingTrendChart() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const year = new Date().getFullYear();

  useEffect(() => {
    fetch(`/api/reports/giving-by-month?year=${year}`)
      .then((r) => r.json())
      .then((rows: MonthData[]) => {
        // Ensure all 12 months are present (fill zeros)
        const filled = Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          amount: rows.find((r) => r.month === i + 1)?.amount ?? 0,
        }));
        setData(filled);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year]);

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const totalYTD = data.reduce((s, d) => s + d.amount, 0);
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
        <span className="text-xs font-medium text-gray-400">{year}</span>
      </div>

      {/* Bar chart */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-300 text-sm">Loading chart…</div>
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-1 px-1 relative">
          {data.map((d) => {
            const heightPct = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
            const isHovered = hoveredMonth === d.month;
            const isCurrent = d.month === currentMonth;
            const isEmpty = d.amount === 0;

            return (
              <div
                key={d.month}
                className="flex-1 flex flex-col items-center gap-1 group"
                onMouseEnter={() => setHoveredMonth(d.month)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg shadow-lg whitespace-nowrap z-10 pointer-events-none"
                    style={{ left: "50%", transform: "translateX(-50%)" }}>
                    {MONTH_LABELS[d.month - 1]}: {formatCompact(d.amount)}
                  </div>
                )}

                {/* Bar container — fixed height with bar growing from bottom */}
                <div className="w-full flex-1 flex items-end" style={{ minHeight: "100px" }}>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-200 cursor-pointer
                      ${isEmpty ? "bg-gray-100" : isCurrent ? "bg-green-500" : "bg-green-400"}
                      ${isHovered && !isEmpty ? "bg-green-600" : ""}
                    `}
                    style={{ height: `${Math.max(heightPct, isEmpty ? 4 : 8)}%` }}
                  />
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
    </div>
  );
}
