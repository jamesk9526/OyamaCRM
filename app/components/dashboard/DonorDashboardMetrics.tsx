import { Gift, TrendingUp, Users, Megaphone } from "lucide-react";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

export default function DonorDashboardMetrics({summary, loading: summaryLoading}: {summary: DonorDashboardSummary | null; loading: boolean}) {
  const revenueChange = summary?.revenueChangePercent;
  const comparisonHelper = summary?.previousPeriodAmount === 0 ? "No prior-year giving to compare" : "Prior-year comparison unavailable";

  const giftsQuery = new URLSearchParams({ status: "COMPLETED" });
  if (summary?.period?.from) giftsQuery.set("from", summary.period.from.slice(0, 10));
  if (summary?.period?.through) giftsQuery.set("to", summary.period.through.slice(0, 10));
  const matchingGiftsHref = `/donations?${giftsQuery}`;
  const monthQuery = new URLSearchParams({ status: "COMPLETED" });
  if (summary?.period?.monthFrom) monthQuery.set("from", summary.period.monthFrom.slice(0, 10));
  if (summary?.period?.monthThrough) monthQuery.set("to", summary.period.monthThrough.slice(0, 10));

  return (
      <section aria-label="Performance summary">
        <div className="donor-performance-metrics grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 xl:grid-cols-4">
          <CRMMetricCard href={matchingGiftsHref} label="Giving this year" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.ytdAmount)) : "—"} icon={<TrendingUp className="h-4 w-4" />} helper={revenueChange != null ? <span className={revenueChange < 0 ? "text-amber-700" : "text-emerald-700"}>{revenueChange > 0 ? "+" : ""}{revenueChange.toFixed(1)}% vs. same elapsed prior year</span> : comparisonHelper} loading={summaryLoading} tone="green" />
          <CRMMetricCard href={`/donations?${monthQuery}`} label="Giving this month" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.monthAmount)) : "—"} icon={<Gift className="h-4 w-4" />} helper="Completed gifts this calendar month" loading={summaryLoading} tone="blue" />
          <CRMMetricCard href="/constituents" label="Constituents" value={summary?.totalConstituents.toLocaleString() ?? "—"} icon={<Users className="h-4 w-4" />} helper="All constituent records" loading={summaryLoading} tone="orange" />
          <CRMMetricCard href="/campaigns" label="Active campaigns" value={summary?.activeCampaigns.toLocaleString() ?? "—"} icon={<Megaphone className="h-4 w-4" />} helper="Currently active campaigns" loading={summaryLoading} tone="orange" />
        </div>
      </section>
  );
}
