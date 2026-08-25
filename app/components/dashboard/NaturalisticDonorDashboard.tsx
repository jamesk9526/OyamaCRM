/**
 * Donor dashboard rendered in the enterprise nonprofit reference layout.
 * Keeps data fully live from dashboard services while matching the target visual structure.
 */
"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Gift,
  HeartHandshake,
  MailPlus,
  Megaphone,
  RefreshCcw,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DonorDashboardOverviewSections, type DashboardAttentionItem } from "./DonorDashboardOverviewSections";
import { DashboardStatusPill } from "./shared/DashboardPrimitives";
import { DASHBOARD_APPEARANCE_DEFAULTS, DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { loadDonorDashboardData } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import type { CampaignImpact, DashboardData, DonationPreview, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import CRMQuickActionCard from "@/app/components/ui/crm/CRMQuickActionCard";
import DashboardHeaderPulse from "./DashboardHeaderPulse";

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

function BriefMetric({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-white">
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-600" aria-hidden="true" />
      </span>
      <span className="mt-1 block text-lg font-semibold tracking-tight text-slate-900">{value}</span>
    </Link>
  );
}

export default function NaturalisticDonorDashboard({
  greeting,
  name,
  loading: summaryLoading,
  summary,
  retention,
  revenueGoal,
  dataThroughLabel,
  reportingYearMode,
  headerActions,
  extraSections,
  onRefresh,
}: NaturalisticDonorDashboardProps) {
  const [appearance, setAppearance] = useState(DASHBOARD_APPEARANCE_DEFAULTS);
  const [donations, setDonations] = useState<DonationPreview[]>([]);
  const [pendingAcknowledgmentCount, setPendingAcknowledgmentCount] = useState(0);
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

  const quickActionIcon = (id: string) => {
    if (id === "record-gift") return <Gift className="h-4 w-4" aria-hidden="true" />;
    if (id === "view-reports") return <TrendingUp className="h-4 w-4" aria-hidden="true" />;
    if (id === "open-tasks") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
    if (id === "add-donor") return <UserPlus className="h-4 w-4" aria-hidden="true" />;
    if (id === "new-email") return <MailPlus className="h-4 w-4" aria-hidden="true" />;
    return <FileText className="h-4 w-4" aria-hidden="true" />;
  };

  const reportingPeriodLabel = reportingYearMode.toLowerCase() === "fiscal" ? "Fiscal-year view" : "Calendar-year view";

  return (
    <div className="crm-fonts crm-page-surface min-h-screen min-w-0">
      <div className="mx-auto min-w-0 max-w-[1600px] px-4 pb-10 pt-4 sm:px-6 xl:px-8">
        {sectionErrors.length > 0 ? (
          <div className="crm-card-surface mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{sectionErrors.slice(0, 2).join(" ")}</span>
          </div>
        ) : null}

        <CRMPageHeader
          breadcrumb={(
            <>
              <span>Donor CRM</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="font-medium text-slate-700">Overview</span>
            </>
          )}
          title="Dashboard"
          description="Your live operating view for donor relationships, fundraising performance, and follow-up."
          status={<DashboardStatusPill><Activity className="h-3 w-3" aria-hidden="true" /> Live data · {dataThroughLabel}</DashboardStatusPill>}
          secondaryActions={(
            <>
              <Link href="/reports" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Reports
              </Link>
              <button
                type="button"
                onClick={() => {
                  void loadRichData();
                  void onRefresh?.();
                }}
                disabled={richLoading || summaryLoading}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${richLoading || summaryLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                {richLoading || summaryLoading ? "Refreshing" : "Refresh"}
              </button>
            </>
          )}
          primaryAction={headerActions}
          className="mb-4"
        />

        <section className="mb-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.95fr)]">
          <CRMCard padding="lg" className="flex min-w-0 flex-col justify-between bg-gradient-to-br from-white via-white to-slate-50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                  <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
                  Donor operations
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">{greeting}, {firstName}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Start with the highest-signal work, then arrange the live metrics below around the way your team works. Every value is connected to the donor ledger.</p>
              </div>
              <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Last refreshed</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{dataThroughLabel}</p>
              </div>
            </div>
            <DashboardHeaderPulse summary={summary} retention={retention} revenueGoal={revenueGoal} />
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <BriefMetric label="Donors in scope" value={totalDonorsValue} href="/constituents" />
              <BriefMetric label="Open tasks" value={(summary?.pendingTasks ?? 0).toLocaleString()} href="/tasks" />
              <BriefMetric label="Active campaigns" value={activeCampaignCount.toLocaleString()} href="/campaigns" />
              <BriefMetric label="Gifts awaiting thanks" value={unackedCount.toLocaleString()} href="/donations?acknowledgment=pending" />
            </div>
          </CRMCard>

          <CRMCard padding="lg" className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Attention queue</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">What needs action</h2>
              </div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-amber-50 px-2 text-sm font-bold text-amber-700 ring-1 ring-amber-100">{visibleAttentionItems.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {visibleAttentionItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-xs font-medium text-emerald-800">No current dashboard alerts.</p>
                </div>
              ) : visibleAttentionItems.slice(0, 3).map((item) => (
                <Link key={item.id} href={item.href} className="group flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.tone === "rose" ? "bg-rose-50 text-rose-600" : item.tone === "amber" ? "bg-amber-50 text-amber-600" : item.tone === "orange" ? "bg-orange-50 text-orange-600" : "bg-violet-50 text-violet-600"}`}>
                      {item.id === "overdue" ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Activity className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{item.label}</span><span className="block truncate text-[11px] text-slate-500">{item.sub}</span></span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-slate-900"><span>{item.count}</span><ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-700" aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
            <Link href="/steward-signals" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open stewardship workspace <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </CRMCard>
        </section>

        <section className="mb-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <CRMCard padding="lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workflow priorities</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Today&apos;s focus</h2>
                <p className="mt-1 text-xs text-slate-500">High-signal follow-up items and live donor pressure points.</p>
              </div>
              <Link href="/steward-signals" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {focusItems.map((item) => (
                <Link key={item.id} href={item.href} className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/55 px-3 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone === "indigo" ? "bg-sky-50 text-sky-700" : item.tone === "amber" ? "bg-amber-50 text-amber-700" : item.tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>
                    {item.id === "follow-up" ? <UserPlus className="h-4 w-4" aria-hidden="true" /> : item.id === "receipts" ? <Gift className="h-4 w-4" aria-hidden="true" /> : item.id === "campaigns" ? <Target className="h-4 w-4" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-800">{item.label}</span><span className="block truncate text-[11px] text-slate-500">{item.sub}</span></span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-600" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </CRMCard>

          <CRMCard padding="lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Common workflows</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Quick actions</h2>
              </div>
              <Megaphone className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Dashboard quick actions">
              {quickActions.map((action) => (
                <CRMQuickActionCard key={action.id} href={action.href} title={action.label} icon={quickActionIcon(action.id)} />
              ))}
            </div>
          </CRMCard>
        </section>

        <section className="mb-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Performance snapshot</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Core metrics</h2>
            </div>
            <DashboardStatusPill>{reportingPeriodLabel}</DashboardStatusPill>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <CRMMetricCard label="Total Donors" value={totalDonorsValue} tone="green" icon={<Users className="h-4 w-4" aria-hidden="true" />} helper={`${summary?.activeDonors?.toLocaleString() ?? "—"} active records`} loading={summaryLoading} />
            <CRMMetricCard label="Gifts This Month" value={monthGivingValue} tone="blue" icon={<Gift className="h-4 w-4" aria-hidden="true" />} helper={summary?.momTrend != null ? `${summary.momTrend >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(summary.momTrend))}% vs last month` : "Month-to-date giving"} loading={summaryLoading} />
            <CRMMetricCard label="New Donors" value={newDonorsValue} tone="purple" icon={<UserPlus className="h-4 w-4" aria-hidden="true" />} helper="Added this month" loading={summaryLoading} />
            <CRMMetricCard label="Active Campaigns" value={activeCampaignCount.toLocaleString()} tone="orange" icon={<Target className="h-4 w-4" aria-hidden="true" />} helper="Currently running" loading={summaryLoading} />
            <CRMMetricCard label="Retention Rate" value={retention ? `${Math.round(retention.rate)}%` : "—"} tone="slate" icon={<HeartHandshake className="h-4 w-4" aria-hidden="true" />} helper="Open donor reporting" loading={!retention && summaryLoading} />
          </div>
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
