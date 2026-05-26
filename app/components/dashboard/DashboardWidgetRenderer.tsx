/**
 * DashboardWidgetRenderer maps widget IDs to concrete widget content.
 * Keeping the large switch here keeps route composition files small and readable.
 */

import RevenueProgress from "./RevenueProgress";
import DonorRetention from "./DonorRetention";
import TasksWidget from "./TasksWidget";
import TotalsByLevel from "./TotalsByLevel";
import DashboardWidget from "./DashboardWidget";
import GivingTrendChart from "./GivingTrendChart";
import RecentDonationsWidget from "./RecentDonationsWidget";
import TopDonorsWidget from "./TopDonorsWidget";
import MeetingsWidget from "./MeetingsWidget";
import CampaignGoalHealthWidget from "./CampaignGoalHealthWidget";
import EngagementPulseWidget from "./EngagementPulseWidget";
import StewardshipAttentionWidget from "./StewardshipAttentionWidget";
import DonationVelocityWidget from "./DonationVelocityWidget";
import WorkflowPressureWidget from "./WorkflowPressureWidget";
import ActionableInsightsWidget from "./ActionableInsightsWidget";
import FundraisingForecastWidget from "./FundraisingForecastWidget";
import FollowUpCapacityWidget from "./FollowUpCapacityWidget";
import AiInsightsWidget from "./AiInsightsWidget";
import AiOpportunityWidget from "./AiOpportunityWidget";
import AiChatWidget from "./AiChatWidget";
import MonthlyDonationsWidget from "./MonthlyDonationsWidget";
import type { ReportingYearMode } from "@/app/lib/fiscal-year";
import type { RevenueGoalMode, RevenueProgressSource } from "./DashboardLayoutModal";
import type { RetentionData, Summary, WidgetId } from "./dashboardPageConfig";
import type { DashboardWidgetFrameProps } from "./useDashboardPageState";

export interface DashboardWidgetRendererData {
  aiWidgetsEnabled: boolean;
  onToggleAiWidgets: (next: boolean) => void;
  onEnableAiWidgets: () => void;
  reportingYearMode: ReportingYearMode;
  includeGrants: boolean;
  onToggleGrants: () => void;
  revenueGoalMode: RevenueGoalMode;
  revenueProgressSource: RevenueProgressSource;
  summary: Summary | null;
  retention: RetentionData | null;
  loading: boolean;
  revenueGoal: number;
}

interface DashboardWidgetRendererProps {
  id: WidgetId;
  frame: DashboardWidgetFrameProps;
  data: DashboardWidgetRendererData;
}

