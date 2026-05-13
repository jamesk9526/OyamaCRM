/**
 * Dashboard page — OyamaCRM home screen.
 * Displays a real-time snapshot of org health: revenue, retention, tasks, giving trends,
 * recent donations, and top donors.
 *
 * Widget layout is customizable via Edit Mode:
 *   - Edit button (pencil) in header enters edit mode.
 *   - In edit mode each card shows ↑↓ buttons and a drag handle.
 *   - "Customize Layout" opens a modal with a full drag-and-drop reorder list.
 *   - Layout lock prevents accidental changes.
 * Order is persisted to localStorage.
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
import MeetingsWidget from "./components/dashboard/MeetingsWidget";
import CampaignGoalHealthWidget from "./components/dashboard/CampaignGoalHealthWidget";
import EngagementPulseWidget from "./components/dashboard/EngagementPulseWidget";
import StewardshipAttentionWidget from "./components/dashboard/StewardshipAttentionWidget";
import DashboardLayoutModal, { type RevenueGoalMode, type RevenueProgressSource } from "./components/dashboard/DashboardLayoutModal";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape returned by /api/reports/summary (extended) */
interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  /** YTD awarded grant total — always returned; added to ytdAmount when includeGrants=true */
  ytdGrantAmount: number;
  /** YTD completed donations linked to active campaigns only. */
  activeCampaignRaisedAmount: number;
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
  freshness?: {
    generatedAt: string;
    dataThrough: string;
  };
}

interface RetentionData {
  total: number;
  retained: number;
  rate: number;
}

/** Previous shipped default order (kept to support one-time migration logic). */
const PREVIOUS_DEFAULT_WIDGET_ORDER = [
  "giving-trend",
  "recent-donations",
  "revenue",
  "retention",
  "top-donors",
  "tasks",
  "meetings",
  "weekly-stats",
] as const;

/** Ordered list of widget IDs (CRM default). */
const DEFAULT_WIDGET_ORDER = [
  "revenue",
  "goal-health",
  "retention",
  "engagement-pulse",
  "stewardship-attention",
  "top-donors",
  "weekly-stats",
  "giving-trend",
  "recent-donations",
  "tasks",
  "meetings",
] as const;

type WidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];

/** Human-readable label + description for each widget (used in the layout modal) */
const WIDGET_META = [
  { id: "revenue", label: "Revenue Progress", description: "Active campaign goal tracking" },
  { id: "goal-health", label: "Campaign Goal Health", description: "Goal gap and campaign attainment" },
  { id: "retention", label: "Donor Retention", description: "Year-over-year retention rate" },
  { id: "engagement-pulse", label: "Engagement Pulse", description: "Stewardship workload and activity" },
  { id: "stewardship-attention", label: "Stewardship Attention", description: "Who needs follow-up today" },
  { id: "top-donors", label: "Top Donors", description: "By lifetime giving amount" },
  { id: "weekly-stats", label: "This Week", description: "Weekly donation activity summary" },
  { id: "giving-trend", label: "Giving Trend", description: "Monthly giving totals chart" },
  { id: "recent-donations", label: "Recent Donations", description: "Last 8 gifts received" },
  { id: "tasks", label: "Tasks", description: "Open & upcoming staff tasks" },
  { id: "meetings", label: "Upcoming Meetings", description: "Scheduled donor meetings" },
];

const LS_ORDER_KEY = "dashboard-widget-order";
const LS_LOCK_KEY = "dashboard-locked";
const LS_HIDDEN_WIDGETS_KEY = "dashboard-hidden-widgets";
/** Persists the "Include Grants in revenue" preference */
const LS_GRANTS_KEY = "dashboard-include-grants";
/** Persists which data source Revenue Progress should display. */
const LS_REVENUE_SOURCE_KEY = "dashboard-revenue-progress-source";
/** Persists whether Revenue Progress goal is automatic or manually overridden. */
const LS_REVENUE_GOAL_MODE_KEY = "dashboard-revenue-goal-mode";
/** Persists manual Revenue Progress goal amount when override mode is enabled. */
const LS_MANUAL_REVENUE_GOAL_KEY = "dashboard-manual-revenue-goal";

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/** Load widget order from localStorage, falling back to defaults */
function loadOrder(): WidgetId[] {
  if (typeof window === "undefined") return [...DEFAULT_WIDGET_ORDER];
  try {
    const raw = localStorage.getItem(LS_ORDER_KEY);
    if (!raw) return [...DEFAULT_WIDGET_ORDER];
    const parsed: WidgetId[] = JSON.parse(raw);
    // If the user still has the old out-of-box order, migrate to the new CRM default.
    if (sameOrder(parsed, PREVIOUS_DEFAULT_WIDGET_ORDER)) {
      return [...DEFAULT_WIDGET_ORDER];
    }
    // Merge: keep saved order, but append any new widgets not yet in the saved list
    const existing = new Set(parsed);
    return [...parsed, ...DEFAULT_WIDGET_ORDER.filter((w) => !existing.has(w))];
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

/** Load hidden widgets from localStorage. */
function loadHiddenWidgets(): WidgetId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_HIDDEN_WIDGETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WidgetId[];
    return parsed.filter((id) => DEFAULT_WIDGET_ORDER.includes(id));
  } catch {
    return [];
  }
}

