/** EventsMetricCard renders a compact purple-accent KPI card for Events CRM pages. */

interface EventsMetricCardProps {
  /** Card label shown above the metric. */
  label: string;
  /** Numeric or text value shown prominently. */
  value: string | number;
  /** Optional helper text below the value. */
  helper?: string;
}

/**
 * EventsMetricCard displays a single metric using the Events CRM visual language.
 */
export default function EventsMetricCard({ label, value, helper }: EventsMetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-violet-100 shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {helper && (
        <p className="text-xs text-gray-500 mt-1">{helper}</p>
      )}
    </div>
  );
}
