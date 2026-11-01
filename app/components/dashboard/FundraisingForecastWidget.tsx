/** FundraisingForecastWidget projects end-of-year pacing against the current revenue goal. */
"use client";
import { buildFundraisingForecast } from "@/app/features/donor-dashboard/calculations/fundraising-forecast";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

interface FundraisingForecastWidgetProps {
  ytdAmount: number;
  period: DonorDashboardSummary["period"];
  revenueGoal: number;
  loading?: boolean;
}

/** Provides a simple projection using current YTD pace and recent monthly momentum. */
export default function FundraisingForecastWidget({
  ytdAmount,
  period,
  revenueGoal,
  loading = false,
}: FundraisingForecastWidgetProps) {
  const forecast = buildFundraisingForecast(ytdAmount, period);
  const projectedAmount = forecast?.projected ?? 0;
  const avgPerMonth = forecast?.monthlyPace ?? 0;
  const safeGoal = Math.max(revenueGoal, 0);
  const projectionPct = safeGoal > 0 ? Math.round((projectedAmount / safeGoal) * 100) : 0;
  const clampedPct = Math.max(0, Math.min(projectionPct, 160));
  const gapToGoal = Math.max(safeGoal - projectedAmount, 0);
  const surplus = Math.max(projectedAmount - safeGoal, 0);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;
  }

  if (!forecast) return <p className="py-6 text-sm text-slate-600">A valid reporting interval is needed to estimate year-end giving.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-slate-500">Linear estimate based on completed giving and the elapsed reporting year. Seasonal giving may change the outcome.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projected year-end</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatDashboardCurrency(projectedAmount)}</p>
          <p className="text-[11px] text-slate-500">{forecast.remainingDays} days remaining in the reporting year</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly Pace</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatDashboardCurrency(avgPerMonth)}</p>
          <p className="text-[11px] text-slate-500">Average pace over the elapsed reporting period</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Goal projection</span>
          <span className={gapToGoal > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
            {safeGoal > 0 ? `${projectionPct}% of goal` : "No goal configured"}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <div
            className={`h-full rounded-full ${gapToGoal > 0 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"} transition-all duration-700`}
            style={{ width: `${Math.max(0, Math.min(clampedPct, 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {safeGoal <= 0 ? "Set a campaign goal or customize a manual target." : gapToGoal > 0
            ? `${formatDashboardCurrency(gapToGoal)} projected shortfall`
            : `${formatDashboardCurrency(surplus)} projected above goal`}
        </p>
      </div>
    </div>
  );
}
