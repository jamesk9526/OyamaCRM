/**
 * Donor dashboard rendered in the enterprise nonprofit reference layout.
 * Keeps data fully live from dashboard services while matching the target visual structure.
 */
"use client";

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
}: {
  title: string;
  value: string;
  trendText: string;
  trendPositive: boolean;
  color: "emerald" | "blue" | "violet" | "amber" | "teal";
  sparkValues: number[];
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

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${tone.chip}`}>●</span>
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
  const [trendRange, setTrendRange] = useState<TrendRange>("6m");

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

  const topDesignationRows = useMemo(() => {
    const total = designationSlices.reduce((sum, slice) => sum + slice.amount, 0);
    return designationSlices.slice(0, 5).map((slice) => ({
      label: slice.name,
      value: slice.amount,
      pct: total > 0 ? Math.round((slice.amount / total) * 100) : 0,
    }));
  }, [designationSlices]);

  const filteredTrendPoints = useMemo(() => {
    if (trendPoints.length === 0) return [];
    const size = trendRange === "mom" ? 2 : trendRange === "3m" ? 3 : trendRange === "6m" ? 6 : trendRange === "1y" ? 12 : trendPoints.length;
    return trendPoints.slice(-size);
  }, [trendPoints, trendRange]);

  const filteredTrendTotal = useMemo(
    () => filteredTrendPoints.reduce((sum, point) => sum + point.amount, 0),
    [filteredTrendPoints],
  );

  const filteredTrendGiftCount = useMemo(
    () => {
      const pointCountSum = filteredTrendPoints.reduce((sum, point) => sum + getTrendPointCount(point), 0);
      if (pointCountSum > 0) return pointCountSum;
      if (trendGiftCount <= 0) return 0;
      if (trendRange === "all") return trendGiftCount;

      const fullAmount = trendTotal > 0 ? trendTotal : trendPoints.reduce((sum, point) => sum + point.amount, 0);
      if (fullAmount <= 0) return 0;
      const proportionalCount = Math.round((filteredTrendTotal / fullAmount) * trendGiftCount);
      return Math.max(0, proportionalCount);
    },
    [filteredTrendPoints, filteredTrendTotal, trendGiftCount, trendPoints, trendRange, trendTotal],
  );

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

  const upcomingRows = useMemo(() => {
    return campaigns
      .filter((campaign) => campaign.endDate)
      .sort((a, b) => new Date(a.endDate ?? 0).getTime() - new Date(b.endDate ?? 0).getTime())
      .slice(0, 3)
      .map((campaign) => ({
        id: campaign.id,
        title: campaign.name,
        date: campaign.endDate ? formatPanelDate(campaign.endDate) : "TBD",
        time: campaign.endDate ? formatPanelTime(campaign.endDate) : "",
        count: toDashboardNumber(campaign.totalRaised),
      }));
  }, [campaigns]);

  const campaignRows = campaigns.slice(0, 4).map((campaign) => {
    const raised = toDashboardNumber(campaign.totalRaised);
    const goal = toDashboardNumber(campaign.goal);
    const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    return { campaign, raised, goal, progress };
  });

  const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());
  const widgetCardClass = "rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.08)]";
  const widgetHeaderClass = "flex items-center justify-between border-b border-slate-100 px-5 py-3.5";

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <div className="mx-auto max-w-[1660px] px-5 pb-10 pt-6 sm:px-6 xl:px-8">
        {sectionErrors.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
            {sectionErrors.slice(0, 2).join(" ")}
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[38px] font-bold tracking-tight text-slate-900">Welcome back, {firstName}! 👋</h1>
            <p className="mt-1 text-sm text-slate-600">Here's what's happening with your ministry today.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2.75v2.5M16 2.75v2.5M4 8h16M5.75 5.25h12.5A1.75 1.75 0 0 1 20 7v12.25A1.75 1.75 0 0 1 18.25 21H5.75A1.75 1.75 0 0 1 4 19.25V7a1.75 1.75 0 0 1 1.75-1.75z" />
              </svg>
              <span>{weekLabel} · {dataThroughLabel}</span>
            </button>
          </div>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total Donors" value={totalDonorsValue} trendText="↑ Active records" trendPositive color="emerald" sparkValues={sparkValues} />
          <StatCard title="Gifts This Month" value={monthGivingValue} trendText={`${summary?.momTrend != null ? (summary.momTrend >= 0 ? "↑" : "↓") : ""} ${summary?.momTrend != null ? `${Math.abs(Math.round(summary.momTrend))}%` : "—"} vs last month`} trendPositive={(summary?.momTrend ?? 0) >= 0} color="blue" sparkValues={sparkValues.map((v, i) => v * (0.85 + i * 0.04))} />
          <StatCard title="New Donors" value={newDonorsValue} trendText="↑ month to date" trendPositive color="violet" sparkValues={sparkValues.map((v, i) => v * (0.7 + i * 0.05))} />
          <StatCard title="Upcoming Events" value={upcomingEventsCount.toLocaleString()} trendText="View this week" trendPositive={false} color="amber" sparkValues={sparkValues.map((v, i) => v * (0.6 + i * 0.06))} />
          <StatCard title="Emails Sent" value="—" trendText="Tracking soon" trendPositive color="teal" sparkValues={sparkValues.map((v, i) => v * (0.9 + i * 0.02))} />
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1.05fr_0.9fr]">
          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-xl font-semibold text-slate-900">Recent Gifts</h2>
              <span className="text-xs font-semibold text-emerald-700">View all</span>
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

          <article className={`${widgetCardClass} p-4`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Giving Overview</h2>
              <span className="text-xs font-semibold text-emerald-700">View full report</span>
            </div>
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
                    <Tooltip formatter={(value: number) => formatDashboardCurrency(value)} />
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
              <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
              <span className="text-xs font-semibold text-emerald-700">View all</span>
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
        </section>

        <section className="mt-3">
          <article className={widgetCardClass}>
            <div className={`${widgetHeaderClass} flex-wrap gap-3`}>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Giving Trends</h2>
                <p className="mt-0.5 text-xs text-slate-500">{reportingYearMode === "fiscal" ? "Fiscal-year" : "Calendar-year"} giving movement over time</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "mom", label: "MoM" },
                  { key: "3m", label: "3M" },
                  { key: "6m", label: "6M" },
                  { key: "1y", label: "1Y" },
                  { key: "all", label: "All" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTrendRange(option.key as TrendRange)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${trendRange === option.key ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="h-[260px] min-w-0 rounded-xl border border-slate-100 bg-slate-50/45 p-2">
                {filteredTrendPoints.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">No trend data available yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredTrendPoints} margin={{ top: 10, right: 8, left: 4, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => formatDashboardCompactCurrency(Number(value))}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value: number) => formatDashboardCurrency(Number(value))}
                        labelClassName="text-xs font-semibold text-slate-700"
                        contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#16a34a"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#16a34a" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[320px] lg:grid-cols-1">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Range total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatDashboardCurrency(filteredTrendTotal)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Gift count</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{filteredTrendGiftCount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">MoM trend</p>
                  <p className={`mt-1 text-2xl font-bold ${(trendPercent ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {trendPercent == null ? "—" : `${trendPercent >= 0 ? "+" : ""}${Math.round(trendPercent)}%`}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1.05fr_0.9fr]">
          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-xl font-semibold text-slate-900">Top Campaigns</h2>
              <span className="text-xs font-semibold text-emerald-700">View all</span>
            </div>
            <div className="space-y-3 px-4 py-3">
              {campaignRows.map(({ campaign, raised, goal, progress }) => (
                <div key={campaign.id}>
                  <div className="mb-1.5 grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr] gap-3 text-xs">
                    <p className="font-semibold text-slate-700">{campaign.name}</p>
                    <p className="text-slate-600">{formatDashboardCompactCurrency(raised)}</p>
                    <p className="text-slate-500">{goal > 0 ? formatDashboardCompactCurrency(goal) : "—"}</p>
                    <p className="text-right font-semibold text-slate-700">{progress}%</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-xl font-semibold text-slate-900">Upcoming Events</h2>
              <span className="text-xs font-semibold text-emerald-700">View calendar</span>
            </div>
            <div className="space-y-2 px-4 py-3">
              {upcomingRows.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming events yet.</p>
              ) : upcomingRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[48px_1fr_auto] gap-2 rounded-lg border border-slate-100 p-2.5">
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-700">
                    {row.date.split(" ")[0]}
                    <div className="text-base font-bold text-slate-900">{row.date.split(" ")[1]?.replace(",", "")}</div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.date} at {row.time}</p>
                  </div>
                  <div className="text-right text-xs font-semibold text-emerald-700">{formatDashboardCompactCurrency(row.count)}</div>
                </div>
              ))}
            </div>
          </article>

          <article className={widgetCardClass}>
            <div className={widgetHeaderClass}>
              <h2 className="text-xl font-semibold text-slate-900">My Tasks</h2>
              <span className="text-xs font-semibold text-emerald-700">View all</span>
            </div>
            <div className="space-y-2.5 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center justify-between"><span>Follow up with new donors</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{summary?.newDonorsThisMonth ?? 0}/{summary?.newDonorsThisMonth ?? 0}</span></div>
              <div className="flex items-center justify-between"><span>Prepare thank-you letters</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">0/{summary?.pendingTasks ?? 0}</span></div>
              <div className="flex items-center justify-between"><span>Review monthly reports</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">0/1</span></div>
              <div className="flex items-center justify-between"><span>Resolve overdue tasks</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{summary?.overdueTasks ?? 0}/{summary?.pendingTasks ?? 0}</span></div>
            </div>
          </article>
        </section>

        {extraSections}
      </div>
    </div>
  );
}
