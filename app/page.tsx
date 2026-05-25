/**
 * Dashboard page — OyamaCRM home screen.
 * Displays a real-time snapshot of org health: revenue, retention, tasks, giving trends,
 * recent donations, and top donors.
 *
 * The default view uses a fixed visual-refresh layout. Legacy widget layout settings
 * remain persisted so the customization modal can continue reading existing preferences.
 */
"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import RevenueProgress from "./components/dashboard/RevenueProgress";
import DonorRetention from "./components/dashboard/DonorRetention";
import TasksWidget from "./components/dashboard/TasksWidget";
import TotalsByLevel from "./components/dashboard/TotalsByLevel";
import DashboardWidget, { type DashboardWidgetSize } from "./components/dashboard/DashboardWidget";
import GivingTrendChart from "./components/dashboard/GivingTrendChart";
import RecentDonationsWidget from "./components/dashboard/RecentDonationsWidget";
import TopDonorsWidget from "./components/dashboard/TopDonorsWidget";
import MeetingsWidget from "./components/dashboard/MeetingsWidget";
import CampaignGoalHealthWidget from "./components/dashboard/CampaignGoalHealthWidget";
import EngagementPulseWidget from "./components/dashboard/EngagementPulseWidget";
import StewardshipAttentionWidget from "./components/dashboard/StewardshipAttentionWidget";
import DonationVelocityWidget from "./components/dashboard/DonationVelocityWidget";
import WorkflowPressureWidget from "./components/dashboard/WorkflowPressureWidget";
import ActionableInsightsWidget from "./components/dashboard/ActionableInsightsWidget";
import FundraisingForecastWidget from "./components/dashboard/FundraisingForecastWidget";
import FollowUpCapacityWidget from "./components/dashboard/FollowUpCapacityWidget";
import AiInsightsWidget from "./components/dashboard/AiInsightsWidget";
import AiOpportunityWidget from "./components/dashboard/AiOpportunityWidget";
import AiChatWidget from "./components/dashboard/AiChatWidget";
import DonorDashboardVisualRefresh from "./components/dashboard/DonorDashboardVisualRefresh";
import EnterprisePageShell from "./components/layout/EnterprisePageShell";
import DashboardLayoutModal, { type RevenueGoalMode, type RevenueProgressSource } from "./components/dashboard/DashboardLayoutModal";
import { apiFetch } from "@/app/lib/auth-client";
import { getStoredReportingYearMode, type ReportingYearMode } from "@/app/lib/fiscal-year";
import MonthlyDonationsWidget from "./components/dashboard/MonthlyDonationsWidget";

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
  "actionable-insights",
  "ai-insights",
  "ai-opportunities",
  "ai-chat",
  "revenue",
  "goal-health",
  "donation-velocity",
  "fundraising-forecast",
  "retention",
  "engagement-pulse",
  "workflow-pressure",
  "follow-up-capacity",
  "stewardship-attention",
  "top-donors",
  "weekly-stats",
  "monthly-donors",
  "giving-trend",
  "recent-donations",
  "tasks",
  "meetings",
] as const;

type WidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];
type DashboardLayoutMode = "GRID" | "MASONRY";
type AutoArrangePreset = "BALANCED" | "ALTERNATING_WIDE" | "FEATURE_FIRST" | "COMPACT";

