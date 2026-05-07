/**
 * StatCard — compact metric card for the dashboard top row.
 * Displays a label, formatted value, SVG icon, and optional alert badge.
 * Styled after Bloomerang's clean metric cards with a left accent bar.
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
  /** Optional left-border accent color class, e.g. "border-green-500" */
  accent?: string;
}

/**
 * Formats a number for display.
 */
function fmt(v: number, format: StatCardProps["format"] = "number"): string {
  if (format === "currency") {
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (v >= 1000) {
      const k = v / 1000;
      return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    return `$${v.toFixed(0)}`;
  }
  if (format === "percent") return `${v}%`;
  return v.toLocaleString();
}

export default function StatCard({ label, value, format, icon, loading, alert, accent = "border-gray-200" }: StatCardProps) {
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
        {/* Alert badge (e.g. overdue count) */}
        {alert && (
          <p className="text-[11px] text-red-500 font-medium mt-0.5">{alert}</p>
        )}
      </div>
    </div>
  );
}
