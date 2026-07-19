/** FundraisingForecastWidget projects end-of-year pacing against the current revenue goal. */
"use client";

interface FundraisingForecastWidgetProps {
  ytdAmount: number;
  monthAmount: number;
  revenueGoal: number;
  loading?: boolean;
}

// Dampens month-over-month uplift so projections stay realistic instead of overreacting to one strong month.
// 250 keeps momentum influence modest (roughly low single-digit uplift over remaining-month baseline at common dashboard ranges).
const MOMENTUM_DAMPENING_FACTOR = 250;

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Provides a simple projection using current YTD pace and recent monthly momentum. */
export default function FundraisingForecastWidget({
  ytdAmount,
  monthAmount,
  revenueGoal,
  loading = false,
}: FundraisingForecastWidgetProps) {
  const now = new Date();
  const monthsElapsed = Math.max(now.getMonth() + 1, 1);
  const monthsRemaining = Math.max(12 - monthsElapsed, 0);
  const avgPerMonth = monthsElapsed > 0 ? ytdAmount / monthsElapsed : 0;
  const projectedEoy = ytdAmount + avgPerMonth * monthsRemaining;
  const momentumLift = monthAmount > avgPerMonth && avgPerMonth > 0 ? Math.round(((monthAmount - avgPerMonth) / avgPerMonth) * 100) : 0;
  const projectedWithMomentum = projectedEoy + (momentumLift > 0 ? (avgPerMonth * monthsRemaining * momentumLift) / MOMENTUM_DAMPENING_FACTOR : 0);
  const safeGoal = Math.max(revenueGoal, 0);
  const projectionPct = safeGoal > 0 ? Math.round((projectedWithMomentum / safeGoal) * 100) : 0;
  const clampedPct = Math.max(0, Math.min(projectionPct, 160));
  const gapToGoal = Math.max(safeGoal - projectedWithMomentum, 0);
  const surplus = Math.max(projectedWithMomentum - safeGoal, 0);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projected EOY</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{fmtCurrency(projectedWithMomentum)}</p>
          <p className="text-[11px] text-slate-500">{monthsRemaining} month{monthsRemaining === 1 ? "" : "s"} remaining</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white px-3 py-2.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly Pace</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{fmtCurrency(avgPerMonth)}</p>
          <p className="text-[11px] text-slate-500">Current run-rate</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Goal projection</span>
          <span className={gapToGoal > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
            {projectionPct}% of goal
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <div
            className={`h-full rounded-full ${gapToGoal > 0 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"} transition-all duration-700`}
            style={{ width: `${Math.max(8, Math.min(clampedPct, 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {gapToGoal > 0
            ? `${fmtCurrency(gapToGoal)} projected shortfall`
            : `${fmtCurrency(surplus)} projected above goal`}
        </p>
      </div>
    </div>
  );
}
