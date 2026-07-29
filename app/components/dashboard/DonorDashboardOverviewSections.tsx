"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DashboardPanel } from "./shared/DashboardPrimitives";
import { formatDashboardCompactCurrency, formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData, DonationPreview, DonorDashboardSummary } from "@/app/features/donor-dashboard/types";

const CHART_COLORS = ["#0f6cbd", "#115ea3", "#616161", "#d97706", "#8764b8"];

export interface DashboardAttentionItem {
  id: string;
  label: string;
  sub: string;
  count: number;
  href: string;
  tone: "rose" | "amber" | "orange" | "violet";
}

function formatRelativeTime(dateValue: string): string {
  const diffHours = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 3_600_000));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatGiftDate(dateValue: string): string {
  const date = new Date(dateValue);
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
}

export function DonorDashboardOverviewSections({
  designationSlices,
  designationTotal,
  suggestions,
  donations,
  summary,
  attentionItems,
}: {
  designationSlices: DashboardData["designationSlices"];
  designationTotal: number;
  suggestions: DashboardData["stewardshipAlerts"];
  donations: DonationPreview[];
  summary: DonorDashboardSummary | null;
  attentionItems: DashboardAttentionItem[];
}) {
  const topDesignations = useMemo(() => {
    const total = designationSlices.reduce((sum, slice) => sum + slice.amount, 0);
    return designationSlices.slice(0, 5).map((slice) => ({
      label: slice.name,
      value: slice.amount,
      percentage: total > 0 ? Math.round((slice.amount / total) * 100) : 0,
    }));
  }, [designationSlices]);

  const activityRows = useMemo(() => {
    const rows = donations.slice(0, 5).map((donation) => ({
      id: donation.id,
      title: "Gift received",
      detail: `${donation.constituent?.firstName ?? "Donor"} ${donation.constituent?.lastName ?? ""} gave ${formatDashboardCurrency(toDashboardNumber(donation.amount))}`,
      at: formatRelativeTime(donation.date),
    }));
    if ((summary?.newDonorsThisMonth ?? 0) > 0) {
      rows.unshift({
        id: "new-donors",
        title: "New donor activity",
        detail: `${summary!.newDonorsThisMonth.toLocaleString()} new donor${summary!.newDonorsThisMonth === 1 ? "" : "s"} added this month`,
        at: "this month",
      });
    }
    return rows.slice(0, 5);
  }, [donations, summary]);

  const recommendations = suggestions.slice(0, 4);

  return (
    <>
      <section className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1.45fr]">
        <article className="min-w-0 overflow-hidden rounded-[2px] border border-[#d1d1d1] bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Giving Overview</h2>
            <span className="text-[11px] font-medium text-slate-500">Live dashboard breakdown</span>
          </div>
          <p className="text-xs font-medium text-slate-500">{formatDashboardCompactCurrency(designationTotal)} total giving (YTD)</p>
          <div className="grid min-w-0 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative h-[200px] min-w-0 sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <PieChart>
                  <Pie data={topDesignations.map((row) => ({ name: row.label, value: row.value }))} dataKey="value" innerRadius={58} outerRadius={92} paddingAngle={3} cornerRadius={7} stroke="#ffffff" strokeWidth={3}>
                    {topDesignations.map((row, index) => <Cell key={`${row.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatDashboardCurrency(toDashboardNumber(Array.isArray(value) ? value[0] : value as number | string | undefined))} contentStyle={{ borderRadius: 2, border: "1px solid #d1d1d1", boxShadow: "none", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Giving</span>
                <span className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{formatDashboardCompactCurrency(designationTotal)}</span>
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              {topDesignations.map((row, index) => (
                <div key={row.label} className="text-xs">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span className="truncate font-medium text-slate-700">{row.label}</span></div>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-slate-800">{formatDashboardCompactCurrency(row.value)} <span className="font-medium text-slate-400">{row.percentage}%</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[1px] bg-slate-100"><div className="h-full rounded-[1px] transition-[width] duration-700" style={{ width: `${row.percentage}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></div>
                </div>
              ))}
              {topDesignations.length === 0 ? <p className="text-sm text-slate-500">No designation giving is available for this period.</p> : null}
            </div>
          </div>
        </article>

        <DashboardPanel title="Steward Recommendations" meta="Top 4 recommendations">
          <div className="space-y-2.5 px-4 py-3">
            {recommendations.length === 0 ? <p className="text-sm text-slate-500">No recommendations yet.</p> : recommendations.map((item) => (
              <div key={item.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[2px] border border-[#e5e5e5] bg-white px-3 py-3 transition-colors hover:border-[#0f6cbd] hover:bg-[#fafafa] sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-[2px] ${item.urgency === "high" ? "bg-[#deecf9] text-[#115ea3]" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-[#eff6fc] text-[#0f6cbd]"}`}>•</span>
                <div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{item.description}</p></div>
                <span className={`col-start-2 justify-self-start rounded-[2px] px-2 py-0.5 text-[10px] font-semibold sm:col-auto ${item.urgency === "high" ? "bg-[#deecf9] text-[#115ea3]" : item.urgency === "medium" ? "bg-amber-100 text-amber-700" : "bg-[#eff6fc] text-[#0f6cbd]"}`}>{item.urgency === "high" ? "High Priority" : item.urgency === "medium" ? "Medium Priority" : "Low Priority"}</span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </section>

      <section className="mt-3 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1.05fr_0.9fr]">
        <DashboardPanel title="Recent Gifts" action={<Link href="/donations" className="text-xs font-semibold text-[#0f6cbd] hover:text-[#115ea3]">Open donation ledger</Link>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-4 py-2.5">Donor</th><th className="px-4 py-2.5">Amount</th><th className="px-4 py-2.5">Fund</th><th className="px-4 py-2.5">Date</th></tr></thead>
              <tbody>
                {donations.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No recent gifts are available for this dashboard period.</td></tr> : donations.slice(0, 6).map((donation) => (
                  <tr key={donation.id} className="border-t border-[#e5e5e5] transition-colors hover:bg-[#f3f2f1]">
                    <td className="px-4 py-2.5"><p className="font-semibold text-slate-800">{donation.constituent?.firstName ?? "Donor"} {donation.constituent?.lastName ?? ""}</p><p className="text-xs text-slate-500">{donation.campaign?.name ?? "General Giving"}</p></td>
                    <td className="px-4 py-2.5 font-semibold text-[#0f548c]">{formatDashboardCurrency(toDashboardNumber(donation.amount))}</td>
                    <td className="px-4 py-2.5 text-slate-600">{donation.designation?.name ?? "General Fund"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{formatGiftDate(donation.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Recent Activity" meta="Latest donor updates">
          <div className="space-y-3 px-4 py-3">
            {activityRows.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No recent donor activity is available.</p> : activityRows.map((row) => (
              <div key={row.id} className="group flex items-start gap-3 rounded-[2px] px-2 py-1.5 transition-colors hover:bg-[#f3f2f1]"><span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[2px] bg-[#eff6fc] text-[#0f6cbd]">•</span><div><p className="text-sm font-semibold text-slate-800">{row.title}</p><p className="text-xs text-slate-600">{row.detail}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.at}</p></div></div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Needs Attention" meta="Linked donor work queues">
          <div className="space-y-1.5 px-4 py-3">
            {attentionItems.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No dashboard work queues currently need attention.</p> : attentionItems.map((item) => (
              <Link key={item.id} href={item.href} className="group grid grid-cols-[1fr_auto] items-center gap-2 rounded-[2px] border border-[#e5e5e5] bg-white px-3 py-2.5 transition-colors hover:border-[#0f6cbd] hover:bg-[#fafafa]">
                <div><p className="text-sm font-semibold text-slate-800">{item.label}</p><p className="text-[11px] text-slate-500">{item.sub}</p></div>
                <div className="flex items-center gap-2"><span className={`text-sm font-bold ${item.tone === "rose" ? "text-rose-700" : item.tone === "amber" ? "text-amber-700" : item.tone === "orange" ? "text-orange-700" : "text-violet-700"}`}>{item.count}</span><span className="text-slate-400">›</span></div>
              </Link>
            ))}
          </div>
        </DashboardPanel>
      </section>
    </>
  );
}
