"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, HeartHandshake, Target } from "lucide-react";
import { formatDashboardCurrency } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";

function SafeMeter({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" }) {
  const width = Math.max(3, Math.min(100, Number.isFinite(value) ? value : 0));
  const toneClass = tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-[#0f6cbd]";
  return <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`dashboard-bar-grow h-full rounded-full ${toneClass}`} style={{ width: `${width}%` }} /></div>;
}

/** A compact operating summary that can be positioned like every other dashboard widget. */
export default function AtAGlanceWidget({
  summary,
  retention,
  revenueGoal,
  loading = false,
}: {
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  revenueGoal: number;
  loading?: boolean;
}) {
  if (loading) return <div className="h-32 animate-pulse rounded-lg bg-slate-100" />;

  const raised = summary?.ytdAmount ?? 0;
  const givingPct = revenueGoal > 0 ? Math.round((raised / revenueGoal) * 100) : 0;
  const retentionPct = retention?.rate ?? 0;
  const pending = summary?.pendingTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const taskHealth = pending > 0 ? Math.max(0, Math.round(((pending - overdue) / pending) * 100)) : 100;

  const metrics = [
    { label: "Giving pace", value: formatDashboardCurrency(raised), detail: revenueGoal > 0 ? `${Math.max(0, givingPct)}% of active goal` : "Set a campaign goal to compare pace", href: "/campaigns", percent: givingPct, tone: "blue" as const, icon: Target },
    { label: "Donor retention", value: retention ? `${Math.round(retentionPct)}%` : "—", detail: retention ? `${retention.retained.toLocaleString()} retained donors` : "No retention comparison yet", href: "/reports?report=donor-retention", percent: retentionPct, tone: "green" as const, icon: HeartHandshake },
    { label: "Follow-up health", value: overdue > 0 ? `${overdue} overdue` : "On track", detail: pending > 0 ? `${pending.toLocaleString()} open donor tasks` : "No open donor tasks", href: "/tasks", percent: taskHealth, tone: overdue > 0 ? "amber" as const : "green" as const, icon: CheckCircle2 },
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {metrics.map(({ label, value, detail, href, percent, tone, icon: Icon }) => (
        <Link key={label} href={href} className="group rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3 transition-colors hover:border-[#0f6cbd] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd] focus-visible:ring-offset-2">
          <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /></div>
          <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
          <SafeMeter value={percent} tone={tone} />
          <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f6cbd] opacity-0 transition-opacity group-hover:opacity-100">Open details <ArrowUpRight className="h-3 w-3" aria-hidden="true" /></span>
        </Link>
      ))}
    </div>
  );
}
