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
  return <div className="min-w-0 bg-white p-4"><p className="text-xs font-medium text-[#616161]">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[#242424]">{value}</p>{helper ? <p className="mt-1 truncate text-xs text-[#8a8886]">{helper}</p> : null}</div>;
}
