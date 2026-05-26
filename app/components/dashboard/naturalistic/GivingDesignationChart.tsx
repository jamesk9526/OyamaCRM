/**
 * GivingDesignationChart — soft donut chart showing breakdown by designation/fund.
 * Uses Recharts PieChart with a calm forest green color palette.
 */
"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface DesignationSlice {
  name: string;
  amount: number;
}

interface GivingDesignationChartProps {
  slices: DesignationSlice[];
  total: number;
  loading: boolean;
}

/** Earthy, calm naturalistic palette: forest greens + gold + slate */
const PALETTE = [
  "#059669", // emerald-600
  "#047857", // emerald-700
  "#065f46", // emerald-800
  "#D6A84F", // warm gold
  "#6ee7b7", // emerald-300
  "#a7f3d0", // emerald-200
  "#10b981", // emerald-500
  "#34d399", // emerald-400
];

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function percent(v: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((v / total) * 100)}%`;
}

/** GivingDesignationChart renders a donut with legend and fund breakdown. */
export default function GivingDesignationChart({ slices, total, loading }: GivingDesignationChartProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Giving by Designation</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">
          {loading ? "Loading…" : `${slices.length} fund${slices.length !== 1 ? "s" : ""} · ${formatCurrency(total)}`}
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 animate-pulse text-xs font-medium text-slate-400">
          Loading designation data…
        </div>
      ) : slices.length === 0 || total === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <p className="text-sm font-semibold text-slate-500">No designation data available</p>
          <p className="mt-1 text-xs text-slate-400">Add designations to donations to see the breakdown here.</p>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div className="relative flex items-center justify-center" style={{ height: "11rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="56%"
                  outerRadius="80%"
                  paddingAngle={2}
                  isAnimationActive
                  animationDuration={800}
                >
                  {slices.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), ""]}
                  contentStyle={{ borderRadius: 10, fontSize: 12, borderColor: "#d1fae5" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="pointer-events-none absolute flex flex-col items-center">
              <p className="max-w-[6.5rem] truncate text-center text-sm font-bold text-slate-950">{formatCurrency(total)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {slices.slice(0, 6).map((slice, i) => (
              <div key={slice.name} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{slice.name}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{percent(slice.amount, total)}</span>
                <span className="shrink-0 text-xs font-bold text-slate-900">{formatCurrency(slice.amount)}</span>
              </div>
            ))}
            {slices.length > 6 && (
              <p className="text-[11px] text-slate-400 pl-5">+{slices.length - 6} more funds</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
