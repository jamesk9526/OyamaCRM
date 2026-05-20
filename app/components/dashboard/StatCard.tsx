/**
 * StatCard — compact metric card for the dashboard top row.
 * Displays a label, formatted value, SVG icon, and optional alert badge.
 * Styled as a calm shared CRM metric card without changing dashboard data behavior.
 */
"use client";

import type React from "react";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";

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
  const tone = getMetricTone(accent, alert);
  const helper = (
    <div className="space-y-0.5">
      {trend != null && !loading ? (
        <p className={`font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
        </p>
      ) : null}
      {note && !loading ? <p className="font-medium text-slate-500">{note}</p> : null}
      {alert ? <p className="font-medium text-red-500">{alert}</p> : null}
    </div>
  );

  return (
    <CRMMetricCard
      label={label}
      value={value != null ? fmt(value, format) : "—"}
      icon={icon}
      loading={loading}
      helper={trend || note || alert ? helper : undefined}
      tone={tone}
    />
  );
}

/** Maps legacy accent classes into the softer shared metric-card tone system. */
function getMetricTone(accent: string, alert?: string): "green" | "blue" | "purple" | "orange" | "slate" {
  if (alert) return "orange";
  if (accent.includes("blue") || accent.includes("sky")) return "blue";
  if (accent.includes("purple") || accent.includes("violet")) return "purple";
  if (accent.includes("orange") || accent.includes("amber") || accent.includes("yellow")) return "orange";
  if (accent.includes("green") || accent.includes("emerald")) return "green";
  return "slate";
}
