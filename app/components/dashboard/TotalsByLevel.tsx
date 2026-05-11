/**
 * TotalsByLevel — weekly giving summary card with a simple bar chart.
 * Accepts loading prop for skeleton state.
 */
"use client";

import Card from "@/app/components/ui/Card";
import { useMemo, useState } from "react";

interface TotalsByLevelProps {
  weekTotal: number;
  transactions: number;
  avgTransaction: number;
  loading?: boolean;
}

export default function TotalsByLevel({ weekTotal, transactions, avgTransaction, loading }: TotalsByLevelProps) {
  const [view, setView] = useState<"revenue" | "raised">("revenue");
  const [activeIndex, setActiveIndex] = useState(0);

  const levels = useMemo(() => {
    // Visual level split until a per-level weekly breakdown endpoint is wired.
    const blueprint = [
      { label: "Major", ratio: 0.32, color: "bg-green-700" },
      { label: "Mid", ratio: 0.24, color: "bg-green-600" },
      { label: "Annual", ratio: 0.19, color: "bg-green-500" },
      { label: "Recurring", ratio: 0.15, color: "bg-emerald-500" },
      { label: "New", ratio: 0.1, color: "bg-emerald-400" },
    ] as const;

    return blueprint.map((level) => ({
      ...level,
      amount: Math.round(weekTotal * level.ratio),
      count: Math.max(0, Math.round(transactions * level.ratio)),
    }));
  }, [transactions, weekTotal]);

  const selected = levels[Math.min(activeIndex, levels.length - 1)] ?? levels[0];
  const metricForLevel = (index: number) => view === "revenue" ? levels[index].amount : levels[index].count;
  const maxMetric = Math.max(...levels.map((_, index) => metricForLevel(index)), 1);

  return (
    <Card padding="small">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Totals by Level</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("revenue")}
            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
              view === "revenue"
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => setView("raised")}
            className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
              view === "raised"
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            Raised
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-xs text-gray-500 mb-1">This week</p>
          <div className="flex items-baseline gap-4">
            {loading ? (
              <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">${weekTotal.toLocaleString()}</p>
            )}
            {!loading && (
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>{transactions} transactions</p>
                <p>${avgTransaction.toFixed(2)} avg</p>
              </div>
            )}
          </div>
        </div>

        {/* Interactive level bars */}
        <div className="rounded bg-gradient-to-r from-green-50 to-green-100 px-2 py-1.5">
          <div className="mb-2 text-[11px] text-gray-600">
            <span className="font-semibold text-gray-700">{selected?.label}</span>
            {view === "revenue" ? `: $${selected?.amount.toLocaleString()}` : `: ${selected?.count.toLocaleString()} gifts`}
          </div>
          <div className="h-[4.5rem] flex items-end gap-1.5">
            {levels.map((level, index) => {
              const barHeight = Math.max(20, Math.round((metricForLevel(index) / maxMetric) * 100));
              const active = index === activeIndex;
              return (
                <button
                  key={level.label}
                  type="button"
                  title={`${level.label}: ${view === "revenue" ? `$${level.amount.toLocaleString()}` : `${level.count} gifts`}`}
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex-1 rounded-t transition-all duration-150 ${level.color} ${active ? "opacity-100" : "opacity-70 hover:opacity-90"}`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] text-gray-500">
            {levels.map((level, index) => (
              <button
                key={`${level.label}-label`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`truncate text-center rounded px-1 py-0.5 ${index === activeIndex ? "bg-white/80 text-gray-700 font-medium" : "hover:bg-white/60"}`}
                title={level.label}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-400">
          <span>{view === "revenue" ? "$0" : "0 gifts"}</span>
          <span>
            {view === "revenue"
              ? `$${maxMetric.toLocaleString()}`
              : `${Math.max(5, transactions)} gifts`}
          </span>
        </div>
      </div>
    </Card>
  );
}
