/**
 * Donor dashboard rendered in the enterprise nonprofit reference layout.
 * Keeps data fully live from dashboard services while matching the target visual structure.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DonorDashboardOverviewSections, type DashboardAttentionItem } from "./DonorDashboardOverviewSections";
import { DashboardMetricCard, DashboardMiniTile, DashboardStatusPill } from "./shared/DashboardPrimitives";
import { DASHBOARD_APPEARANCE_DEFAULTS, DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { loadDonorDashboardData } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import type { CampaignImpact, DashboardData, DonationPreview, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";

interface NaturalisticDonorDashboardProps {
  greeting: string;
  name: string;
  loading: boolean;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  revenueGoal: number;
  dataThroughLabel: string;
  reportingYearMode: string;
  headerActions?: ReactNode;
  extraSections?: ReactNode;
  onRefresh?: () => void | Promise<void>;
}

export default function NaturalisticDonorDashboard({
  name,
  loading: summaryLoading,
  summary,
  retention,
  dataThroughLabel,
  reportingYearMode,
  headerActions,
  extraSections,
  onRefresh,
}: NaturalisticDonorDashboardProps) {
  const [appearance, setAppearance] = useState(DASHBOARD_APPEARANCE_DEFAULTS);
  const [donations, setDonations] = useState<DonationPreview[]>([]);
  const [pendingAcknowledgmentCount, setPendingAcknowledgmentCount] = useState(0);
  const [trendPoints, setTrendPoints] = useState<DashboardData["trendPoints"]>([]);
  const [designationSlices, setDesignationSlices] = useState<DashboardData["designationSlices"]>([]);
  const [designationTotal, setDesignationTotal] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignImpact[]>([]);
  const [suggestions, setSuggestions] = useState<DashboardData["stewardshipAlerts"]>([]);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [richLoading, setRichLoading] = useState(true);

  const loadRichData = useCallback(async () => {
    setRichLoading(true);
    try {
      const data = await loadDonorDashboardData({ reportingYearMode, summary, retention });
      setAppearance(data.appearance);
      setDonations(data.recentDonations);
      setPendingAcknowledgmentCount(data.pendingAcknowledgmentCount);
      setTrendPoints(data.trendPoints);
      setDesignationSlices(data.designationSlices);
      setDesignationTotal(data.designationTotal);
      setCampaigns(data.campaigns);
      setSuggestions(data.stewardshipAlerts);
      setSectionErrors(data.errors);
    } catch {
      setSectionErrors(["Dashboard data could not be refreshed. Existing empty states remain visible."]);
    } finally {
      setRichLoading(false);
    }
  }, [reportingYearMode, retention, summary]);

  useEffect(() => {
    loadRichData();
  }, [loadRichData]);

  const firstName = (name.split(" ")[0] || name || "there").trim();
  const totalDonorsValue = summary ? summary.totalConstituents.toLocaleString() : "—";
  const monthGivingValue = summary ? formatDashboardCurrency(toDashboardNumber(summary.monthAmount)) : "—";
  const newDonorsValue = summary ? summary.newDonorsThisMonth.toLocaleString() : "—";
  const activeCampaignCount = summary?.activeCampaigns ?? campaigns.filter((campaign) => campaign.active).length;
  const sparkValues = trendPoints.map((point) => point.amount);
  const unackedCount = pendingAcknowledgmentCount;

  const stewardRecommendations = suggestions.slice(0, 4);

  const highPriorityRecommendationCount = stewardRecommendations.filter((item) => item.urgency === "high").length;
  const focusItems = [
    { id: "follow-up", label: `${summary?.newDonorsThisMonth ?? 0} new donors`, sub: "Review welcome follow-up", tone: "indigo", href: "/constituents" },
    { id: "receipts", label: `${unackedCount} gifts unacknowledged`, sub: "Review acknowledgment queue", tone: "amber", href: "/donations?acknowledgment=pending" },
    { id: "campaigns", label: `${activeCampaignCount} active campaigns`, sub: "Review fundraising pace", tone: "violet", href: "/campaigns" },
    { id: "recommendations", label: `${highPriorityRecommendationCount} high-priority signals`, sub: "Review steward recommendations", tone: "blue", href: "/steward-signals" },
  ] as const;

  const attentionItems: DashboardAttentionItem[] = [
    { id: "overdue", label: "Overdue donor tasks", sub: "Work due or overdue follow-ups", count: summary?.overdueTasks ?? 0, href: "/tasks", tone: "rose" },
    { id: "receipts", label: "Unacknowledged gifts", sub: "Review acknowledgment status", count: unackedCount, href: "/donations?acknowledgment=pending", tone: "amber" },
    { id: "signals", label: "High-priority signals", sub: "Steward recommendations requiring review", count: highPriorityRecommendationCount, href: "/steward-signals", tone: "orange" },
    { id: "tasks", label: "Open donor tasks", sub: "Current stewardship work queue", count: summary?.pendingTasks ?? 0, href: "/tasks", tone: "violet" },
  ];
  const visibleAttentionItems = attentionItems.filter((item) => item.count > 0);

  const quickActions = [
    ...appearance.primaryActions.map((id) => ({ id, ...DASHBOARD_HERO_ACTIONS[id] })),
    { id: "add-donor", label: "Add Donor", href: "/constituents/new" },
    { id: "new-email", label: "Create Email", href: "/oyama-email/templates/new" },
    { id: "new-letter", label: "Create Letter", href: "/oyama-letters/templates/new" },
  ];

  const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  const reportingPeriodLabel = reportingYearMode.toLowerCase() === "fiscal" ? "Fiscal-year view" : "Calendar-year view";

  return (
    <div className="min-h-screen min-w-0 bg-[#f5f5f5]">
      <div className="mx-auto min-w-0 max-w-[1580px] px-3 pb-8 pt-4 sm:px-5 xl:px-7">
        {sectionErrors.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
            {sectionErrors.slice(0, 2).join(" ")}
          </div>
        ) : null}

        <section className="relative mb-5 overflow-hidden rounded-[2px] border border-[#d1d1d1] bg-white">
          <div className="relative grid min-w-0 gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.95fr)] sm:px-6 sm:py-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e5e5] pb-3">
                <span className="inline-flex items-center rounded-[2px] bg-[#eff6fc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f548c]">
                  Donor Command Center
                </span>
                <span className="inline-flex items-center rounded-[2px] bg-[#f3f2f1] px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-[#d1d1d1]">
                  {weekLabel} · {dataThroughLabel}
                </span>
              </div>
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 sm:text-[32px]">Welcome back, {firstName}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">Review live donor activity, handle the next stewardship action, or start a common workflow.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {headerActions}
                <button
                  type="button"
                  onClick={() => {
                    void loadRichData();
                    void onRefresh?.();
                  }}
                  disabled={richLoading || summaryLoading}
                  className="inline-flex min-h-9 items-center rounded-[2px] border border-[#c8c6c4] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-[#f3f2f1] disabled:opacity-60"
                >
                  {richLoading || summaryLoading ? "Refreshing..." : "Refresh"}
                </button>
                <DashboardStatusPill>Live snapshot only</DashboardStatusPill>
              </div>
              <nav className="flex flex-wrap gap-2 pt-1" aria-label="Dashboard quick actions">
                {quickActions.map((action, index) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={index === 0
                      ? "inline-flex min-h-9 items-center rounded-[2px] bg-[#0f6cbd] px-3.5 text-xs font-semibold text-white hover:bg-[#115ea3]"
                      : "inline-flex min-h-9 items-center rounded-[2px] border border-[#c8c6c4] bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-[#f3f2f1] hover:text-[#0f548c]"}
                  >
                    {action.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              <DashboardMiniTile label="Attention Queue" value={`${visibleAttentionItems.length} active`} detail={visibleAttentionItems.length > 0 ? `${unackedCount} unacknowledged gifts and ${summary?.overdueTasks ?? 0} overdue tasks` : "No current dashboard alerts"} href="/donations?acknowledgment=pending" />
              <DashboardMiniTile label="Coverage" value={totalDonorsValue} detail="Active donor records in current dashboard scope" highlighted href="/constituents" />
            </div>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Focus</h2>
            <p className="text-xs text-slate-500">High-signal follow-up items and live donor pressure points.</p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <DashboardStatusPill>{reportingPeriodLabel}</DashboardStatusPill>
          </div>
        </div>

        <section className="mb-5 rounded-[2px] border border-[#d1d1d1] bg-white px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Priority Tiles</h2>
            <Link href="/steward-signals" className="text-xs font-semibold text-[#0f6cbd] hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {focusItems.map((item) => (
              <Link key={item.id} href={item.href} className="group flex items-center gap-3 rounded-[2px] border border-[#e5e5e5] bg-white px-3 py-2.5 transition-colors hover:border-[#0f6cbd] hover:bg-[#fafafa]">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[2px] ${item.tone === "indigo" ? "bg-[#eff6fc] text-[#0f6cbd]" : item.tone === "amber" ? "bg-amber-100 text-amber-700" : item.tone === "violet" ? "bg-[#f3f2f1] text-[#424242]" : "bg-[#deecf9] text-[#115ea3]"}`}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" />
                  </svg>
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <DashboardMetricCard title="Total Donors" value={totalDonorsValue} trendText="Open donor records" trendPositive tone="indigo" sparkValues={[]} href="/constituents" />
          <DashboardMetricCard title="Gifts This Month" value={monthGivingValue} trendText={`${summary?.momTrend != null ? (summary.momTrend >= 0 ? "↑" : "↓") : ""} ${summary?.momTrend != null ? `${Math.abs(Math.round(summary.momTrend))}%` : "No comparison"} vs same point last month`} trendPositive={(summary?.momTrend ?? 0) >= 0} tone="blue" sparkValues={sparkValues} href="/donations" />
          <DashboardMetricCard title="New Donors" value={newDonorsValue} trendText="Review welcome follow-up" trendPositive tone="violet" sparkValues={[]} href="/constituents" />
          <DashboardMetricCard title="Active Campaigns" value={activeCampaignCount.toLocaleString()} trendText="Review fundraising work" trendPositive={false} tone="amber" sparkValues={[]} href="/campaigns" />
          <DashboardMetricCard title="Retention Rate" value={retention ? `${Math.round(retention.rate)}%` : "—"} trendText="Open donor reporting" trendPositive={(retention?.rate ?? 0) >= 50} tone="sky" compactValue sparkValues={[]} href="/reports" />
        </section>

        <DonorDashboardOverviewSections
          designationSlices={designationSlices}
          designationTotal={designationTotal}
          suggestions={suggestions}
          donations={donations}
          summary={summary}
          attentionItems={visibleAttentionItems}
        />
        {extraSections}
      </div>
    </div>
  );
}


