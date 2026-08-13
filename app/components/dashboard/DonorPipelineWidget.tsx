"use client";

import Link from "next/link";
import { ArrowUpRight, UserPlus, Users } from "lucide-react";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";

/** Shows live donor-base movement without requiring a second reporting endpoint. */
export default function DonorPipelineWidget({ summary, loading = false }: { summary: DonorDashboardSummary | null; loading?: boolean }) {
  if (loading) return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;

  const total = summary?.totalConstituents ?? 0;
  const active = summary?.activeDonors ?? 0;
  const newDonors = summary?.newDonorsThisMonth ?? 0;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-2xl font-semibold tracking-tight text-slate-900">{active.toLocaleString()}</p><p className="text-xs text-slate-500">active donors in your relationship base</p></div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff6fc] text-[#0f6cbd]"><Users className="h-4 w-4" aria-hidden="true" /></span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-slate-600">Active relationship coverage</span><span className="font-semibold text-[#0f6cbd]">{activePct}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="dashboard-bar-grow h-full rounded-full bg-[#0f6cbd]" style={{ width: `${Math.max(3, activePct)}%` }} /></div>
      </div>
      <Link href="/constituents?view=new" className="group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-[#0f6cbd] hover:bg-[#fafafa]"><span className="flex min-w-0 items-center gap-2"><UserPlus className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span><span className="block text-sm font-semibold text-slate-800">{newDonors.toLocaleString()} new this month</span><span className="block text-[11px] text-slate-500">Review welcome and first-gift follow-up</span></span></span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#0f6cbd]" aria-hidden="true" /></Link>
    </div>
  );
}
