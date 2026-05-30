/**
 * ImpactSummaryBand renders a floating white card that overlaps the hero section,
 * showing 6 key donor impact metrics in a clean horizontal strip.
 */
"use client";

interface ImpactMetric {
  label: string;
  value: string;
  helper: string;
  iconPath: string;
  tone: "emerald" | "blue" | "violet" | "amber" | "rose" | "cyan";
  /** Optional trend text, e.g. "↑ 14% vs last year" */
  trendText?: string;
}

interface ImpactSummaryBandProps {
  loading: boolean;
  totalGiving: string;
  activeDonors: string;
  newDonors: string;
  followUpsNeeded: string;
  retentionRate: string;
  monthlyGiving: string;
  /** Month-over-month trend for "This Month" metric (percentage) */
  momTrend?: number | null;
}

const TONE_CLASSES: Record<string, { bg: string; text: string; ring: string; spark: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", spark: "#059669" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-100", spark: "#3b82f6" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-100", spark: "#8b5cf6" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100", spark: "#f59e0b" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-100", spark: "#f43f5e" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-700", ring: "ring-cyan-100", spark: "#06b6d4" },
};

function ImpactMetricItem({ label, value, helper, iconPath, tone, loading, trendText }: ImpactMetric & { loading: boolean }) {
  const tc = TONE_CLASSES[tone];
  const hasValue = value !== "—";
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 px-5 py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${tc.bg} ${tc.text} ${tc.ring}`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0 w-full">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-20 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        )}
        {trendText && hasValue ? (
          <p className="mt-0.5 truncate text-xs font-semibold text-emerald-600">{trendText}</p>
        ) : (
          <p className="mt-0.5 truncate text-xs font-medium text-slate-400">{hasValue ? helper : "No data recorded yet"}</p>
        )}
      </div>
    </div>
  );
}

/** ImpactSummaryBand overlaps the hero and floats above the page background. */
export default function ImpactSummaryBand({
  loading,
  totalGiving,
  activeDonors,
  newDonors,
  followUpsNeeded,
  retentionRate,
  monthlyGiving,
  momTrend,
}: ImpactSummaryBandProps) {
  const momTrendText = momTrend != null
    ? `${momTrend >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(momTrend))}% vs last month`
    : undefined;

  const metrics: (ImpactMetric & { key: string })[] = [
    {
      key: "giving",
      label: "Total Giving",
      value: totalGiving,
      helper: "Completed gifts in scope",
      iconPath: "M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7",
      tone: "emerald",
    },
    {
      key: "donors",
      label: "Active Donors",
      value: activeDonors,
      helper: "Donors who gave this year",
      iconPath: "M8.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.75 18.5a4.75 4.75 0 0 1 9.5 0M10.75 18.5a4.75 4.75 0 0 1 9.5 0",
      tone: "blue",
    },
    {
      key: "new",
      label: "New Donors",
      value: newDonors,
      helper: "First gifts this year",
      iconPath: "M12 5v14M5 12h14",
      tone: "violet",
    },
    {
      key: "followup",
      label: "Follow-Ups Needed",
      value: followUpsNeeded,
      helper: "Stewardship tasks open",
      iconPath: "M9 11l2 2 4-4M5 5h14v14H5V5z",
      tone: "amber",
    },
    {
      key: "retention",
      label: "Retention Rate",
      value: retentionRate,
      helper: "Donors retained this year",
      iconPath: "M4 13h3l2-6 4 12 2-6h5",
      tone: "cyan",
    },
    {
      key: "monthly",
      label: "This Month",
      value: monthlyGiving,
      helper: "Received this calendar month",
      iconPath: "M4.5 6.5h15v12h-15v-12ZM8 4v4M16 4v4M4.5 10.5h15",
      tone: "emerald",
      trendText: momTrendText,
    },
  ];

  return (
    <div className="relative -mt-5 z-10 mx-4 rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
      <div className="grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        {metrics.map(({ key: metricKey, trendText, ...metricProps }, idx) => (
          <div
            key={metricKey}
            className={`${idx < metrics.length - 1 && idx % 2 === 0 ? "border-r border-slate-100 sm:border-r-0" : ""}`}
          >
            <ImpactMetricItem {...metricProps} loading={loading} trendText={trendText} />
          </div>
        ))}
      </div>
    </div>
  );
}
