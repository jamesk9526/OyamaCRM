"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DashboardPanel, DASHBOARD_PANEL_CLASS } from "./shared/DashboardPrimitives";
import { formatDashboardCompactCurrency, formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData } from "@/app/features/donor-dashboard/types";

const CHART_COLORS = ["#0f6cbd", "#115ea3", "#616161", "#d97706", "#8764b8"];

export function DonorDashboardOverviewSections({
  designationSlices,
  designationTotal,
  suggestions,
}: {
  designationSlices: DashboardData["designationSlices"];
  designationTotal: number;
  suggestions: DashboardData["stewardshipAlerts"];
}) {
  const topDesignations = useMemo(() => {
    const total = designationSlices.reduce((sum, slice) => sum + slice.amount, 0);
    return designationSlices.slice(0, 5).map((slice) => ({
      label: slice.name,
      value: slice.amount,
      percentage: total > 0 ? Math.round((slice.amount / total) * 100) : 0,
    }));
  }, [designationSlices]);

  const recommendations = suggestions.slice(0, 4);

  return (
    <>
      <section className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1.45fr]">
        <article className={`${DASHBOARD_PANEL_CLASS} p-5`}>
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

    </>
  );
}
