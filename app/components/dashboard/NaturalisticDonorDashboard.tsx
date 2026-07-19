/**
 * Donor dashboard rendered in the enterprise nonprofit reference layout.
 * Keeps data fully live from dashboard services while matching the target visual structure.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ReactNode } from "react";
import { DASHBOARD_APPEARANCE_DEFAULTS, DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import { formatDashboardCompactCurrency, formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
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

function formatRelativeTime(dateValue: string): string {
  const date = new Date(dateValue);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatPanelDate(dateValue: string): string {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatPanelTime(dateValue: string): string {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function sparklinePath(values: number[], width = 102, height = 28): string {
  if (values.length <= 1) return `M0 ${height - 3} L${width} ${height - 3}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * (height - 5) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function StatCard({
  title,
  value,
  trendText,
  trendPositive,
  color,
  sparkValues,
  href,
  compactValue = false,
}: {
  title: string;
  value: string;
  trendText: string;
  trendPositive: boolean;
  color: "emerald" | "blue" | "violet" | "amber" | "teal";
  sparkValues: number[];
  href: string;
  compactValue?: boolean;
}) {
  const tone = color === "emerald"
    ? { chip: "bg-emerald-100 text-emerald-700", stroke: "#16a34a" }
    : color === "blue"
      ? { chip: "bg-blue-100 text-blue-700", stroke: "#3b82f6" }
      : color === "violet"
        ? { chip: "bg-violet-100 text-violet-700", stroke: "#a855f7" }
        : color === "amber"
          ? { chip: "bg-amber-100 text-amber-700", stroke: "#d97706" }
          : { chip: "bg-teal-100 text-teal-700", stroke: "#14b8a6" };

  const icon = color === "emerald"
    ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    : color === "blue"
      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
      : color === "violet"
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" />
        : color === "amber"
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5v4M16 3.5v4M4.5 9h15M5.5 6.5h13a1 1 0 011 1v11a2 2 0 01-2 2h-11a2 2 0 01-2-2v-11a1 1 0 011-1z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 6.75h17a1.75 1.75 0 011.75 1.75v7a1.75 1.75 0 01-1.75 1.75h-17A1.75 1.75 0 011.75 15.5v-7A1.75 1.75 0 013.5 6.75zm.25 1.25 8.25 6 8.25-6" />;

  return (
    <Link href={href} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
    <article className="relative h-full overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition duration-300 group-hover:-translate-y-0.5 group-hover:border-emerald-200/80 group-hover:shadow-[0_16px_38px_rgba(15,23,42,0.1)]">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-70" style={{ color: tone.stroke }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-600">{title}</p>
          <p className={`mt-1 font-bold leading-none tracking-tight text-slate-900 ${compactValue ? "text-[20px]" : "text-[28px]"}`}>{value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-transform duration-300 group-hover:scale-105 ${tone.chip}`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`text-[11px] font-semibold ${trendPositive ? "text-emerald-700" : "text-slate-500"}`}>{trendText}</p>
        {sparkValues.length > 1 ? (
          <svg width="102" height="28" viewBox="0 0 102 28" aria-hidden="true" className="shrink-0">
            <defs><linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={tone.stroke} stopOpacity="0.24" /><stop offset="100%" stopColor={tone.stroke} stopOpacity="0" /></linearGradient></defs>
            <path d={`${sparklinePath(sparkValues, 102, 28)} L102 28 L0 28 Z`} fill={`url(#spark-${color})`} stroke="none" />
            <path d={sparklinePath(sparkValues, 102, 28)} fill="none" stroke={tone.stroke} strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : <span className="text-[10px] font-medium text-slate-400">Open details</span>}
      </div>
    </article>
    </Link>
  );
}

function HeroMiniTile({
  label,
  value,
  detail,
  tone = "emerald",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "emerald" | "blue";
}) {
  const toneClass = tone === "blue"
    ? "border-blue-200 bg-blue-50/80"
    : "border-emerald-200 bg-white/90";

  return (
    <div className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ${toneClass}`}>
      <span className={`absolute -right-6 -top-7 h-20 w-20 rounded-full blur-2xl ${tone === "blue" ? "bg-blue-300/35" : "bg-emerald-300/35"}`} aria-hidden="true" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function DashboardStatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-md">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" aria-hidden="true" />
      {children}
    </span>
  );
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

  const topDesignationRows = useMemo(() => {
    const total = designationSlices.reduce((sum, slice) => sum + slice.amount, 0);
    return designationSlices.slice(0, 5).map((slice) => ({
      label: slice.name,
      value: slice.amount,
      pct: total > 0 ? Math.round((slice.amount / total) * 100) : 0,
    }));
  }, [designationSlices]);

  const activityRows = useMemo(() => {
    const rows = donations.slice(0, 5).map((donation) => ({
      id: donation.id,
      title: "Gift received",
      detail: `${donation.constituent?.firstName ?? "Donor"} ${donation.constituent?.lastName ?? ""} gave ${formatDashboardCurrency(toDashboardNumber(donation.amount))}`,
      at: formatRelativeTime(donation.date),
    }));
    if (summary && summary.newDonorsThisMonth > 0) {
      rows.unshift({
        id: "new-donors",
        title: "New donor activity",
        detail: `${summary.newDonorsThisMonth.toLocaleString()} new donor${summary.newDonorsThisMonth === 1 ? "" : "s"} added this month`,
        at: "this month",
      });
    }
    return rows.slice(0, 5);
  }, [donations, summary]);

  const stewardRecommendations = suggestions.slice(0, 4);

  const highPriorityRecommendationCount = stewardRecommendations.filter((item) => item.urgency === "high").length;
  const focusItems = [
    { id: "follow-up", label: `${summary?.newDonorsThisMonth ?? 0} new donors`, sub: "Review welcome follow-up", tone: "emerald", href: "/constituents" },
    { id: "receipts", label: `${unackedCount} gifts unacknowledged`, sub: "Review acknowledgment queue", tone: "amber", href: "/donations?acknowledgment=pending" },
    { id: "campaigns", label: `${activeCampaignCount} active campaigns`, sub: "Review fundraising pace", tone: "violet", href: "/campaigns" },
    { id: "recommendations", label: `${highPriorityRecommendationCount} high-priority signals`, sub: "Review steward recommendations", tone: "blue", href: "/steward-signals" },
  ] as const;

  const attentionItems = [
    { id: "overdue", label: "Overdue donor tasks", sub: "Work due or overdue follow-ups", count: summary?.overdueTasks ?? 0, href: "/tasks", tone: "rose" },
    { id: "receipts", label: "Unacknowledged gifts", sub: "Review acknowledgment status", count: unackedCount, href: "/donations?acknowledgment=pending", tone: "amber" },
    { id: "signals", label: "High-priority signals", sub: "Steward recommendations requiring review", count: highPriorityRecommendationCount, href: "/steward-signals", tone: "orange" },
    { id: "tasks", label: "Open donor tasks", sub: "Current stewardship work queue", count: summary?.pendingTasks ?? 0, href: "/tasks", tone: "violet" },
  ] as const;
  const visibleAttentionItems = attentionItems.filter((item) => item.count > 0);

  const quickActions = [
    ...appearance.primaryActions.map((id) => ({ id, ...DASHBOARD_HERO_ACTIONS[id] })),
    { id: "add-donor", label: "Add Donor", href: "/constituents/new" },
    { id: "new-email", label: "Create Email", href: "/oyama-email/templates/new" },
    { id: "new-letter", label: "Create Letter", href: "/oyama-letters/templates/new" },
  ];

  const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  const widgetCardClass = "overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_14px_38px_rgba(15,23,42,0.075),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl";
  const widgetHeaderClass = "flex items-center justify-between border-b border-slate-100/90 bg-gradient-to-r from-white via-white to-slate-50/70 px-5 py-3.5";

  const reportingPeriodLabel = reportingYearMode === "FISCAL" ? "Fiscal-year view" : "Calendar-year view";

  return (
    <div className="min-h-screen min-w-0 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.09),transparent_26%),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.07),transparent_22%),linear-gradient(180deg,#f4f8f6_0%,#f8faf9_34%,#f1f5f4_100%)]">
      <div className="mx-auto min-w-0 max-w-[1580px] px-3 pb-8 pt-4 sm:px-5 xl:px-7">
        {sectionErrors.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
            {sectionErrors.slice(0, 2).join(" ")}
          </div>
        ) : null}

        <section className="relative mb-5 overflow-hidden rounded-[26px] border border-emerald-900/10 bg-[linear-gradient(135deg,rgba(248,252,249,0.97)_0%,rgba(255,255,255,0.96)_55%,rgba(238,248,244,0.96)_100%)] shadow-[0_20px_55px_rgba(15,23,42,0.09),inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-blue-300/15 blur-3xl" aria-hidden="true" />
          <div className="relative grid min-w-0 gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.95fr)] sm:px-6 sm:py-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                  Donor Command Center
                </span>
                <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
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
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200/90 bg-white/85 px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 disabled:translate-y-0 disabled:opacity-60"
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
                      ? "inline-flex min-h-10 items-center rounded-xl bg-[linear-gradient(135deg,#047857,#059669)] px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(5,150,105,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(5,150,105,0.28)]"
                      : "inline-flex min-h-10 items-center rounded-xl border border-slate-200/90 bg-white/85 px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"}
                  >
                    {action.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              <HeroMiniTile label="Attention Queue" value={`${visibleAttentionItems.length} active`} detail={visibleAttentionItems.length > 0 ? `${unackedCount} unacknowledged gifts and ${summary?.overdueTasks ?? 0} overdue tasks` : "No current dashboard alerts"} />
              <HeroMiniTile label="Coverage" value={totalDonorsValue} detail="Active donor records in current dashboard scope" tone="blue" />
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

        <section className="mb-5 rounded-2xl border border-white/80 bg-white/85 px-4 py-3.5 shadow-[0_12px_32px_rgba(15,23,42,0.065)] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Priority Tiles</h2>
            <Link href="/steward-signals" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all</Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {focusItems.map((item) => (
              <Link key={item.id} href={item.href} className="group flex items-center gap-3 rounded-xl border border-slate-100/90 bg-gradient-to-br from-white to-slate-50/60 px-3 py-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-transform group-hover:scale-105 ${item.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : item.tone === "amber" ? "bg-amber-100 text-amber-700" : item.tone === "violet" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
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
          <StatCard title="Total Donors" value={totalDonorsValue} trendText="Open donor records" trendPositive color="emerald" sparkValues={[]} href="/constituents" />
          <StatCard title="Gifts This Month" value={monthGivingValue} trendText={`${summary?.momTrend != null ? (summary.momTrend >= 0 ? "↑" : "↓") : ""} ${summary?.momTrend != null ? `${Math.abs(Math.round(summary.momTrend))}%` : "No comparison"} vs last month`} trendPositive={(summary?.momTrend ?? 0) >= 0} color="blue" sparkValues={sparkValues} href="/donations" />
          <StatCard title="New Donors" value={newDonorsValue} trendText="Review welcome follow-up" trendPositive color="violet" sparkValues={[]} href="/constituents" />
          <StatCard title="Active Campaigns" value={activeCampaignCount.toLocaleString()} trendText="Review fundraising work" trendPositive={false} color="amber" sparkValues={[]} href="/campaigns" />
          <StatCard title="Retention Rate" value={retention ? `${Math.round(retention.rate)}%` : "—"} trendText="Open donor reporting" trendPositive={(retention?.rate ?? 0) >= 50} color="teal" compactValue sparkValues={[]} href="/reports" />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1.45fr]">
          <article className={`${widgetCardClass} min-w-0 p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Giving Overview</h2>
              <span className="text-[11px] font-medium text-slate-500">Live dashboard breakdown</span>
            </div>
            <p className="text-xs font-medium text-slate-500">{formatDashboardCompactCurrency(designationTotal)} total giving (YTD)</p>
            <div className="grid min-w-0 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="relative h-[200px] min-w-0 sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topDesignationRows.map((row) => ({ name: row.label, value: row.value }))} dataKey="value" innerRadius={58} outerRadius={92} paddingAngle={3} cornerRadius={7} stroke="#ffffff" strokeWidth={3}>
                      {topDesignationRows.map((row, index) => (
                        <Cell
                          key={`${row.label}-${index}`}
                          fill={["#0f766e", "#10b981", "#60a5fa", "#f59e0b", "#8b5cf6"][index % 5]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => {
                        const scalar = Array.isArray(value) ? value[0] : value;
                        const normalized = typeof scalar === "number" || typeof scalar === "string"
                          ? scalar
                          : undefined;
                        return formatDashboardCurrency(toDashboardNumber(normalized));
                      }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,.12)", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Giving</span>
                  <span className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{formatDashboardCompactCurrency(designationTotal)}</span>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                {topDesignationRows.map((row, index) => (
                  <div key={row.label} className="text-xs">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_rgba(148,163,184,0.12)]" style={{ background: ["#0f766e", "#10b981", "#60a5fa", "#f59e0b", "#8b5cf6"][index % 5] }} />
                        <span className="truncate font-medium text-slate-700">{row.label}</span>
                      </div>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-slate-800">{formatDashboardCompactCurrency(row.value)} <span className="font-medium text-slate-400">{row.pct}%</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${row.pct}%`, background: ["#0f766e", "#10b981", "#60a5fa", "#f59e0b", "#8b5cf6"][index % 5] }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={`${widgetCardClass} min-w-0`}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Steward Recommendations</h2>
              <span className="text-[11px] font-medium text-slate-500">Top 4 recommendations</span>
            </div>
            <div className="space-y-2.5 px-4 py-3">
              {stewardRecommendations.length === 0 ? (
                <p className="text-sm text-slate-500">No recommendations yet.</p>
              ) : stewardRecommendations.map((item) => (
                <div key={item.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-3 py-3 transition hover:border-emerald-200 hover:shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${item.urgency === "high" ? "bg-emerald-100 text-emerald-700" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <span className={`col-start-2 justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold sm:col-auto sm:justify-self-auto ${item.urgency === "high" ? "bg-emerald-100 text-emerald-700" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {item.urgency === "high" ? "High Priority" : item.urgency === "medium" ? "Medium Priority" : "Low Priority"}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-3 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1.05fr_0.9fr]">
          <article className={`${widgetCardClass} min-w-0`}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Recent Gifts</h2>
              <Link href="/donations" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open donation ledger</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Donor</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Fund</th>
                    <th className="px-4 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No recent gifts are available for this dashboard period.</td></tr>
                  ) : donations.slice(0, 6).map((donation) => (
                    <tr key={donation.id} className="border-t border-slate-100 transition-colors hover:bg-emerald-50/45">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-800">{donation.constituent?.firstName ?? "Donor"} {donation.constituent?.lastName ?? ""}</p>
                        <p className="text-xs text-slate-500">{donation.campaign?.name ?? "General Giving"}</p>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700">{formatDashboardCurrency(toDashboardNumber(donation.amount))}</td>
                      <td className="px-4 py-2.5 text-slate-600">{donation.designation?.name ?? "General Fund"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{formatPanelDate(donation.date)} · {formatPanelTime(donation.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className={`${widgetCardClass} min-w-0`}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <span className="text-[11px] font-medium text-slate-500">Latest donor updates</span>
            </div>
            <div className="space-y-3 px-4 py-3">
              {activityRows.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No recent donor activity is available.</p> : activityRows.map((row) => (
                <div key={row.id} className="group flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-50">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">•</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-600">{row.detail}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.at}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className={`${widgetCardClass} min-w-0`}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Needs Attention</h2>
              <span className="text-[11px] font-medium text-slate-500">Linked donor work queues</span>
            </div>
            <div className="space-y-1.5 px-4 py-3">
              {visibleAttentionItems.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No dashboard work queues currently need attention.</p> : visibleAttentionItems.map((item) => (
                <Link key={item.id} href={item.href} className="group grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/55 px-3 py-2.5 transition hover:-translate-y-px hover:border-emerald-200 hover:shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-500">{item.sub}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${item.tone === "rose" ? "text-rose-700" : item.tone === "amber" ? "text-amber-700" : item.tone === "orange" ? "text-orange-700" : "text-violet-700"}`}>{item.count}</span>
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
                  </div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        {extraSections}
      </div>
    </div>
  );
}