/** Human-readable label + description for each widget (used in the layout modal) */
const WIDGET_META = [
  { id: "actionable-insights", label: "Actionable Insights", description: "Cross-workspace priorities and quick links" },
  { id: "ai-insights", label: "AI Runtime + Controls", description: "Steward AI status and dashboard AI toggle" },
  { id: "ai-opportunities", label: "AI Opportunities", description: "Top suggested stewardship opportunities" },
  { id: "ai-chat", label: "AI Chat", description: "Compact ask-and-reply Steward assistant" },
  { id: "revenue", label: "Revenue Progress", description: "Active campaign goal tracking" },
  { id: "goal-health", label: "Campaign Goal Health", description: "Goal gap and campaign attainment" },
  { id: "donation-velocity", label: "Donation Velocity", description: "Short-horizon gift speed and average trend" },
  { id: "fundraising-forecast", label: "Fundraising Forecast", description: "Projected year-end pacing toward goal" },
  { id: "retention", label: "Donor Retention", description: "Year-over-year retention rate" },
  { id: "engagement-pulse", label: "Engagement Pulse", description: "Stewardship workload and activity" },
  { id: "workflow-pressure", label: "Workflow Pressure", description: "Follow-up urgency and workload mix" },
  { id: "follow-up-capacity", label: "Follow-Up Capacity", description: "Demand-to-capacity pressure for stewardship work" },
  { id: "stewardship-attention", label: "Stewardship Attention", description: "Who needs follow-up today" },
  { id: "top-donors", label: "Top Donors", description: "By lifetime giving amount" },
  { id: "weekly-stats", label: "This Week", description: "Weekly donation activity summary" },
  { id: "giving-trend", label: "Giving Trend", description: "Monthly giving totals chart" },
  { id: "monthly-donors", label: "This Month's Giving", description: "Running donation total for the current month with donor list" },
  { id: "recent-donations", label: "Recent Donations", description: "Last 8 gifts received" },
  { id: "tasks", label: "Tasks", description: "Open & upcoming staff tasks" },
  { id: "meetings", label: "Upcoming Meetings", description: "Scheduled donor meetings" },
];

const LS_ORDER_KEY = "dashboard-widget-order";
const LS_LOCK_KEY = "dashboard-locked";
const LS_HIDDEN_WIDGETS_KEY = "dashboard-hidden-widgets";
const LS_WIDGET_SIZES_KEY = "dashboard-widget-sizes";
const LS_LAYOUT_MODE_KEY = "dashboard-layout-mode";
const LS_AUTO_ARRANGE_PRESET_KEY = "dashboard-auto-arrange-preset";
/** Persists the "Include Grants in revenue" preference */
const LS_GRANTS_KEY = "dashboard-include-grants";
/** Persists which data source Revenue Progress should display. */
const LS_REVENUE_SOURCE_KEY = "dashboard-revenue-progress-source";
/** Persists whether Revenue Progress goal is automatic or manually overridden. */
const LS_REVENUE_GOAL_MODE_KEY = "dashboard-revenue-goal-mode";
/** Persists manual Revenue Progress goal amount when override mode is enabled. */
const LS_MANUAL_REVENUE_GOAL_KEY = "dashboard-manual-revenue-goal";
/** Persists whether AI-specific dashboard widgets are enabled. */
const LS_AI_WIDGETS_ENABLED_KEY = "dashboard-ai-widgets-enabled";

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
    const parsed = JSON.parse(raw) as string[];
    // If the user still has the old out-of-box order, migrate to the new CRM default.
    if (sameOrder(parsed, PREVIOUS_DEFAULT_WIDGET_ORDER)) {
      return [...DEFAULT_WIDGET_ORDER];
    }
    const validSavedOrder = parsed.filter((id): id is WidgetId => DEFAULT_WIDGET_ORDER.includes(id as WidgetId));
    // Merge: keep saved order, but append any new widgets not yet in the saved list
    const existing = new Set(validSavedOrder);
    return [...validSavedOrder, ...DEFAULT_WIDGET_ORDER.filter((w) => !existing.has(w))];
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

/** Load AI widget visibility preference from localStorage. */
function loadAiWidgetsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_AI_WIDGETS_ENABLED_KEY) !== "false";
}

/** Load dashboard card-flow layout mode preference from localStorage. */
function loadLayoutMode(): DashboardLayoutMode {
  if (typeof window === "undefined") return "MASONRY";
  return localStorage.getItem(LS_LAYOUT_MODE_KEY) === "MASONRY" ? "MASONRY" : "GRID";
}

