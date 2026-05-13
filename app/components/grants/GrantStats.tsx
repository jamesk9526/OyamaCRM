/**
 * GrantStats — summary cards for grants research, deadlines, and decision workflows.
 * Fetches aggregated metrics from GET /api/grants/stats.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { PIPELINE_STAGES, fmt$ } from "./types";
import type { GrantStats as GrantStatsResponse } from "./types";

/** Single stat card used in the grants page header. */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/** GrantStats — fetches and renders grant pipeline summary cards. */
export default function GrantStats({ refresh }: { refresh?: number }) {
  const [stats, setStats] = useState<GrantStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      apiFetch<GrantStatsResponse>("/api/grants/stats")
        .then(setStats)
        .catch(() => setStats(null))
        .finally(() => setLoading(false));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const activeCount = PIPELINE_STAGES.reduce((sum, status) => {
    return sum + (stats.byStatus?.[status]?.count ?? 0);
  }, 0);

  const applicationsInProgress = stats.applicationsInProgress ?? activeCount;
  const submittedAwaitingDecision = stats.submittedAwaitingDecision ?? 0;
  const reportsDue = stats.reportsDue ?? 0;
  const renewalsComingUp = stats.renewalsComingUp ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Total Opportunities" value={String(stats.total)} sub="all tracked grants" />
      <StatCard label="Applications In Progress" value={String(applicationsInProgress)} sub="currently being written" color="text-blue-600" />
      <StatCard label="Submitted Awaiting Decision" value={String(submittedAwaitingDecision)} sub="pending funder response" color="text-indigo-700" />
      <StatCard label="Requested Amount" value={fmt$(stats.totalRequested)} sub="potential, not received revenue" />
      <StatCard label="Awarded Amount" value={fmt$(stats.totalAwarded)} sub="decision-tracked awards" color="text-green-700" />
      <StatCard
        label="Deadlines / Reports"
        value={String(stats.upcomingDeadlines + reportsDue)}
        sub={`next 30 days, ${renewalsComingUp} renewals ahead`}
        color={stats.upcomingDeadlines + reportsDue > 0 ? "text-amber-600" : "text-gray-900"}
      />
    </div>
  );
}
