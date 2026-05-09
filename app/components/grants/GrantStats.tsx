/**
 * GrantStats — summary stat cards for the grants pipeline.
 * Fetches aggregated metrics from GET /api/grants/stats.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { fmt$ } from "./types";

interface GrantStats {
  total: number;
  active: number;
  awarded: number;
  totalRequested: number;
  totalAwarded: number;
  upcomingDeadlines: number;
}

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
  const [stats, setStats] = useState<GrantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<GrantStats>("/api/grants/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Total Grants" value={String(stats.total)} sub="all time" />
      <StatCard label="Active Pipeline" value={String(stats.active)} sub="in progress" color="text-blue-600" />
      <StatCard label="Awarded" value={String(stats.awarded)} sub="grants won" color="text-green-700" />
      <StatCard label="Total Requested" value={fmt$(stats.totalRequested)} sub="pipeline value" />
      <StatCard label="Total Awarded" value={fmt$(stats.totalAwarded)} sub="secured" color="text-green-700" />
      <StatCard
        label="Upcoming Deadlines"
        value={String(stats.upcomingDeadlines)}
        sub="next 30 days"
        color={stats.upcomingDeadlines > 0 ? "text-amber-600" : "text-gray-900"}
      />
    </div>
  );
}