export default function DashboardWidgetRenderer({ id, frame, data }: DashboardWidgetRendererProps) {
  const editProps = {
    editMode: frame.editMode,
    onMoveUp: frame.onMoveUp,
    onMoveDown: frame.onMoveDown,
    canMoveUp: frame.canMoveUp,
    canMoveDown: frame.canMoveDown,
    size: frame.size,
    onResize: frame.onResize,
    layoutClassName: frame.layoutClassName,
    ...(frame.dragProps ?? {}),
  };

  switch (id) {
    case "actionable-insights":
      return (
        <DashboardWidget
          key={id}
          id={id}
          title="Actionable Insights"
          subtitle="Cross-workspace priorities with direct action links"
          {...editProps}
        >
          <ActionableInsightsWidget />
        </DashboardWidget>
      );
    case "ai-insights":
      return (
        <DashboardWidget
          key={id}
          id={id}
          title="AI Runtime + Controls"
          subtitle="Steward status plus dashboard AI widget toggle"
          {...editProps}
        >
          <AiInsightsWidget
            dashboardEnabled={data.aiWidgetsEnabled}
            onToggleDashboardEnabled={(next) => data.onToggleAiWidgets(next)}
          />
        </DashboardWidget>
      );
    case "ai-opportunities":
      return (
        <DashboardWidget
          key={id}
          id={id}
          title="AI Opportunities"
          subtitle="Suggested stewardship opportunities"
          {...editProps}
        >
          <AiOpportunityWidget dashboardEnabled={data.aiWidgetsEnabled} onEnableDashboardAi={data.onEnableAiWidgets} />
        </DashboardWidget>
      );
    case "ai-chat":
      return (
        <DashboardWidget
          key={id}
          id={id}
          title="AI Chat"
          subtitle="Ask Steward for fast donor guidance"
          {...editProps}
        >
          <AiChatWidget dashboardEnabled={data.aiWidgetsEnabled} onEnableDashboardAi={data.onEnableAiWidgets} />
        </DashboardWidget>
      );
    case "monthly-donors":
      return (
        <DashboardWidget key={id} id={id} title="This Month's Giving" subtitle="Running total · click to see donors" {...editProps}>
          <MonthlyDonationsWidget />
        </DashboardWidget>
      );
    case "giving-trend":
      return (
        <DashboardWidget key={id} id={id} title="Giving Trend" subtitle={data.reportingYearMode === "fiscal" ? "Fiscal year monthly totals" : `${new Date().getFullYear()} monthly totals`} className="min-h-[250px]" {...editProps}>
          <GivingTrendChart includeGrants={data.includeGrants} dateBasis={data.reportingYearMode} />
        </DashboardWidget>
      );
    case "recent-donations":
      return (
        <DashboardWidget key={id} id={id} title="Recent Donations" subtitle="Last 8 gifts" {...editProps}>
          <RecentDonationsWidget />
        </DashboardWidget>
      );
    case "revenue":
      return (
        <DashboardWidget
          key={id}
          id={id}
          title="Revenue Progress"
          subtitle={data.revenueGoalMode === "MANUAL"
            ? "Custom goal target"
            : (data.revenueProgressSource === "YTD_DONATIONS"
              ? "Org YTD raised"
              : "Active campaign raised")}
          {...editProps}
        >
          <RevenueProgress
            current={data.revenueProgressSource === "ACTIVE_CAMPAIGNS"
              ? (data.summary?.activeCampaignRaisedAmount ?? 0)
              : (data.summary?.ytdAmount ?? 0)}
            goal={data.revenueGoal}
            grantAmount={data.summary?.ytdGrantAmount ?? 0}
            includeGrants={data.includeGrants}
            onToggleGrants={data.onToggleGrants}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "goal-health":
      return (
        <DashboardWidget key={id} id={id} title="Campaign Goal Health" subtitle="Attainment and gap analysis" {...editProps}>
          <CampaignGoalHealthWidget
            activeCampaigns={data.summary?.activeCampaigns ?? 0}
            activeGoalTotal={data.summary?.activeGoalTotal ?? 0}
            raisedAmount={data.summary?.activeCampaignRaisedAmount ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "donation-velocity":
      return (
        <DashboardWidget key={id} id={id} title="Donation Velocity" subtitle="Gift speed and average size trend" {...editProps}>
          <DonationVelocityWidget
            weekAmount={data.summary?.weekAmount ?? 0}
            weekCount={data.summary?.weekCount ?? 0}
            monthAmount={data.summary?.monthAmount ?? 0}
            monthCount={data.summary?.monthCount ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "fundraising-forecast":
      return (
        <DashboardWidget key={id} id={id} title="Fundraising Forecast" subtitle="Projected year-end pace" {...editProps}>
          <FundraisingForecastWidget
            ytdAmount={data.summary?.ytdAmount ?? 0}
            monthAmount={data.summary?.monthAmount ?? 0}
            revenueGoal={data.revenueGoal}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "retention":
      return (
        <DashboardWidget key={id} id={id} title="Donor Retention" subtitle="Year-over-year" {...editProps}>
          <DonorRetention
            retained={data.retention?.retained ?? 0}
            total={data.retention?.total ?? 0}
            rate={data.retention?.rate}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "engagement-pulse":
      return (
        <DashboardWidget key={id} id={id} title="Engagement Pulse" subtitle="Stewardship queue health" {...editProps}>
          <EngagementPulseWidget
            pendingTasks={data.summary?.pendingTasks ?? 0}
            overdueTasks={data.summary?.overdueTasks ?? 0}
            newDonorsThisMonth={data.summary?.newDonorsThisMonth ?? 0}
            monthDonationCount={data.summary?.monthCount ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "stewardship-attention":
      return (
        <DashboardWidget key={id} id={id} title="Stewardship Attention" subtitle="Unthanked, lapsed, and welcome follow-up" {...editProps}>
          <StewardshipAttentionWidget newDonorsThisMonth={data.summary?.newDonorsThisMonth ?? 0} loading={data.loading} />
        </DashboardWidget>
      );
    case "workflow-pressure":
      return (
        <DashboardWidget key={id} id={id} title="Workflow Pressure" subtitle="Queue urgency and follow-up load" {...editProps}>
          <WorkflowPressureWidget
            pendingTasks={data.summary?.pendingTasks ?? 0}
            overdueTasks={data.summary?.overdueTasks ?? 0}
            newDonorsThisMonth={data.summary?.newDonorsThisMonth ?? 0}
            retentionRate={data.retention?.rate ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "follow-up-capacity":
      return (
        <DashboardWidget key={id} id={id} title="Follow-Up Capacity" subtitle="Demand vs team throughput" {...editProps}>
          <FollowUpCapacityWidget
            pendingTasks={data.summary?.pendingTasks ?? 0}
            overdueTasks={data.summary?.overdueTasks ?? 0}
            newDonorsThisMonth={data.summary?.newDonorsThisMonth ?? 0}
            monthCount={data.summary?.monthCount ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    case "top-donors":
      return (
        <DashboardWidget key={id} id={id} title="Top Donors" subtitle="By lifetime giving" {...editProps}>
          <TopDonorsWidget />
        </DashboardWidget>
      );
    case "tasks":
      return (
        <DashboardWidget key={id} id={id} title="Tasks" subtitle="Open & upcoming" {...editProps}>
          <TasksWidget />
        </DashboardWidget>
      );
    case "meetings":
      return (
        <DashboardWidget key={id} id={id} title="Upcoming Meetings" subtitle="Scheduled donor meetings" {...editProps}>
          <MeetingsWidget />
        </DashboardWidget>
      );
    case "weekly-stats":
      return (
        <DashboardWidget key={id} id={id} title="This Week" subtitle="Donation activity" {...editProps}>
          <TotalsByLevel
            weekTotal={data.summary?.weekAmount ?? 0}
            transactions={data.summary?.weekCount ?? 0}
            avgTransaction={data.summary?.weekAvg ?? 0}
            loading={data.loading}
          />
        </DashboardWidget>
      );
    default:
      return null;
  }
}