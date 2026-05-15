/**
 * StatCard — compact metric card for the dashboard top row.
 * Displays a label, formatted value, SVG icon, and optional alert badge.
 * Styled after clean reference CRM metric cards with a left accent bar.
 */
"use client";

import type React from "react";

interface StatCardProps {
  label: string;
  /** Numeric value to display */
  value: number | undefined;
  /** "currency" formats as USD, default is plain number */
  format?: "currency" | "number" | "percent";
  /** SVG ReactNode icon — do NOT pass emoji strings */
  icon?: React.ReactNode;
  loading?: boolean;
  /** Small red alert text shown below the value */
  alert?: string;
  /** Small gray info note shown below the value (e.g. "incl. $X grants") */
  note?: string;
  /** Optional left-border accent color class, e.g. "border-green-500" */
  accent?: string;
  /** Optional month-over-month trend: { value: ±%, label: string } */
  trend?: { value: number; label: string };
}

/**
 * Formats a number for display.
 */
function fmt(v: number, format: StatCardProps["format"] = "number"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v);
  }
  if (format === "percent") return `${v}%`;
  return v.toLocaleString();
}

export default function StatCard({ label, value, format, icon, loading, alert, note, accent = "border-gray-200", trend }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border-l-4 border border-gray-200 ${accent} px-4 py-3.5 flex items-center gap-3.5 shadow-sm`}>
      {/* Icon container */}
      {icon && (
        <span className="shrink-0 w-8 h-8 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        {loading ? (
          /* Skeleton shimmer */
          <div className="h-6 w-16 mt-1 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-gray-900 mt-0.5">
            {value != null ? fmt(value, format) : "—"}
          </p>
        )}
        {/* Trend indicator (MoM) */}
        {trend != null && !loading && (
          <p className={`text-[11px] font-medium mt-0.5 ${trend.value >= 0 ? "text-green-600" : "text-red-500"}`}>
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
        {/* Contextual note (e.g. grants included) */}
        {note && !loading && (
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{note}</p>
        )}
        {/* Alert badge (e.g. overdue count) */}
        {alert && (
          <p className="text-[11px] text-red-500 font-medium mt-0.5">{alert}</p>
        )}
      </div>
    </div>
  );
}
