/** WorkflowPressureWidget summarizes stewardship workload pressure and follow-up risk. */
"use client";

interface WorkflowPressureWidgetProps {
  pendingTasks: number;
  overdueTasks: number;
  newDonorsThisMonth: number;
  retentionRate: number;
  loading?: boolean;
}

export default function WorkflowPressureWidget({
  pendingTasks,
  overdueTasks,
  newDonorsThisMonth,
  retentionRate,
  loading = false,
}: WorkflowPressureWidgetProps) {
  const overduePct = pendingTasks > 0 ? Math.round((overdueTasks / pendingTasks) * 100) : 0;
  const followUpLoad = overdueTasks + newDonorsThisMonth;

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pending</p>
          <p className="mt-0.5 text-base font-semibold text-slate-900">{pendingTasks.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Overdue</p>
          <p className="mt-0.5 text-base font-semibold text-amber-800">{overdueTasks.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">New</p>
          <p className="mt-0.5 text-base font-semibold text-emerald-800">{newDonorsThisMonth.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Workload pressure</span>
          <span className={overduePct >= 30 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
            {overduePct}% overdue
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={overduePct >= 30 ? "h-full bg-amber-500" : "h-full bg-emerald-500"}
            style={{ width: `${Math.min(100, Math.max(6, overduePct))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Follow-up load: {followUpLoad.toLocaleString()} | Retention baseline: {retentionRate}%
        </p>
      </div>
    </div>
  );
}
