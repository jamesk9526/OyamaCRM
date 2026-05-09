/**
 * Dashboard page — OyamaCRM home screen.
 * Displays a real-time snapshot of org health: revenue, retention, tasks, giving trends,
 * recent donations, and top donors. Widgets are drag-and-drop rearrangeable with
 * order persisted to localStorage.
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import RevenueProgress from "./components/dashboard/RevenueProgress";
import DonorRetention from "./components/dashboard/DonorRetention";
import TasksWidget from "./components/dashboard/TasksWidget";
import TotalsByLevel from "./components/dashboard/TotalsByLevel";
import StatCard from "./components/dashboard/StatCard";
import DashboardWidget from "./components/dashboard/DashboardWidget";
import GivingTrendChart from "./components/dashboard/GivingTrendChart";
import RecentDonationsWidget from "./components/dashboard/RecentDonationsWidget";
import TopDonorsWidget from "./components/dashboard/TopDonorsWidget";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape returned by /api/reports/summary (extended) */
interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  weekAmount: number;
  weekCount: number;
  weekAvg: number;
  monthAmount: number;
  monthCount: number;
  momTrend: number | null;
  newDonorsThisMonth: number;
  activeCampaigns: number;
  activeGoalTotal: number;
  pendingTasks: number;
  overdueTasks: number;
}

interface RetentionData {
  total: number;
  retained: number;
  rate: number;
}

/** Ordered list of draggable widget IDs */
const DEFAULT_WIDGET_ORDER = [
  "giving-trend",
  "recent-donations",
  "revenue",
  "retention",
  "top-donors",
  "tasks",
  "weekly-stats",
] as const;

type WidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];

const LS_KEY = "dashboard-widget-order";

/** Load widget order from localStorage, fall back to defaults */
function loadOrder(): WidgetId[] {
  if (typeof window === "undefined") return [...DEFAULT_WIDGET_ORDER];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_WIDGET_ORDER];
    const parsed: WidgetId[] = JSON.parse(raw);
    // Merge: keep existing order but include any new widgets
    const existing = new Set(parsed);
    const full = [...parsed, ...DEFAULT_WIDGET_ORDER.filter((w) => !existing.has(w))];
    return full;
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Widget order & drag state
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(loadOrder);
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /** Greeting based on time of day */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  /** Fetch all dashboard data in parallel */
  const load = useCallback(async () => {
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
      // Silently fail — widgets handle empty data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Persist order whenever it changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  /** Drag handlers — pure index-based splice */
  function handleDragStart(idx: number) {
    dragFrom.current = idx;
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleDrop(idx: number) {
    if (dragFrom.current === null || dragFrom.current === idx) return;
    const next = [...widgetOrder];
    const [moved] = next.splice(dragFrom.current, 1);
    next.splice(idx, 0, moved);
    setWidgetOrder(next);
    dragFrom.current = null;
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  /** Build drag props for widget at a given index */
  function dragProps(idx: number) {
    return {
      onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; handleDragStart(idx); },
      onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
      onDrop: () => handleDrop(idx),
      onDragEnd: handleDragEnd,
      isDragging: dragFrom.current === idx,
      isDragOver: dragOverIdx === idx && dragFrom.current !== idx,
    };
  }

  /** Render a single widget by its ID */
  function renderWidget(id: WidgetId, idx: number) {
    const dp = dragProps(idx);
    switch (id) {
      case "giving-trend":
        return (
          <DashboardWidget key={id} id={id} title="Giving Trend" subtitle={`${new Date().getFullYear()} monthly totals`} className="lg:col-span-2 min-h-[280px]" {...dp}>
            <GivingTrendChart />
          </DashboardWidget>
        );
      case "recent-donations":
        return (
          <DashboardWidget key={id} id={id} title="Recent Donations" subtitle="Last 8 gifts" {...dp}>
            <RecentDonationsWidget />
          </DashboardWidget>
        );
      case "revenue":
        return (
          <DashboardWidget key={id} id={id} title="Revenue Progress" subtitle="Active campaign goals" {...dp}>
            <RevenueProgress
              current={summary?.ytdAmount ?? 0}
              goal={summary?.activeGoalTotal || 200000}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "retention":
        return (
          <DashboardWidget key={id} id={id} title="Donor Retention" subtitle="Year-over-year" {...dp}>
            <DonorRetention
              retained={retention?.retained ?? 0}
              total={retention?.total ?? 0}
              rate={retention?.rate}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "top-donors":
        return (
          <DashboardWidget key={id} id={id} title="Top Donors" subtitle="By lifetime giving" {...dp}>
            <TopDonorsWidget />
          </DashboardWidget>
        );
      case "tasks":
        return (
          <DashboardWidget key={id} id={id} title="Tasks" subtitle="Open & upcoming" className="lg:row-span-2" {...dp}>
            <TasksWidget />
          </DashboardWidget>
        );
      case "weekly-stats":
        return (
          <DashboardWidget key={id} id={id} title="This Week" subtitle="Donation activity" {...dp}>
            <TotalsByLevel
              weekTotal={summary?.weekAmount ?? 0}
              transactions={summary?.weekCount ?? 0}
              avgTransaction={summary?.weekAvg ?? 0}
              loading={loading}
            />
          </DashboardWidget>
        );
      default:
        return null;
    }
  }

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
        <div className="flex items-center gap-3">
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
          {/* Reset widget order */}
          <button
            onClick={() => setWidgetOrder([...DEFAULT_WIDGET_ORDER])}
            title="Reset widget layout"
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1 transition-colors"
          >
            ⊞ Reset
          </button>
        </div>
      </div>

      {/* ── Top stat row (not draggable — always pinned) ── */}
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
          trend={summary?.momTrend != null ? { value: summary.momTrend, label: "vs last month" } : undefined}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="New Donors"
          value={summary?.newDonorsThisMonth}
          loading={loading}
          accent="border-l-teal-500"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
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
      </div>

      {/* ── Draggable widget grid ── */}
      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
        <span>⠿</span> Drag cards to rearrange your dashboard
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgetOrder.map((id, idx) => renderWidget(id, idx))}
      </div>
    </div>
  );
}
