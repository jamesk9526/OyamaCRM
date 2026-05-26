/**
 * DonorHealthSnapshot combines real donor, retention, and task metrics into a scan-friendly health card.
 */
"use client";

import Link from "next/link";
import type { DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";

interface DonorHealthSnapshotProps {
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  loading: boolean;
}

function healthTone(rate: number): { label: string; className: string } {
  if (rate >= 70) return { label: "Healthy", className: "bg-emerald-50 text-emerald-700" };
  if (rate >= 50) return { label: "Watch", className: "bg-amber-50 text-amber-700" };
  return { label: "Needs attention", className: "bg-rose-50 text-rose-700" };
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <p className="text-lg font-bold text-slate-950">{value}</p>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{helper}</p>
    </div>
  );
}

export default function DonorHealthSnapshot({ summary, retention, loading }: DonorHealthSnapshotProps) {
  const rate = retention?.rate ?? 0;
  const tone = healthTone(rate);
  const lapsed = retention ? Math.max(0, retention.total - retention.retained) : 0;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Donor Health Snapshot</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Retention, first-time donors, and follow-up pressure</p>
        </div>
        {!loading && retention ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.className}`}>{tone.label}</span>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-50" />)}
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-600">No donor health data available.</p>
          <p className="mt-1 text-xs text-slate-400">Connect or import donor data to populate this card.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Active donors" value={(summary.activeDonors ?? 0).toLocaleString()} helper="Gave in scope" />
            <Metric label="New donors" value={summary.newDonorsThisMonth.toLocaleString()} helper="First gift in scope" />
            <Metric label="Open follow-ups" value={(summary.pendingTasks + summary.overdueTasks).toLocaleString()} helper={`${summary.overdueTasks.toLocaleString()} overdue`} />
            <Metric label="At-risk cohort" value={lapsed.toLocaleString()} helper="Prior donors not retained" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/reports?report=lapsed-donor-report" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              Review lapsed donors
            </Link>
            <Link href="/tasks" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
              Open follow-ups
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
