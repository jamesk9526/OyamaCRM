"use client";

import { useId } from "react";
import Link from "next/link";
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import { buildDesignationChart } from "@/app/features/donor-dashboard/calculations/dashboard-chart-data";
import { formatDashboardCompactCurrency, formatDashboardCurrency } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData, DonorDashboardSummary } from "@/app/features/donor-dashboard/types";

const COLORS = ["var(--crm-accent)", "#3ba69c", "#a385da", "#d4a04d", "#94a3b8"];

export default function DonorPerformanceCharts({ data, summary, loading, unavailable }: {
  data: DashboardData | null; summary: DonorDashboardSummary | null; loading: boolean; unavailable: boolean;
}) {
  const gradientId = `donor-giving-${useId().replace(/:/g, "")}`;
  const trendUnavailable = unavailable || !data || data.errors.some((error) => error.startsWith("Giving trend"));
  const fundsUnavailable = unavailable || !data || data.errors.some((error) => error.startsWith("Giving by designation"));
  const funds = buildDesignationChart(data?.designationSlices ?? []);
  const points = data?.trendPoints ?? [];
  const reportQuery = new URLSearchParams({ report: "giving-by-month" });
  if (summary?.period) {
    reportQuery.set("dateBasis", summary.period.basis);
    reportQuery.set("year", String(summary.period.year));
  }
  const hasComparison = points.some((point) => point.previousAmount != null);
  return <section className="donor-chart-grid" aria-label="Giving performance charts">
    <CRMCard className="min-w-0" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="donor-eyebrow">Giving over time</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Revenue momentum</h2><p className="mt-1 text-xs leading-5 text-slate-500">Completed gifts · {summary?.period?.label ?? "selected reporting year"} · grants excluded</p></div>
        <Link href={`/reports?${reportQuery}`} className="donor-text-link">Open report →</Link>
      </div>
      <div className="donor-chart-canvas mt-5" aria-busy={loading}>
        {loading ? <p className="donor-chart-state" role="status">Loading giving trend…</p>
          : trendUnavailable ? <p className="donor-chart-state">Giving trend unavailable. Other dashboard tools are still available.</p>
          : !points.length || points.every((point) => !point.amount && !point.previousAmount) ? <p className="donor-chart-state">No completed gifts in this reporting period.</p>
          : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={points} margin={{ top: 12, right: 10, left: 0, bottom: 4 }} accessibilityLayer>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--crm-accent)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--crm-accent)" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid stroke="#e8eef0" strokeDasharray="4 5" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={14} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value: number) => formatDashboardCompactCurrency(value)} width={62} />
              <Tooltip formatter={(value) => formatDashboardCurrency(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #dce5ea", boxShadow: "0 8px 30px #0f172a14", fontSize: 12 }} />
              <Area type="monotone" dataKey="amount" name="This period" stroke="var(--crm-accent)" strokeWidth={3} fill={`url(#${gradientId})`} isAnimationActive={false} />
              {hasComparison && <Line type="monotone" dataKey="previousAmount" name="Prior year, same elapsed period" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>}
      </div>
      {!loading && !trendUnavailable && points.length > 0 && <><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="donor-chart-legend"><i style={{ background: "var(--crm-accent)" }} />This period</span>{hasComparison && <span className="donor-chart-legend"><i style={{ background: "#94a3b8" }} />Prior year, same elapsed period</span>}</div>{points.some((point) => point.isPartial) && <p className="mt-2 text-xs text-slate-500">The current month is partial; both series stop at the same elapsed point.</p>}<details className="donor-chart-table mt-3"><summary>View monthly values</summary><div className="overflow-x-auto"><table><caption className="sr-only">Monthly giving and matching prior-year comparison</caption><thead><tr><th scope="col">Month</th><th scope="col">Completed gifts</th><th scope="col">Amount</th>{hasComparison && <th scope="col">Prior year</th>}</tr></thead><tbody>{points.map((point) => <tr key={point.month ?? point.label}><th scope="row">{point.label}{point.isPartial ? " (partial)" : ""}</th><td>{point.giftCount ?? "—"}</td><td>{formatDashboardCurrency(point.amount)}</td>{hasComparison && <td>{point.previousAmount == null ? "—" : formatDashboardCurrency(point.previousAmount)}</td>}</tr>)}</tbody></table></div></details></>}
    </CRMCard>
    <CRMCard className="min-w-0" padding="lg">
      <div><p className="donor-eyebrow">Where support goes</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Giving by fund</h2><p className="mt-1 text-xs leading-5 text-slate-500">Completed gifts in the same reporting period</p></div>
      {loading ? <p className="donor-chart-state" role="status">Loading fund mix…</p>
        : fundsUnavailable ? <p className="donor-chart-state">Fund mix unavailable. Retry the dashboard to load this chart.</p>
        : !funds.rows.length ? <p className="donor-chart-state">No fund allocations in this reporting period.</p>
        : <><div className="relative mx-auto h-52 w-full max-w-xs" role="img" aria-label={`Giving by fund: ${funds.rows.map((row) => `${row.name} ${row.percentage.toFixed(1)}%`).join(", ")}`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={funds.rows} dataKey="amount" nameKey="name" innerRadius={66} outerRadius={88} paddingAngle={3} stroke="none" isAnimationActive={false}>{funds.rows.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatDashboardCurrency(Number(value))} contentStyle={{ borderRadius: 12, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-slate-500">Total giving</span><strong className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{formatDashboardCompactCurrency(funds.total)}</strong></div></div><ul className="space-y-3">{funds.rows.map((row, index) => <li key={row.name} className="flex items-center justify-between gap-2 text-xs"><span className="donor-chart-legend min-w-0"><i style={{ background: COLORS[index % COLORS.length] }} /><span className="truncate text-slate-600" title={row.name}>{row.name}</span></span><span className="shrink-0 font-semibold tabular-nums text-slate-800">{formatDashboardCurrency(row.amount)} <span className="ml-1 font-normal text-slate-500">{row.percentage.toFixed(1)}%</span></span></li>)}</ul></>}
    </CRMCard>
  </section>;
}
