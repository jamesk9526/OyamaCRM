/** FollowUpCapacityWidget estimates whether current task throughput can cover donor follow-up demand. */
"use client";

interface FollowUpCapacityWidgetProps {
  pendingTasks: number;
  overdueTasks: number;
  newDonorsThisMonth: number;
  monthCount: number;
  loading?: boolean;
}

// Heuristics for translating donor activity into likely stewardship follow-up demand.
const DONOR_DEMAND_MULTIPLIER = 1.2;
const GIFT_DEMAND_FACTOR = 0.15;
// Heuristics for expected team follow-up capacity from active donor intake.
const DONOR_CAPACITY_MULTIPLIER = 2;
const BASE_CAPACITY_OFFSET = 8;
const MIN_HEALTHY_CAPACITY = 12;

/** Converts current stewardship load into a simple capacity ratio for planning. */
export default function FollowUpCapacityWidget({
  pendingTasks,
  overdueTasks,
  newDonorsThisMonth,
  monthCount,
  loading = false,
}: FollowUpCapacityWidgetProps) {
  const activeFollowUps = Math.max(pendingTasks + overdueTasks, 0);
  const incomingDemand = Math.max(Math.round(newDonorsThisMonth * DONOR_DEMAND_MULTIPLIER + monthCount * GIFT_DEMAND_FACTOR), 0);
  const totalDemand = activeFollowUps + incomingDemand;
  const healthyCapacity = Math.max(newDonorsThisMonth * DONOR_CAPACITY_MULTIPLIER + BASE_CAPACITY_OFFSET, MIN_HEALTHY_CAPACITY);
  const demandPct = healthyCapacity > 0 ? Math.round((totalDemand / healthyCapacity) * 100) : 0;
  const clampedDemandPct = Math.max(0, Math.min(demandPct, 170));
  const pressureLevel = demandPct >= 130 ? "High pressure" : demandPct >= 90 ? "Watch closely" : "Healthy";
  const pressureTone = demandPct >= 130
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : demandPct >= 90
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Follow-ups</p>
          <p className="mt-0.5 text-base font-semibold text-slate-900">{activeFollowUps.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Incoming</p>
          <p className="mt-0.5 text-base font-semibold text-slate-900">{incomingDemand.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Capacity</p>
          <p className="mt-0.5 text-base font-semibold text-slate-900">{healthyCapacity.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Follow-up capacity load</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pressureTone}`}>{pressureLevel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 ${demandPct >= 130 ? "bg-rose-500" : demandPct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.max(8, Math.min(clampedDemandPct, 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Demand load {demandPct}% | Overdue tasks: {overdueTasks.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
