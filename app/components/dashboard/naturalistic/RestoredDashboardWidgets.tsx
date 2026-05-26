/**
 * RestoredDashboardWidgets brings back API-backed dashboard widgets in the refreshed layout.
 */
"use client";

import Link from "next/link";
import CampaignGoalHealthWidget from "@/app/components/dashboard/CampaignGoalHealthWidget";
import FundraisingForecastWidget from "@/app/components/dashboard/FundraisingForecastWidget";
import MeetingsWidget from "@/app/components/dashboard/MeetingsWidget";
import RecentDonationsWidget from "@/app/components/dashboard/RecentDonationsWidget";
import StewardshipAttentionWidget from "@/app/components/dashboard/StewardshipAttentionWidget";
import TopDonorsWidget from "@/app/components/dashboard/TopDonorsWidget";
import WorkflowPressureWidget from "@/app/components/dashboard/WorkflowPressureWidget";
import { toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { CampaignImpact, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import NaturalisticWidgetFrame from "./NaturalisticWidgetFrame";

interface RestoredDashboardWidgetsProps {
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  campaigns: CampaignImpact[];
  trendTotal: number;
  revenueGoal: number;
  loading: boolean;
}

function compactLink(href: string, label: string) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
      {label}
    </Link>
  );
}

export default function RestoredDashboardWidgets({
  summary,
  retention,
  campaigns,
  trendTotal,
  revenueGoal,
  loading,
}: RestoredDashboardWidgetsProps) {
  const activeCampaigns = campaigns.filter((campaign) => campaign.active);
  const activeGoalTotal = activeCampaigns.reduce((sum, campaign) => sum + toDashboardNumber(campaign.goal), 0);
  const activeRaisedTotal = activeCampaigns.reduce((sum, campaign) => sum + toDashboardNumber(campaign.totalRaised), 0);
  const pendingTasks = summary?.pendingTasks ?? 0;
  const overdueTasks = summary?.overdueTasks ?? 0;
  const newDonorsThisMonth = summary?.newDonorsThisMonth ?? 0;
  const retentionRate = retention ? Math.round(retention.rate) : 0;
  const monthAmount = summary ? toDashboardNumber(summary.monthAmount) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <NaturalisticWidgetFrame
        eyebrow="Donors"
        title="Top Donors"
        description="Ranked by real lifetime giving from the donor report API."
        action={compactLink("/reports?report=top-donors", "Report")}
      >
        <TopDonorsWidget />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Giving"
        title="Recent Donations"
        description="Latest completed gifts with donor, campaign, source, and date."
        action={compactLink("/donations", "Open")}
      >
        <RecentDonationsWidget />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Calendar"
        title="Upcoming Meetings"
        description="Scheduled donor meetings and calls from the meetings workspace."
        action={compactLink("/meetings", "View")}
      >
        <MeetingsWidget />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Care"
        title="Stewardship Attention"
        description="Unthanked gifts, major follow-up, lapsed donors, and new donor care."
        action={compactLink("/steward-signals", "Signals")}
      >
        <StewardshipAttentionWidget newDonorsThisMonth={newDonorsThisMonth} loading={loading} />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Workload"
        title="Workflow Pressure"
        description="Pending work, overdue share, and retention baseline from live summary data."
        action={compactLink("/tasks", "Tasks")}
      >
        <WorkflowPressureWidget
          pendingTasks={pendingTasks}
          overdueTasks={overdueTasks}
          newDonorsThisMonth={newDonorsThisMonth}
          retentionRate={retentionRate}
          loading={loading}
        />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Campaigns"
        title="Campaign Goal Health"
        description="Active campaign goal attainment using current campaign totals."
        action={compactLink("/campaigns", "Campaigns")}
      >
        <CampaignGoalHealthWidget
          activeCampaigns={activeCampaigns.length}
          activeGoalTotal={activeGoalTotal}
          raisedAmount={activeRaisedTotal}
          loading={loading}
        />
      </NaturalisticWidgetFrame>

      <NaturalisticWidgetFrame
        eyebrow="Pace"
        title="Fundraising Forecast"
        description="A simple projection from real YTD giving, month giving, and goal settings."
        action={compactLink("/reports", "Reports")}
      >
        <FundraisingForecastWidget
          ytdAmount={trendTotal}
          monthAmount={monthAmount}
          revenueGoal={revenueGoal}
          loading={loading}
        />
      </NaturalisticWidgetFrame>
    </div>
  );
}
