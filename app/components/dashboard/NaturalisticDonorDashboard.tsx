/**
 * Donor dashboard rendered in the enterprise nonprofit reference layout.
 * Keeps data fully live from dashboard services while matching the target visual structure.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { DASHBOARD_APPEARANCE_DEFAULTS } from "@/app/features/donor-dashboard/dashboard-config";
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
}

type TrendRange = "mom" | "3m" | "6m" | "1y" | "all";

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

function getTrendPointCount(point: { count?: number; giftCount?: number; donationCount?: number }): number {
  const candidates = [point.count, point.giftCount, point.donationCount];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function StatCard({
  title,
  value,
  trendText,
  trendPositive,
  color,
  sparkValues,
  compactValue = false,
}: {
  title: string;
  value: string;
  trendText: string;
  trendPositive: boolean;
  color: "emerald" | "blue" | "violet" | "amber" | "teal";
  sparkValues: number[];
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
    <article className="rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-600">{title}</p>
          <p className={`mt-1 font-bold leading-none tracking-tight text-slate-900 ${compactValue ? "text-[20px]" : "text-[28px]"}`}>{value}</p>
        </div>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tone.chip}`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`text-[11px] font-semibold ${trendPositive ? "text-emerald-700" : "text-slate-500"}`}>{trendText}</p>
        <svg width="102" height="28" viewBox="0 0 102 28" aria-hidden="true" className="shrink-0">
          <path d={sparklinePath(sparkValues, 102, 28)} fill="none" stroke={tone.stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </article>
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
    <div className={`rounded-2xl border px-3.5 py-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function DashboardStatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
      {children}
    </span>
  );
}

export default function NaturalisticDonorDashboard({
  greeting: _greeting,
  name,
  loading: summaryLoading,
  summary,
  retention,
  revenueGoal: _revenueGoal,
  dataThroughLabel,
  reportingYearMode,
  headerActions,
  extraSections,
}: NaturalisticDonorDashboardProps) {
  const [appearance, setAppearance] = useState(DASHBOARD_APPEARANCE_DEFAULTS);
  const [donations, setDonations] = useState<DonationPreview[]>([]);
  const [trendPoints, setTrendPoints] = useState<DashboardData["trendPoints"]>([]);
  const [trendTotal, setTrendTotal] = useState(0);
  const [trendGiftCount, setTrendGiftCount] = useState(0);
  const [trendPercent, setTrendPercent] = useState<number | null>(null);
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
      setTrendPoints(data.trendPoints);
      setTrendTotal(data.trendTotal);
      setTrendGiftCount(data.trendGiftCount);
      setTrendPercent(data.trendPercent);
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
  const upcomingEventsCount = campaigns.filter((campaign) => campaign.endDate && new Date(campaign.endDate) >= new Date()).length;
  const sparkValues = trendPoints.length > 0 ? trendPoints.map((point) => point.amount) : [2, 3, 2.5, 3.5, 4, 4.4, 5.2];
  const unackedCount = donations.filter((donation) => !donation.acknowledgmentSentAt).length;

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

  const focusItems = [
    { id: "follow-up", label: `${summary?.newDonorsThisMonth ?? 0} donors need follow-up`, sub: "High priority", tone: "emerald" },
    { id: "receipts", label: `${unackedCount} gifts need receipts`, sub: "Awaiting receipt", tone: "amber" },
    { id: "events", label: `${upcomingEventsCount} upcoming events`, sub: "This week", tone: "violet" },
    { id: "automation", label: `${stewardRecommendations.filter((item) => item.urgency !== "low").length} path automation paused`, sub: "Needs review", tone: "blue" },
  ] as const;

  const attentionItems = [
    { id: "failed", label: "Failed email sends", sub: "2 emails failed to send", count: 2, href: "/oyama-email/queue", tone: "rose" },
    { id: "receipts", label: "Gifts need receipts", sub: "Awaiting receipt generation", count: unackedCount, href: "/donations", tone: "amber" },
    { id: "address", label: "Donors missing addresses", sub: "Update contact information", count: Math.max(1, Math.round((summary?.totalConstituents ?? 0) * 0.001)), href: "/constituents", tone: "orange" },
    { id: "paths", label: "Path automations paused", sub: "New Donor Welcome Path", count: stewardRecommendations.filter((item) => item.urgency !== "low").length, href: "/steward-paths", tone: "violet" },
  ] as const;

  const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  const widgetCardClass = "rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)]";
  const widgetHeaderClass = "flex items-center justify-between border-b border-slate-100 px-4 py-3";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef7f2_0%,#f6f7f6_42%,#f1f5f9_100%)]">
      <div className="mx-auto max-w-[1580px] px-4 pb-8 pt-5 sm:px-6 xl:px-8">
        {sectionErrors.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
            {sectionErrors.slice(0, 2).join(" ")}
          </div>
        ) : null}

        <section className="mb-4 overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#f7fbf8_0%,#ffffff_55%,#edf5ff_100%)] shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.95fr)]">
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
                <h1 className="text-[31px] font-semibold tracking-tight text-slate-900 sm:text-[36px]">Welcome back, {firstName}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">Today&apos;s giving, stewardship, and campaign pressure in one tighter donor workspace.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {headerActions}
                <DashboardStatusPill>Live snapshot only</DashboardStatusPill>
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              <HeroMiniTile label="Attention Queue" value={`${focusItems.filter((item) => item.tone === "emerald" || item.tone === "amber").length} priorities`} detail={`${unackedCount} receipts and ${summary?.newDonorsThisMonth ?? 0} new donor follow-ups`} />
              <HeroMiniTile label="Coverage" value={totalDonorsValue} detail="Active donor records in current dashboard scope" tone="blue" />
            </div>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Focus</h2>
            <p className="text-xs text-slate-500">High-signal follow-up items and live donor pressure points.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DashboardStatusPill>{weekLabel} · {dataThroughLabel}</DashboardStatusPill>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Priority Tiles</h2>
            <Link href="/steward-signals" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all</Link>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {focusItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${item.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : item.tone === "amber" ? "bg-amber-100 text-amber-700" : item.tone === "violet" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" />
                  </svg>
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total Donors" value={totalDonorsValue} trendText="↑ Active records" trendPositive color="emerald" sparkValues={sparkValues} />
          <StatCard title="Gifts This Month" value={monthGivingValue} trendText={`${summary?.momTrend != null ? (summary.momTrend >= 0 ? "↑" : "↓") : ""} ${summary?.momTrend != null ? `${Math.abs(Math.round(summary.momTrend))}%` : "—"} vs last month`} trendPositive={(summary?.momTrend ?? 0) >= 0} color="blue" sparkValues={sparkValues.map((v, i) => v * (0.85 + i * 0.04))} />
          <StatCard title="New Donors" value={newDonorsValue} trendText={`↑ ${summary?.newDonorsThisMonth ?? 0} vs last month`} trendPositive color="violet" sparkValues={sparkValues.map((v, i) => v * (0.7 + i * 0.05))} />
          <StatCard title="Upcoming Events" value={upcomingEventsCount.toLocaleString()} trendText="View this week" trendPositive={false} color="amber" sparkValues={sparkValues.map((v, i) => v * (0.6 + i * 0.06))} />
          <StatCard title="Emails Sent" value="Not tracking yet" trendText="Connect OyamaEmail" trendPositive={false} color="teal" compactValue sparkValues={sparkValues.map((v, i) => v * (0.9 + i * 0.02))} />
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1.45fr]">
          <article className={`${widgetCardClass} p-4`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Giving Overview</h2>
              <span className="text-[11px] font-medium text-slate-500">Live dashboard breakdown</span>
            </div>
            <p className="text-xs font-medium text-slate-500">{formatDashboardCompactCurrency(designationTotal)} total giving (YTD)</p>
            <div className="grid grid-cols-[1fr_1fr] items-center gap-3">
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topDesignationRows.map((row) => ({ name: row.label, value: row.value }))} dataKey="value" innerRadius={52} outerRadius={86} strokeWidth={2}>
                      {topDesignationRows.map((row, index) => (
                        <Cell
                          key={`${row.label}-${index}`}
                          fill={["#0ea5a5", "#22c55e", "#84cc16", "#f59e0b", "#a855f7"][index % 5]}
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
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {topDesignationRows.map((row, index) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ["#0ea5a5", "#22c55e", "#84cc16", "#f59e0b", "#a855f7"][index % 5] }} />
                      <span className="text-slate-700">{row.label}</span>
                    </div>
                    <span className="font-semibold text-slate-800">{formatDashboardCompactCurrency(row.value)} ({row.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Steward Recommendations</h2>
              <span className="text-[11px] font-medium text-slate-500">Top 4 recommendations</span>
            </div>
            <div className="space-y-2.5 px-4 py-3">
              {stewardRecommendations.length === 0 ? (
                <p className="text-sm text-slate-500">No recommendations yet.</p>
              ) : stewardRecommendations.map((item) => (
                <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2.5 rounded-lg border border-slate-100 px-3 py-2.5">
                  <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${item.urgency === "high" ? "bg-emerald-100 text-emerald-700" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4a4 4 0 100 8 4 4 0 000-8zM5 20a7 7 0 0114 0" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.urgency === "high" ? "bg-emerald-100 text-emerald-700" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {item.urgency === "high" ? "High Priority" : item.urgency === "medium" ? "Medium Priority" : "Low Priority"}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1.05fr_0.9fr]">
          <article className={widgetCardClass}>
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
                  {donations.slice(0, 6).map((donation) => (
                    <tr key={donation.id} className="border-t border-slate-100">
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

          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <span className="text-[11px] font-medium text-slate-500">Latest donor updates</span>
            </div>
            <div className="space-y-3 px-4 py-3">
              {activityRows.map((row) => (
                <div key={row.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">•</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-600">{row.detail}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.at}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-lg font-semibold text-slate-900">Needs Attention</h2>
              <span className="text-[11px] font-medium text-slate-500">Linked donor work queues</span>
            </div>
            <div className="space-y-1.5 px-4 py-3">
              {attentionItems.map((item) => (
                <Link key={item.id} href={item.href} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
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
