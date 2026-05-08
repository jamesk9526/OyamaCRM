/**
 * Dashboard page — OyamaCRM home screen.
 * Displays a real-time snapshot of org health: revenue, retention, tasks, and recent activity.
 * All data is fetched client-side so the greeting can be personalized.
 */
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import RevenueProgress from "./components/dashboard/RevenueProgress";
import DonorRetention from "./components/dashboard/DonorRetention";
import TasksWidget from "./components/dashboard/TasksWidget";
import TotalsByLevel from "./components/dashboard/TotalsByLevel";
import StatCard from "./components/dashboard/StatCard";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape returned by /api/reports/summary */
interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  weekAmount: number;
  weekCount: number;
  weekAvg: number;
  activeCampaigns: number;
  activeGoalTotal: number;
  pendingTasks: number;
  overdueTasks: number;
}

/** Shape returned by /api/reports/donor-retention */
interface RetentionData {
  total: number;
  retained: number;
  rate: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [loading, setLoading] = useState(true);

  /** Greeting based on time of day */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  /** Fetch all dashboard data in parallel */
  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        apiFetch<Summary>("/api/reports/summary"),
        apiFetch<RetentionData>("/api/reports/donor-retention"),
      ]);
      setSummary(s);
      setRetention(r);
      setLastRefreshed(new Date());
    } catch {
      // Silently fail — components handle missing data gracefully
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {greeting}, {name}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening today
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">
            Refreshed {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <button
            onClick={load}
            className="text-xs text-green-600 hover:text-green-700 font-medium mt-0.5 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Constituents"
          value={summary?.totalConstituents}
          loading={loading}
          accent="border-l-blue-500"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="YTD Raised"
          value={summary?.ytdAmount}
          format="currency"
          loading={loading}
          accent="border-l-green-500"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Tasks"
          value={summary?.pendingTasks}
          loading={loading}
          accent={summary && summary.overdueTasks > 0 ? "border-l-red-500" : "border-l-amber-500"}
          alert={summary && summary.overdueTasks > 0 ? `${summary.overdueTasks} overdue` : undefined}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <StatCard
          label="Active Campaigns"
          value={summary?.activeCampaigns}
          loading={loading}
          accent="border-l-purple-500"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          }
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — Revenue */}
        <div className="space-y-4">
          <RevenueProgress
            current={summary?.ytdAmount ?? 0}
            goal={summary?.activeGoalTotal || 200000}
            loading={loading}
          />
          <TotalsByLevel
            weekTotal={summary?.weekAmount ?? 0}
            transactions={summary?.weekCount ?? 0}
            avgTransaction={summary?.weekAvg ?? 0}
            loading={loading}
          />
        </div>

        {/* Middle — Retention */}
        <div>
          <DonorRetention
            retained={retention?.retained ?? 0}
            total={retention?.total ?? 0}
            rate={retention?.rate}
            loading={loading}
          />
        </div>

        {/* Right — Tasks (spans 2 rows) */}
        <div className="lg:row-span-2">
          <TasksWidget />
        </div>
      </div>
    </div>
  );
}