/** Load dashboard lock state from localStorage */
function loadLocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_LOCK_KEY) === "true";
}

/** Load grant-inclusion preference from localStorage */
function loadIncludeGrants(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_GRANTS_KEY) === "true";
}

/** Load Revenue Progress source preference from localStorage. */
function loadRevenueProgressSource(): RevenueProgressSource {
  if (typeof window === "undefined") return "YTD_DONATIONS";
  const stored = localStorage.getItem(LS_REVENUE_SOURCE_KEY);
  return stored === "ACTIVE_CAMPAIGNS" ? "ACTIVE_CAMPAIGNS" : "YTD_DONATIONS";
}

/** Load Revenue Progress goal mode preference from localStorage. */
function loadRevenueGoalMode(): RevenueGoalMode {
  if (typeof window === "undefined") return "AUTO";
  const stored = localStorage.getItem(LS_REVENUE_GOAL_MODE_KEY);
  return stored === "MANUAL" ? "MANUAL" : "AUTO";
}

/** Load manual Revenue Progress goal override from localStorage. */
function loadManualRevenueGoalAmount(): number {
  if (typeof window === "undefined") return 0;
  const stored = Number(localStorage.getItem(LS_MANUAL_REVENUE_GOAL_KEY) ?? "0");
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Layout state ──
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(loadOrder);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>(loadHiddenWidgets);
  const [editMode, setEditMode] = useState(false);
  const [locked, setLocked] = useState(loadLocked);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  // ── Grant toggle — persisted to localStorage ──
  const [includeGrants, setIncludeGrants] = useState(loadIncludeGrants);
  const toggleGrants = () => setIncludeGrants((v) => !v);
  const [revenueProgressSource, setRevenueProgressSource] = useState<RevenueProgressSource>(loadRevenueProgressSource);
  const [revenueGoalMode, setRevenueGoalMode] = useState<RevenueGoalMode>(loadRevenueGoalMode);
  const [manualRevenueGoalAmount, setManualRevenueGoalAmount] = useState<number>(loadManualRevenueGoalAmount);

  // ── Drag state (only active in edit mode) ──
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const visibleWidgetOrder = widgetOrder.filter((id) => !hiddenWidgets.includes(id));

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  /** Fetch all dashboard data in parallel */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, r] = await Promise.all([
        apiFetch<Summary>("/api/reports/summary"),
        apiFetch<RetentionData>("/api/reports/donor-retention"),
      ]);
      setSummary(s);
      setRetention(r);
      setLastRefreshed(new Date());
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Persist widget order to localStorage
  useEffect(() => {
    localStorage.setItem(LS_ORDER_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  // Persist hidden widgets to localStorage
  useEffect(() => {
    localStorage.setItem(LS_HIDDEN_WIDGETS_KEY, JSON.stringify(hiddenWidgets));
  }, [hiddenWidgets]);

  // Persist lock state to localStorage
  useEffect(() => {
    localStorage.setItem(LS_LOCK_KEY, locked ? "true" : "false");
    // Exiting lock mode also exits edit mode
    if (locked) setEditMode(false);
  }, [locked]);

  // Persist grant inclusion preference to localStorage
  useEffect(() => {
    localStorage.setItem(LS_GRANTS_KEY, includeGrants ? "true" : "false");
  }, [includeGrants]);

  // Persist Revenue Progress source preference to localStorage
  useEffect(() => {
    localStorage.setItem(LS_REVENUE_SOURCE_KEY, revenueProgressSource);
  }, [revenueProgressSource]);

  // Persist Revenue Progress goal mode preference to localStorage
  useEffect(() => {
    localStorage.setItem(LS_REVENUE_GOAL_MODE_KEY, revenueGoalMode);
  }, [revenueGoalMode]);

  // Persist manual Revenue Progress goal override to localStorage
  useEffect(() => {
    localStorage.setItem(LS_MANUAL_REVENUE_GOAL_KEY, String(manualRevenueGoalAmount));
  }, [manualRevenueGoalAmount]);

  const autoGoal = summary?.activeGoalTotal ?? 0;
  const dynamicFallbackGoal = Math.max(autoGoal, summary?.ytdAmount ?? 0, 1000);
  const revenueGoal = revenueGoalMode === "MANUAL"
    ? Math.max(1, manualRevenueGoalAmount)
    : dynamicFallbackGoal;

  /** Swap widget at `from` index to `to` index */
  function moveWidget(from: number, to: number) {
    if (to < 0 || to >= visibleWidgetOrder.length) return;
    const nextVisible = [...visibleWidgetOrder];
    const hidden = widgetOrder.filter((id) => hiddenWidgets.includes(id));
    const [moved] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, moved);
    setWidgetOrder([...nextVisible, ...hidden]);
  }

  // ── Drag handlers ──
  function handleDragStart(idx: number) { dragFrom.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragFrom.current === null || dragFrom.current === idx) return;
    moveWidget(dragFrom.current, idx);
    dragFrom.current = idx;
    setDragOverIdx(idx);
  }
  function handleDrop(idx: number) {
    if (dragFrom.current === null || dragFrom.current === idx) return;
    moveWidget(dragFrom.current, idx);
    dragFrom.current = null;
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  /** Build drag event props object for a widget at the given index */
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
    // Common edit-mode props passed to every DashboardWidget
    const editProps = {
      editMode,
      onMoveUp: () => moveWidget(idx, idx - 1),
      onMoveDown: () => moveWidget(idx, idx + 1),
      canMoveUp: idx > 0,
      canMoveDown: idx < visibleWidgetOrder.length - 1,
      ...(editMode ? dragProps(idx) : {}),
    };

    switch (id) {
      case "giving-trend":
        return (
          <DashboardWidget key={id} id={id} title="Giving Trend" subtitle={`${new Date().getFullYear()} monthly totals`} className="lg:col-span-2 min-h-[250px]" {...editProps}>
            <GivingTrendChart includeGrants={includeGrants} />
          </DashboardWidget>
        );
      case "recent-donations":
        return (
          <DashboardWidget key={id} id={id} title="Recent Donations" subtitle="Last 8 gifts" {...editProps}>
            <RecentDonationsWidget />
          </DashboardWidget>
        );
      case "revenue":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="Revenue Progress"
            subtitle={revenueGoalMode === "MANUAL"
              ? "Custom goal target"
              : (revenueProgressSource === "YTD_DONATIONS"
                ? "Org YTD raised"
                : "Active campaign raised")}
            {...editProps}
          >
            <RevenueProgress
              current={revenueProgressSource === "ACTIVE_CAMPAIGNS"
                ? (summary?.activeCampaignRaisedAmount ?? 0)
                : (summary?.ytdAmount ?? 0)}
              goal={revenueGoal}
              grantAmount={summary?.ytdGrantAmount ?? 0}
              includeGrants={includeGrants}
              onToggleGrants={toggleGrants}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "goal-health":
        return (
          <DashboardWidget key={id} id={id} title="Campaign Goal Health" subtitle="Attainment and gap analysis" {...editProps}>
            <CampaignGoalHealthWidget
              activeCampaigns={summary?.activeCampaigns ?? 0}
              activeGoalTotal={summary?.activeGoalTotal ?? 0}
              raisedAmount={summary?.activeCampaignRaisedAmount ?? 0}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "retention":
        return (
          <DashboardWidget key={id} id={id} title="Donor Retention" subtitle="Year-over-year" {...editProps}>
            <DonorRetention
              retained={retention?.retained ?? 0}
              total={retention?.total ?? 0}
              rate={retention?.rate}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "engagement-pulse":
        return (
          <DashboardWidget key={id} id={id} title="Engagement Pulse" subtitle="Stewardship queue health" {...editProps}>
            <EngagementPulseWidget
              pendingTasks={summary?.pendingTasks ?? 0}
              overdueTasks={summary?.overdueTasks ?? 0}
              newDonorsThisMonth={summary?.newDonorsThisMonth ?? 0}
              monthDonationCount={summary?.monthCount ?? 0}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "stewardship-attention":
        return (
          <DashboardWidget key={id} id={id} title="Stewardship Attention" subtitle="Unthanked, lapsed, and welcome follow-up" {...editProps}>
            <StewardshipAttentionWidget newDonorsThisMonth={summary?.newDonorsThisMonth ?? 0} loading={loading} />
          </DashboardWidget>
        );
      case "top-donors":
        return (
          <DashboardWidget key={id} id={id} title="Top Donors" subtitle="By lifetime giving" {...editProps}>
            <TopDonorsWidget />
          </DashboardWidget>
        );
      case "tasks":
        return (
          <DashboardWidget key={id} id={id} title="Tasks" subtitle="Open & upcoming" className="lg:row-span-2" {...editProps}>
            <TasksWidget />
          </DashboardWidget>
        );
      case "meetings":
        return (
          <DashboardWidget key={id} id={id} title="Upcoming Meetings" subtitle="Scheduled donor meetings" {...editProps}>
            <MeetingsWidget />
          </DashboardWidget>
        );
      case "weekly-stats":
        return (
          <DashboardWidget key={id} id={id} title="This Week" subtitle="Donation activity" {...editProps}>
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
    <div className="space-y-2.5">
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dashboard data is partially unavailable. {loadError}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: greeting */}
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">
            {greeting}, {name}!
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening today
          </p>
        </div>

        {/* Right: refresh + layout controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Refresh info */}
          <div className="text-right mr-1">
            <p className="text-xs text-gray-400">
              Refreshed {lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
            {summary?.freshness?.dataThrough && (
              <p className="text-[11px] text-gray-400">
                Data through {new Date(summary.freshness.dataThrough).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={load}
              className="text-xs text-green-600 hover:text-green-700 font-medium mt-0.5 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Lock / unlock toggle */}
          <button
            onClick={() => setLocked((v) => !v)}
            title={locked ? "Dashboard is locked — click to unlock" : "Lock dashboard layout"}
            className={`p-2 rounded-lg border transition-colors ${
              locked
                ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                : "border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {locked ? (
              /* Lock-closed icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              /* Lock-open icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Edit mode toggle */}
          {!editMode ? (
            <button
              onClick={() => { if (!locked) setEditMode(true); }}
              disabled={locked}
              title={locked ? "Unlock to edit layout" : "Edit dashboard layout"}
              className="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 transition-colors border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          ) : (
            <button
              onClick={() => setEditMode(false)}
              className="flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 transition-colors bg-green-600 border-green-600 text-white hover:bg-green-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Done
            </button>
          )}
        </div>
      </div>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
          {/* Info text */}
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-xs sm:text-sm text-green-700 font-medium">
            Editing layout — drag cards in real time or use ↑↓ arrows
          </span>

          {/* Right-side edit actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 border border-green-300 rounded-lg px-2.5 py-1 hover:bg-green-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 9h16M4 13h16M4 17h16" />
              </svg>
              Customize Layout
            </button>
            <button
              onClick={() => setWidgetOrder([...DEFAULT_WIDGET_ORDER])}
              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setHiddenWidgets([])}
              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
            >
              Show All
            </button>
          </div>
        </div>
      )}

      {/* ── Widget grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {visibleWidgetOrder.map((id, idx) => renderWidget(id, idx))}
      </div>

      {/* ── Customize Layout modal ── */}
      {showCustomizeModal && (
        <DashboardLayoutModal
          order={widgetOrder}
          widgetMeta={WIDGET_META}
          initialRevenueProgressSource={revenueProgressSource}
          initialIncludeGrants={includeGrants}
          initialRevenueGoalMode={revenueGoalMode}
          initialManualRevenueGoalAmount={manualRevenueGoalAmount}
          initialHiddenWidgetIds={hiddenWidgets}
          onApply={(newOrder, settings) => {
            setWidgetOrder(newOrder as WidgetId[]);
            setRevenueProgressSource(settings.revenueProgressSource);
            setIncludeGrants(settings.includeGrants);
            setRevenueGoalMode(settings.revenueGoalMode);
            setManualRevenueGoalAmount(settings.manualRevenueGoalAmount);
            setHiddenWidgets(settings.hiddenWidgetIds as WidgetId[]);
          }}
          onClose={() => setShowCustomizeModal(false)}
        />
      )}
    </div>
  );
}
