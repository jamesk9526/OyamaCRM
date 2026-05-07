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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
        fetch(`${API}/api/reports/summary`).then((res) => res.json()),
        fetch(`${API}/api/reports/donor-retention`).then((res) => res.json()),
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
        <StatCard label="Constituents" value={summary?.totalConstituents} loading={loading} icon="👥" />
        <StatCard label="YTD Raised" value={summary?.ytdAmount} format="currency" loading={loading} icon="💰" />
        <StatCard label="Pending Tasks" value={summary?.pendingTasks} loading={loading} icon="✓"
          alert={summary && summary.overdueTasks > 0 ? `${summary.overdueTasks} overdue` : undefined} />
        <StatCard label="Active Campaigns" value={summary?.activeCampaigns} loading={loading} icon="📊" />
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
