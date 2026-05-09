/** EventsKPICard renders a richer metric card with trend indicators and comparison data. */

interface EventsKPICardProps {
  /** Card label shown above the metric. */
  label: string;
  /** Primary numeric or text value shown prominently. */
  value: string | number;
  /** Optional helper text below the value. */
  helper?: string;
  /** Optional trend indicator (positive, negative, or neutral). */
  trend?: "up" | "down" | "neutral";
  /** Optional trend percentage or value. */
  trendValue?: string;
  /** Optional comparison text (e.g., "vs last event" or "this month"). */
  comparison?: string;
  /** Optional icon element. */
  icon?: React.ReactNode;
}

/**
 * EventsKPICard displays a single metric using the Events CRM visual language
 * with added context for trends, comparisons, and operational insights.
 */
export default function EventsKPICard({
  label,
  value,
  helper,
  trend,
  trendValue,
  comparison,
  icon,
}: EventsKPICardProps) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-400",
  };

  const trendIcons = {
    up: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    ),
    down: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    ),
    neutral: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">{label}</p>
        {icon && (
          <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {(trend || helper) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend && trendValue && (
            <span className={`flex items-center gap-1 font-semibold ${trendColors[trend]}`}>
              {trendIcons[trend]}
              {trendValue}
            </span>
          )}
          {helper && <span className="text-gray-500">{helper}</span>}
          {comparison && <span className="text-gray-400">· {comparison}</span>}
        </div>
      )}
    </div>
  );
}