/** Load auto-arrange visual preset from localStorage. */
function loadAutoArrangePreset(): AutoArrangePreset {
  if (typeof window === "undefined") return "BALANCED";
  const stored = localStorage.getItem(LS_AUTO_ARRANGE_PRESET_KEY);
  if (stored === "ALTERNATING_WIDE" || stored === "FEATURE_FIRST" || stored === "COMPACT") return stored;
  return "BALANCED";
}

const DEFAULT_WIDGET_SIZES: Record<WidgetId, DashboardWidgetSize> = {
  "actionable-insights": "wide",
  "ai-insights": "standard",
  "ai-opportunities": "standard",
  "ai-chat": "standard",
  revenue: "standard",
  "goal-health": "standard",
  "donation-velocity": "standard",
  "fundraising-forecast": "standard",
  retention: "standard",
  "engagement-pulse": "standard",
  "workflow-pressure": "standard",
  "follow-up-capacity": "standard",
  "stewardship-attention": "wide",
  "top-donors": "standard",
  "weekly-stats": "standard",
  "monthly-donors": "standard",
  "giving-trend": "hero",
  "recent-donations": "standard",
  tasks: "wide",
  meetings: "standard",
};

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return value === "compact" || value === "standard" || value === "wide" || value === "hero";
}

/** Load persisted widget size tokens, falling back to the product defaults. */
function loadWidgetSizes(): Record<WidgetId, DashboardWidgetSize> {
  if (typeof window === "undefined") return { ...DEFAULT_WIDGET_SIZES };
  try {
    const raw = localStorage.getItem(LS_WIDGET_SIZES_KEY);
    if (!raw) return { ...DEFAULT_WIDGET_SIZES };
    const parsed = JSON.parse(raw) as Partial<Record<WidgetId, DashboardWidgetSize>>;
    const next = { ...DEFAULT_WIDGET_SIZES };
    DEFAULT_WIDGET_ORDER.forEach((id) => {
      if (isDashboardWidgetSize(parsed[id])) {
        next[id] = parsed[id];
      }
    });
    return next;
  } catch {
    return { ...DEFAULT_WIDGET_SIZES };
  }
}

function getWidgetLayoutClass(size: DashboardWidgetSize): string {
  if (size === "compact") return "xl:col-span-3";
  if (size === "wide") return "xl:col-span-6";
  if (size === "hero") return "xl:col-span-12 min-h-[300px]";
  return "xl:col-span-4";
}

/** Widget class used when masonry flow is enabled. */
function getMasonryWidgetLayoutClass(): string {
  return "w-full";
}

function getAutoArrangePresetLabel(preset: AutoArrangePreset): string {
  if (preset === "ALTERNATING_WIDE") return "Alternating Wide";
  if (preset === "FEATURE_FIRST") return "Feature First";
  if (preset === "COMPACT") return "Compact Tiles";
  return "Balanced";
}

function getAutoArrangeWidgetLayoutClass(id: WidgetId, idx: number, preset: AutoArrangePreset): string {
  const isHeroContent = id === "giving-trend";
  const isPriorityFeature = id === "stewardship-attention";

  if (isHeroContent) {
    return "md:col-span-2 xl:col-span-4 min-h-[280px]";
  }

  if (preset === "ALTERNATING_WIDE") {
    return idx % 2 === 0 ? "xl:col-span-3" : "xl:col-span-2";
  }

  if (preset === "FEATURE_FIRST") {
    if (idx < 3 || isPriorityFeature) return "md:col-span-2 xl:col-span-3";
    return "xl:col-span-2";
  }

  if (preset === "COMPACT") {
    return isPriorityFeature ? "md:col-span-2 xl:col-span-3" : "xl:col-span-2";
  }

  if (isPriorityFeature) return "md:col-span-2 xl:col-span-3";
  return "xl:col-span-2";
}

