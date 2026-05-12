/** CampaignGoalHealthWidget summarizes campaign goal attainment and funding gap health. */
"use client";

interface CampaignGoalHealthWidgetProps {
  activeCampaigns: number;
  activeGoalTotal: number;
  raisedAmount: number;
  loading?: boolean;
}

/** Formats a USD value for compact widget display. */
function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** CampaignGoalHealthWidget renders compact campaign attainment diagnostics for staff. */
export default function CampaignGoalHealthWidget({
  activeCampaigns,
  activeGoalTotal,
  raisedAmount,
  loading = false,
}: CampaignGoalHealthWidgetProps) {
  const safeGoal = Math.max(activeGoalTotal, 0);
  const progressPct = safeGoal > 0 ? Math.round((raisedAmount / safeGoal) * 100) : 0;
  const clampedPct = Math.max(0, Math.min(progressPct, 100));
  const goalGap = Math.max(safeGoal - raisedAmount, 0);
  const avgRaisedPerCampaign = activeCampaigns > 0 ? raisedAmount / activeCampaigns : 0;

  if (loading) {
    return <div className="h-28 rounded-lg bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Active Campaigns</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">{activeCampaigns}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Avg Raised</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">{fmtCurrency(avgRaisedPerCampaign)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>{fmtCurrency(raisedAmount)} raised</span>
          <span>{fmtCurrency(safeGoal)} goal</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${clampedPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="font-semibold text-gray-700">{progressPct}% attainment</span>
          <span className={goalGap > 0 ? "text-amber-600 font-medium" : "text-green-700 font-medium"}>
            {goalGap > 0 ? `${fmtCurrency(goalGap)} to goal` : "Goal exceeded"}
          </span>
        </div>
      </div>
    </div>
  );
}
