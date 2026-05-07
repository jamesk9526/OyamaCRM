/**
 * StatCard — compact metric card for the dashboard top row.
 * Displays a label, formatted value, icon, and optional alert badge.
 */
"use client";

interface StatCardProps {
  label: string;
  /** Numeric value to display */
  value: number | undefined;
  /** "currency" formats as USD, default is plain number */
  format?: "currency" | "number" | "percent";
  icon?: string;
  loading?: boolean;
  /** Small red alert text shown below the value */
  alert?: string;
}

/**
 * Formats a number for display.
 */
function fmt(v: number, format: StatCardProps["format"] = "number"): string {
  if (format === "currency") {
    return v >= 1000
      ? `$${(v / 1000).toFixed(1)}k`
      : `$${v.toFixed(0)}`;
  }
  if (format === "percent") return `${v}%`;
  return v.toLocaleString();
}

export default function StatCard({ label, value, format, icon, loading, alert }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      {/* Icon */}
      {icon && (
        <span className="text-xl shrink-0" aria-hidden="true">{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        {loading ? (
          /* Skeleton shimmer */
          <div className="h-6 w-16 mt-1 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-gray-900">
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