/** Shared section container class for grid or masonry flow. */
function getSectionLayoutClass(layoutMode: DashboardLayoutMode): string {
  if (layoutMode === "MASONRY") {
    return "grid grid-cols-1 gap-4 grid-flow-row-dense md:grid-cols-2 xl:grid-cols-6";
  }
  return "grid grid-cols-1 gap-4 grid-flow-row-dense xl:grid-cols-12";
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString()}`;
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
  const [locked] = useState(loadLocked);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [aiWidgetsEnabled, setAiWidgetsEnabled] = useState(loadAiWidgetsEnabled);
  const [layoutMode] = useState<DashboardLayoutMode>(loadLayoutMode);
  const [autoArrangePreset] = useState<AutoArrangePreset>(loadAutoArrangePreset);
  const [widgetSizes, setWidgetSizes] = useState<Record<WidgetId, DashboardWidgetSize>>(loadWidgetSizes);
  const [reportingYearMode, setReportingYearMode] = useState<ReportingYearMode>(getStoredReportingYearMode);
  const enableAiWidgets = () => setAiWidgetsEnabled(true);

  // ── Grant toggle — persisted to localStorage ──
  const [includeGrants, setIncludeGrants] = useState(loadIncludeGrants);
  const toggleGrants = () => setIncludeGrants((v) => !v);
  const [revenueProgressSource, setRevenueProgressSource] = useState<RevenueProgressSource>(loadRevenueProgressSource);
  const [revenueGoalMode, setRevenueGoalMode] = useState<RevenueGoalMode>(loadRevenueGoalMode);
  const [manualRevenueGoalAmount, setManualRevenueGoalAmount] = useState<number>(loadManualRevenueGoalAmount);

  // ── Drag state (only active in edit mode) ──
  const dragFrom = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const visibleWidgetOrder = widgetOrder.filter((id) => !hiddenWidgets.includes(id));
  const effectiveLayoutMode: DashboardLayoutMode = editMode ? "GRID" : layoutMode;
  const sectionLayoutClassName = getSectionLayoutClass(effectiveLayoutMode);

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  /** Fetch all dashboard data in parallel */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const dateBasisQuery = reportingYearMode === "fiscal" ? "?dateBasis=fiscal" : "";
      const [s, r] = await Promise.all([
        apiFetch<Summary>(`/api/reports/summary${dateBasisQuery}`),
        apiFetch<RetentionData>(`/api/reports/donor-retention${dateBasisQuery}`),
      ]);
      setSummary(s);
      setRetention(r);
      setLastRefreshed(new Date());
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [reportingYearMode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleReportingModeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ReportingYearMode }>).detail;
      setReportingYearMode(detail?.mode === "fiscal" ? "fiscal" : "calendar");
    };
    window.addEventListener("reporting-year-mode:changed", handleReportingModeChange);
    return () => {
      window.removeEventListener("reporting-year-mode:changed", handleReportingModeChange);
    };
  }, []);

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

  // Persist dashboard AI widget enablement preference to localStorage
  useEffect(() => {
    localStorage.setItem(LS_AI_WIDGETS_ENABLED_KEY, aiWidgetsEnabled ? "true" : "false");
  }, [aiWidgetsEnabled]);

  // Persist dashboard flow layout preference to localStorage.
  useEffect(() => {
    localStorage.setItem(LS_LAYOUT_MODE_KEY, layoutMode);
  }, [layoutMode]);

  // Persist auto-arrange composition preset independently from layout mode.
  useEffect(() => {
    localStorage.setItem(LS_AUTO_ARRANGE_PRESET_KEY, autoArrangePreset);
  }, [autoArrangePreset]);

  // Persist modular widget sizing independently from widget order.
  useEffect(() => {
    localStorage.setItem(LS_WIDGET_SIZES_KEY, JSON.stringify(widgetSizes));
  }, [widgetSizes]);

  const autoGoal = summary?.activeGoalTotal ?? 0;
  const dynamicFallbackGoal = Math.max(autoGoal, summary?.ytdAmount ?? 0, 1000);
  const revenueGoal = revenueGoalMode === "MANUAL"
    ? Math.max(1, manualRevenueGoalAmount)
    : dynamicFallbackGoal;
  const dataThroughLabel = summary?.freshness?.dataThrough
    ? `Data through ${new Date(summary.freshness.dataThrough).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : `Refreshed ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

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
  function handleDragStart(idx: number) {
    dragFrom.current = idx;
    setDraggingIdx(idx);
  }

  function resizeWidget(id: WidgetId, size: DashboardWidgetSize) {
    setWidgetSizes((current) => ({ ...current, [id]: size }));
  }
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
    setDraggingIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    dragFrom.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  /** Build drag event props object for a widget at the given index */
  function dragProps(idx: number) {
    return {
      onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; handleDragStart(idx); },
      onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
      onDrop: () => handleDrop(idx),
      onDragEnd: handleDragEnd,
      isDragging: draggingIdx === idx,
      isDragOver: dragOverIdx === idx && draggingIdx !== idx,
    };
  }

  const topKpiWidgets: WidgetId[] = ["revenue", "goal-health", "donation-velocity", "fundraising-forecast", "retention", "engagement-pulse", "workflow-pressure", "follow-up-capacity"];
  const stewardshipWidgets: WidgetId[] = ["actionable-insights", "stewardship-attention"];
  const intelligenceWidgets: WidgetId[] = ["ai-insights", "ai-opportunities", "ai-chat"];
  const weeklyWidgets: WidgetId[] = ["weekly-stats", "recent-donations"];
  const monthlyWidgets: WidgetId[] = ["monthly-donors", "giving-trend"];
  const otherWidgets: WidgetId[] = ["top-donors", "tasks", "meetings"];

  const visibleTopKpiWidgets = visibleSectionWidgets(topKpiWidgets);
  const visibleWeeklyWidgets = visibleSectionWidgets(weeklyWidgets);
  const visibleMonthlyWidgets = visibleSectionWidgets(monthlyWidgets);
  const visibleStewardshipWidgets = visibleSectionWidgets(stewardshipWidgets);
  const visibleIntelligenceWidgets = visibleSectionWidgets(intelligenceWidgets);
  const visibleOtherWidgets = visibleSectionWidgets(otherWidgets);

  function visibleSectionWidgets(ids: WidgetId[]) {
    return ids.filter((id) => visibleWidgetOrder.includes(id));
  }

  function renderWidgetById(id: WidgetId) {
    return renderWidget(id, visibleWidgetOrder.indexOf(id));
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
      size: widgetSizes[id],
      onResize: (size: DashboardWidgetSize) => resizeWidget(id, size),
      layoutClassName: effectiveLayoutMode === "MASONRY"
        ? `${getMasonryWidgetLayoutClass()} ${getAutoArrangeWidgetLayoutClass(id, idx, autoArrangePreset)}`
        : getWidgetLayoutClass(widgetSizes[id]),
      ...(editMode ? dragProps(idx) : {}),
    };

    switch (id) {
      case "actionable-insights":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="Actionable Insights"
            subtitle="Cross-workspace priorities with direct action links"
            {...editProps}
          >
            <ActionableInsightsWidget />
          </DashboardWidget>
        );
      case "ai-insights":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="AI Runtime + Controls"
            subtitle="Steward status plus dashboard AI widget toggle"
            {...editProps}
          >
            <AiInsightsWidget
              dashboardEnabled={aiWidgetsEnabled}
              onToggleDashboardEnabled={(next) => setAiWidgetsEnabled(next)}
            />
          </DashboardWidget>
        );
      case "ai-opportunities":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="AI Opportunities"
            subtitle="Suggested stewardship opportunities"
            {...editProps}
          >
            <AiOpportunityWidget dashboardEnabled={aiWidgetsEnabled} onEnableDashboardAi={enableAiWidgets} />
          </DashboardWidget>
        );
      case "ai-chat":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="AI Chat"
            subtitle="Ask Steward for fast donor guidance"
            {...editProps}
          >
            <AiChatWidget dashboardEnabled={aiWidgetsEnabled} onEnableDashboardAi={enableAiWidgets} />
          </DashboardWidget>
        );
      case "monthly-donors":
        return (
          <DashboardWidget key={id} id={id} title="This Month's Giving" subtitle="Running total · click to see donors" {...editProps}>
            <MonthlyDonationsWidget />
          </DashboardWidget>
        );
      case "giving-trend":
        return (
          <DashboardWidget key={id} id={id} title="Giving Trend" subtitle={reportingYearMode === "fiscal" ? "Fiscal year monthly totals" : `${new Date().getFullYear()} monthly totals`} className="min-h-[250px]" {...editProps}>
            <GivingTrendChart includeGrants={includeGrants} dateBasis={reportingYearMode} />
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
      case "donation-velocity":
        return (
          <DashboardWidget key={id} id={id} title="Donation Velocity" subtitle="Gift speed and average size trend" {...editProps}>
            <DonationVelocityWidget
              weekAmount={summary?.weekAmount ?? 0}
              weekCount={summary?.weekCount ?? 0}
              monthAmount={summary?.monthAmount ?? 0}
              monthCount={summary?.monthCount ?? 0}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "fundraising-forecast":
        return (
          <DashboardWidget key={id} id={id} title="Fundraising Forecast" subtitle="Projected year-end pace" {...editProps}>
            <FundraisingForecastWidget
              ytdAmount={summary?.ytdAmount ?? 0}
              monthAmount={summary?.monthAmount ?? 0}
              revenueGoal={revenueGoal}
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
      case "workflow-pressure":
        return (
          <DashboardWidget key={id} id={id} title="Workflow Pressure" subtitle="Queue urgency and follow-up load" {...editProps}>
            <WorkflowPressureWidget
              pendingTasks={summary?.pendingTasks ?? 0}
              overdueTasks={summary?.overdueTasks ?? 0}
              newDonorsThisMonth={summary?.newDonorsThisMonth ?? 0}
              retentionRate={retention?.rate ?? 0}
              loading={loading}
            />
          </DashboardWidget>
        );
      case "follow-up-capacity":
        return (
          <DashboardWidget key={id} id={id} title="Follow-Up Capacity" subtitle="Demand vs team throughput" {...editProps}>
            <FollowUpCapacityWidget
              pendingTasks={summary?.pendingTasks ?? 0}
              overdueTasks={summary?.overdueTasks ?? 0}
              newDonorsThisMonth={summary?.newDonorsThisMonth ?? 0}
              monthCount={summary?.monthCount ?? 0}
              loading={loading}
            />
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
          <DashboardWidget key={id} id={id} title="Tasks" subtitle="Open & upcoming" {...editProps}>
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
    <EnterprisePageShell maxWidthClassName="max-w-[1560px]">
      <div className="space-y-5">
        <DonorDashboardVisualRefresh
          greeting={greeting}
          name={name}
          loading={loading}
          dataThroughLabel={dataThroughLabel}
          totalConstituents={summary?.totalConstituents ?? 0}
          ytdAmount={summary?.ytdAmount ?? 0}
          ytdCount={summary?.ytdCount ?? 0}
          weekAmount={summary?.weekAmount ?? 0}
          weekCount={summary?.weekCount ?? 0}
          monthAmount={summary?.monthAmount ?? 0}
          monthTrend={summary?.momTrend ?? null}
          revenueGoal={revenueGoal}
          retentionRate={retention?.rate ?? 0}
          retentionRetained={retention?.retained ?? 0}
          retentionTotal={retention?.total ?? 0}
          pendingTasks={summary?.pendingTasks ?? 0}
          overdueTasks={summary?.overdueTasks ?? 0}
          activeCampaigns={summary?.activeCampaigns ?? 0}
          newDonorsThisMonth={summary?.newDonorsThisMonth ?? 0}
          reportingYearMode={reportingYearMode}
          includeGrants={includeGrants}
          onRefresh={() => void load()}
          onCustomize={() => setShowCustomizeModal(true)}
        />

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dashboard data is partially unavailable. {loadError}
        </div>
      )}

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
          {layoutMode === "MASONRY" ? (
            <span className="text-[11px] text-green-700/90">
              Masonry view is paused while editing.
            </span>
          ) : null}

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
              onClick={() => {
                setWidgetOrder([...DEFAULT_WIDGET_ORDER]);
                setWidgetSizes({ ...DEFAULT_WIDGET_SIZES });
              }}
              className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
            >
              Reset Layout
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

      {!loading && !summary && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-blue-900">No dashboard data yet</h2>
          <p className="text-sm text-blue-800 mt-1">
            Start by adding a donor and recording your first donation, then refresh this page to load live metrics.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/constituents" className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Add donor
            </Link>
            <Link href="/donations/new" className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Record donation
            </Link>
            <button onClick={() => void load()} className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Refresh dashboard
            </button>
          </div>
        </section>
      )}

      {editMode ? (layoutMode === "MASONRY" ? (
        <section id="dashboard-overview" className="scroll-mt-28 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Auto Arrange Canvas</h2>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Free-flow layout
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {getAutoArrangePresetLabel(autoArrangePreset)}
            </span>
          </div>
          <div className={sectionLayoutClassName}>
            {visibleWidgetOrder.map(renderWidgetById)}
          </div>
        </section>
      ) : (
        <>
          {visibleTopKpiWidgets.length > 0 ? (
            <section id="dashboard-overview" className="scroll-mt-28 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
              <div className={sectionLayoutClassName}>
                {visibleTopKpiWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}

          {visibleWeeklyWidgets.length > 0 ? (
            <section id="dashboard-weekly" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">This Week</h2>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {loading ? "—" : `${formatUsd(summary?.weekAmount ?? 0)} · ${summary?.weekCount ?? 0} gift${(summary?.weekCount ?? 0) === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className={sectionLayoutClassName}>
                {visibleWeeklyWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}

          {visibleMonthlyWidgets.length > 0 ? (
            <section id="dashboard-monthly" className="scroll-mt-28 space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">This Month</h2>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {loading ? "—" : formatUsd(summary?.monthAmount ?? 0)}
                </span>
                {!loading && (summary?.momTrend ?? null) !== null && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${(summary?.momTrend ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {(summary?.momTrend ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(Math.round(summary?.momTrend ?? 0))}% vs last month
                  </span>
                )}
              </div>
              <div className={sectionLayoutClassName}>
                {visibleMonthlyWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}

          {visibleStewardshipWidgets.length > 0 ? (
            <section id="dashboard-stewardship" className="scroll-mt-28 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stewardship And Actions</h2>
              <div className={sectionLayoutClassName}>
                {visibleStewardshipWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}

          {visibleIntelligenceWidgets.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Steward Intelligence</h2>
              <div className={sectionLayoutClassName}>
                {visibleIntelligenceWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}

          {visibleOtherWidgets.length > 0 ? (
            <section id="dashboard-other" className="scroll-mt-28 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Other</h2>
              <div className={sectionLayoutClassName}>
                {visibleOtherWidgets.map(renderWidgetById)}
              </div>
            </section>
          ) : null}
        </>
      )) : null}

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
          initialWidgetSizes={widgetSizes}
          onApply={(newOrder, settings) => {
            setWidgetOrder(newOrder as WidgetId[]);
            setRevenueProgressSource(settings.revenueProgressSource);
            setIncludeGrants(settings.includeGrants);
            setRevenueGoalMode(settings.revenueGoalMode);
            setManualRevenueGoalAmount(settings.manualRevenueGoalAmount);
            setHiddenWidgets(settings.hiddenWidgetIds as WidgetId[]);
            setWidgetSizes({ ...DEFAULT_WIDGET_SIZES, ...(settings.widgetSizes as Partial<Record<WidgetId, DashboardWidgetSize>>) });
          }}
          onClose={() => setShowCustomizeModal(false)}
        />
      )}
      </div>
    </EnterprisePageShell>
  );
}

