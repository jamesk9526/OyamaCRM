"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, HeartHandshake, TrendingUp } from "lucide-react";
import type { DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import { formatDashboardCompactCurrency } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

function PulseBar({ value, tone }: { value: number; tone: "blue" | "green" | "amber" }) {
  const palette = tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-[#0f6cbd]";
  return <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className={`dashboard-bar-grow h-full rounded-full ${palette}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} /></div>;
}

/** Compact, live operational pulse for the dashboard header—not a second dashboard shell. */
export default function DashboardHeaderPulse({ summary, retention, revenueGoal }: { summary: DonorDashboardSummary | null; retention: RetentionData | null; revenueGoal: number }) {
  const ytd = summary?.ytdAmount ?? 0;
  const goalPct = revenueGoal > 0 ? Math.round((ytd / revenueGoal) * 100) : 0;
  const tasks = summary?.pendingTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const followUpPct = tasks > 0 ? Math.round(((tasks - overdue) / tasks) * 100) : 100;
  const cells = [
    { label: "YTD pace", value: formatDashboardCompactCurrency(ytd), detail: revenueGoal > 0 ? `${Math.max(0, goalPct)}% of goal` : "No goal set", href: "/campaigns", percent: goalPct, tone: "blue" as const, icon: TrendingUp },
    { label: "Retention", value: retention ? `${Math.round(retention.rate)}%` : "—", detail: retention ? "year-over-year" : "Awaiting comparison", href: "/reports?report=donor-retention", percent: retention?.rate ?? 0, tone: "green" as const, icon: HeartHandshake },
    { label: "Follow-up", value: overdue > 0 ? `${overdue} overdue` : "On track", detail: tasks > 0 ? `${tasks} open tasks` : "No open tasks", href: "/tasks", percent: followUpPct, tone: overdue > 0 ? "amber" as const : "green" as const, icon: Clock3 },
  ];

  return (
    <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-3">
      {cells.map(({ label, value, detail, href, percent, tone, icon: Icon }) => (
        <Link key={label} href={href} className="group rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5 transition-colors hover:border-[#0f6cbd] hover:bg-white">
          <span className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span><Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /></span>
          <span className="mt-1 flex items-baseline justify-between gap-2"><span className="text-base font-semibold text-slate-900">{value}</span><span className="text-[10px] text-slate-500">{detail}</span><ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-[#0f6cbd]" aria-hidden="true" /></span>
          <PulseBar value={percent} tone={tone} />
        </Link>
      ))}
    </div>
  );
}
