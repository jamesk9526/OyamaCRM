/**
 * GivingTrendChart — elegant Recharts area chart for the naturalistic dashboard.
 * Shows giving over time with a soft gradient fill and minimal grid lines.
 */
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendPoint {
  label: string;
  amount: number;
}

interface GivingTrendChartProps {
  points: TrendPoint[];
  total: number;
  giftCount: number;
  loading: boolean;
  rangeLabel: string;
  trendPercent: number | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatAxisY(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/** GivingTrendChart renders a clean area chart with a mission-story summary line. */
export default function GivingTrendChart({
  points,
  total,
  giftCount,
  loading,
  rangeLabel,
  trendPercent,
}: GivingTrendChartProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Giving Trend</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{rangeLabel} · {giftCount.toLocaleString()} gifts</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight text-slate-950">{formatCurrency(total)}</p>
          {trendPercent != null ? (
            <p className={`mt-0.5 text-xs font-semibold ${trendPercent >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {trendPercent >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trendPercent))}% vs prior period
            </p>
          ) : null}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 text-xs font-medium text-slate-400 animate-pulse">
          Loading giving data…
        </div>
      ) : points.length === 0 || total === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <p className="text-sm font-semibold text-slate-500">No giving data in this view</p>
          <p className="mt-1 text-xs text-slate-400">Adjust the date range or record a donation to see trends.</p>
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="naturalisticGivingGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                minTickGap={8}
              />
              <YAxis
                tickFormatter={formatAxisY}
                tick={{ fontSize: 10, fill: "#cbd5e1" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Giving"]}
                contentStyle={{ borderRadius: 10, borderColor: "#d1fae5", fontSize: 12 }}
                labelStyle={{ fontWeight: 700, color: "#1e293b" }}
                cursor={{ stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "4 2" }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#059669"
                strokeWidth={2.5}
                fill="url(#naturalisticGivingGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insight line */}
      {!loading && total > 0 && trendPercent != null ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {trendPercent >= 0
            ? `Giving is up ${Math.abs(Math.round(trendPercent))}% compared to the prior period.`
            : `Giving is down ${Math.abs(Math.round(trendPercent))}% compared to the prior period.`}
        </p>
      ) : null}
    </div>
  );
}
