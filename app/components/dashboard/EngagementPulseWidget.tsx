/** EngagementPulseWidget provides compact engagement and stewardship workload signals. */
"use client";

interface EngagementPulseWidgetProps {
  pendingTasks: number;
  overdueTasks: number;
  newDonorsThisMonth: number;
  monthDonationCount: number;
  loading?: boolean;
}

/** EngagementPulseWidget renders a compact four-metric pulse board for daily prioritization. */
export default function EngagementPulseWidget({
  pendingTasks,
  overdueTasks,
  newDonorsThisMonth,
  monthDonationCount,
  loading = false,
}: EngagementPulseWidgetProps) {
  if (loading) {
    return <div className="h-28 rounded-lg bg-gray-100 animate-pulse" />;
  }

  const metrics = [
    {
      label: "Pending",
      value: pendingTasks,
      tone: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      label: "Overdue",
      value: overdueTasks,
      tone: overdueTasks > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200",
    },
    {
      label: "New Donors",
      value: newDonorsThisMonth,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      label: "Monthly Gifts",
      value: monthDonationCount,
      tone: "text-purple-700 bg-purple-50 border-purple-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded-lg border px-3 py-2 ${metric.tone}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{metric.label}</p>
          <p className="text-lg font-semibold mt-0.5">{metric.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
