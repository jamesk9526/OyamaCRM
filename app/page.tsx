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
import ActionableInsightsWidget from "./components/dashboard/ActionableInsightsWidget";
import AiInsightsWidget from "./components/dashboard/AiInsightsWidget";
import AiOpportunityWidget from "./components/dashboard/AiOpportunityWidget";
import AiChatWidget from "./components/dashboard/AiChatWidget";
import EnterprisePageShell from "./components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar from "./components/layout/WorkspaceBreadcrumbBar";
import WorkspaceHelpTip from "./components/ui/WorkspaceHelpTip";
import WorkspaceRibbon from "./components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "./components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "./components/workspace-ribbon/WorkspaceRibbonGroup";
import DashboardLayoutModal, { type RevenueGoalMode, type RevenueProgressSource } from "./components/dashboard/DashboardLayoutModal";
import { apiFetch } from "@/app/lib/auth-client";
import { getStoredReportingYearMode, type ReportingYearMode } from "@/app/lib/fiscal-year";
import StewardContextButton from "@/app/components/ai/StewardContextButton";

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

interface StartHereAction {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

interface DashboardFocusItem {
  id: string;
  title: string;
  value: string;
  description: string;
  href: string;
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
  "start-here",
  "todays-focus",
  "actionable-insights",
  "ai-insights",
  "ai-opportunities",
  "ai-chat",
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
type DashboardLayoutMode = "GRID" | "MASONRY";

/** Human-readable label + description for each widget (used in the layout modal) */
const WIDGET_META = [
  { id: "start-here", label: "Start Here", description: "Guided first actions for daily work" },
  { id: "todays-focus", label: "Today's Focus", description: "Plain-language priority snapshot" },
  { id: "actionable-insights", label: "Actionable Insights", description: "Cross-workspace priorities and quick links" },
  { id: "ai-insights", label: "AI Runtime + Controls", description: "Steward AI status and dashboard AI toggle" },
  { id: "ai-opportunities", label: "AI Opportunities", description: "Top suggested stewardship opportunities" },
  { id: "ai-chat", label: "AI Chat", description: "Compact ask-and-reply Steward assistant" },
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

const START_HERE_ACTIONS: StartHereAction[] = [
  {
    id: "add-donor",
    title: "Add a donor",
    description: "Create or update a donor profile before recording gifts or follow-up work.",
    href: "/constituents",
    actionLabel: "Open Constituents",
  },
  {
    id: "record-donation",
    title: "Record a donation",
    description: "Capture a gift so reporting, receipts, and stewardship tasks stay accurate.",
    href: "/donations/new",
    actionLabel: "Open Donation Entry",
  },
  {
    id: "send-thank-you",
    title: "Send a thank-you",
    description: "Create an email or printable letter for a donor gift acknowledgement.",
    href: "/communications/new/type",
    actionLabel: "Start Communication",
  },
  {
    id: "create-task",
    title: "Create a task",
    description: "Assign follow-up work so important donor outreach does not get missed.",
    href: "/tasks",
    actionLabel: "Open Tasks",
  },
  {
    id: "todays-followups",
    title: "View today's follow-ups",
    description: "Review overdue and pending work to prioritize urgent donor touchpoints.",
    href: "/tasks",
    actionLabel: "Review Follow-Ups",
  },
  {
    id: "create-campaign",
    title: "Create a campaign",
    description: "Launch a fundraising campaign with clear goals, timeline, and ownership.",
    href: "/campaigns",
    actionLabel: "Open Campaigns",
  },
  {
    id: "generate-letters",
    title: "Generate letters",
    description: "Prepare printable letters for acknowledgements, appeals, and stewardship updates.",
    href: "/letters-printables/generate",
    actionLabel: "Open Generator",
  },
  {
    id: "check-notifications",
    title: "Check notifications",
    description: "Review unread alerts for tasks, campaigns, and donor follow-up actions.",
    href: "/tasks",
    actionLabel: "Open Work Queue",
  },
  {
    id: "ask-steward",
    title: "Ask Steward",
    description: "Review suggested donor next steps with evidence and human approval controls.",
    href: "/steward-signals",
    actionLabel: "Open Steward Signals",
  },
  {
    id: "import-data",
    title: "Import data",
    description: "Upload and map donor records, then validate duplicates before final import.",
    href: "/data-tools/import",
    actionLabel: "Open Import Tool",
  },
  {
    id: "review-reports",
    title: "Review reports",
    description: "Check fundraising progress, retention, and campaign outcomes with live data.",
    href: "/reports/donor-crm",
    actionLabel: "Open Reports",
  },
];

const LS_ORDER_KEY = "dashboard-widget-order";
const LS_LOCK_KEY = "dashboard-locked";
const LS_HIDDEN_WIDGETS_KEY = "dashboard-hidden-widgets";
const LS_WIDGET_SIZES_KEY = "dashboard-widget-sizes";
const LS_LAYOUT_MODE_KEY = "dashboard-layout-mode";
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

/** Load AI widget visibility preference from localStorage. */
function loadAiWidgetsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_AI_WIDGETS_ENABLED_KEY) !== "false";
}

/** Load dashboard card-flow layout mode preference from localStorage. */
function loadLayoutMode(): DashboardLayoutMode {
  if (typeof window === "undefined") return "GRID";
  return localStorage.getItem(LS_LAYOUT_MODE_KEY) === "MASONRY" ? "MASONRY" : "GRID";
}

const DEFAULT_WIDGET_SIZES: Record<WidgetId, DashboardWidgetSize> = {
  "start-here": "wide",
  "todays-focus": "wide",
  "actionable-insights": "wide",
  "ai-insights": "standard",
  "ai-opportunities": "standard",
  "ai-chat": "standard",
  revenue: "standard",
  "goal-health": "standard",
  retention: "standard",
  "engagement-pulse": "standard",
  "stewardship-attention": "wide",
  "top-donors": "standard",
  "weekly-stats": "standard",
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
  return "mb-4 w-full break-inside-avoid";
}

/** Shared section container class for grid or masonry flow. */
function getSectionLayoutClass(layoutMode: DashboardLayoutMode): string {
  if (layoutMode === "MASONRY") {
    return "columns-1 [column-gap:1rem] md:columns-2 xl:columns-3 2xl:columns-4";
  }
  return "grid grid-cols-1 gap-4 xl:grid-cols-12";
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
  const [locked, setLocked] = useState(loadLocked);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [aiWidgetsEnabled, setAiWidgetsEnabled] = useState(loadAiWidgetsEnabled);
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>(loadLayoutMode);
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

  // Persist modular widget sizing independently from widget order.
  useEffect(() => {
    localStorage.setItem(LS_WIDGET_SIZES_KEY, JSON.stringify(widgetSizes));
  }, [widgetSizes]);

  const autoGoal = summary?.activeGoalTotal ?? 0;
  const dynamicFallbackGoal = Math.max(autoGoal, summary?.ytdAmount ?? 0, 1000);
  const revenueGoal = revenueGoalMode === "MANUAL"
    ? Math.max(1, manualRevenueGoalAmount)
    : dynamicFallbackGoal;

  const workSnapshot: DashboardFocusItem[] = [
    {
      id: "today-work",
      title: "Today's Work",
      value: `${summary?.pendingTasks ?? 0} open tasks`,
      description: "Open assignments and due follow-ups.",
      href: "/tasks",
    },
    {
      id: "needs-attention",
      title: "Needs Attention",
      value: `${summary?.overdueTasks ?? 0} overdue tasks`,
      description: "Urgent items that need immediate action.",
      href: "/tasks",
    },
    {
      id: "recent-giving",
      title: "Recent Giving",
      value: formatUsd(summary?.monthAmount ?? 0),
      description: "Donations recorded this month.",
      href: "/donations",
    },
    {
      id: "follow-up-queue",
      title: "Follow-Up Queue",
      value: `${summary?.newDonorsThisMonth ?? 0} new donors`,
      description: "Donors who may need welcome and thank-you outreach.",
      href: "/steward-signals",
    },
    {
      id: "campaign-snapshot",
      title: "Campaign Snapshot",
      value: `${summary?.activeCampaigns ?? 0} active campaigns`,
      description: "Current campaign load and progress context.",
      href: "/campaigns",
    },
    {
      id: "steward-recommendations",
      title: "Steward Recommendations",
      value: `${(summary?.overdueTasks ?? 0) + (summary?.newDonorsThisMonth ?? 0)} priority signals`,
      description: "Suggested next actions for stewardship follow-through.",
      href: "/steward-signals",
    },
  ];

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

  const topKpiWidgets: WidgetId[] = ["revenue", "goal-health", "retention", "engagement-pulse"];
  const stewardshipWidgets: WidgetId[] = ["start-here", "todays-focus", "actionable-insights", "stewardship-attention"];
  const intelligenceWidgets: WidgetId[] = ["ai-insights", "ai-opportunities", "ai-chat"];
  const analyticsWidgets: WidgetId[] = ["giving-trend", "top-donors", "weekly-stats"];
  const activityWidgets: WidgetId[] = ["recent-donations", "tasks", "meetings"];

  function scrollToDashboardSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        ? getMasonryWidgetLayoutClass()
        : getWidgetLayoutClass(widgetSizes[id]),
      ...(editMode ? dragProps(idx) : {}),
    };

    switch (id) {
      case "start-here":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="Start Here"
            subtitle="Choose a common action to begin your day"
            {...editProps}
          >
            <DashboardStartHereWidget />
          </DashboardWidget>
        );
      case "todays-focus":
        return (
          <DashboardWidget
            key={id}
            id={id}
            title="Today's Focus"
            subtitle="A plain-language snapshot of what matters most right now"
            {...editProps}
          >
            <DashboardTodaysFocusWidget items={workSnapshot} loading={loading} />
          </DashboardWidget>
        );
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
    <EnterprisePageShell
      ribbon={(
        <div className="space-y-3">
          <WorkspaceBreadcrumbBar
            items={[
              { label: "DonorCRM", href: "/" },
              { label: "Dashboard" },
            ]}
            statusLabel={locked ? "Layout locked" : editMode ? "Editing layout" : reportingYearMode === "fiscal" ? "Fiscal year mode" : "Calendar year mode"}
            metadata={`Refreshed ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            primaryAction={<WorkspaceRibbonButton label="New Constituent" href="/constituents/new" variant="primary" />}
            overflowActions={<WorkspaceRibbonButton label="Record Gift" href="/donations/new" />}
          />
          <WorkspaceRibbon>
            <WorkspaceRibbonGroup label="Views">
              <WorkspaceRibbonButton label="Overview" onClick={() => scrollToDashboardSection("dashboard-overview")} variant="primary" />
              <WorkspaceRibbonButton label="Stewardship" onClick={() => scrollToDashboardSection("dashboard-stewardship")} />
              <WorkspaceRibbonButton label="Giving" onClick={() => scrollToDashboardSection("dashboard-analytics")} />
              <WorkspaceRibbonButton label="Activity" onClick={() => scrollToDashboardSection("dashboard-activity")} />
            </WorkspaceRibbonGroup>
            <WorkspaceRibbonGroup label="Create">
              <WorkspaceRibbonButton label="New Task" href="/tasks" />
              <WorkspaceRibbonButton label="Campaign" href="/campaigns" />
              <WorkspaceRibbonButton label="Letter" href="/letters-printables/generate" />
            </WorkspaceRibbonGroup>
            <WorkspaceRibbonGroup label="Steward">
              <StewardContextButton
                label="Summarize dashboard"
                prompt={`Summarize the current state of our fundraising dashboard. Key stats: YTD Revenue $${(summary?.ytdAmount ?? 0).toLocaleString()}, ${summary?.totalConstituents ?? 0} total constituents, ${summary?.pendingTasks ?? 0} open tasks, ${summary?.activeCampaigns ?? 0} active campaigns. What is the overall fundraising health and what should I focus on today?`}
                moduleKey="donor"
                mode="ask"
                variant="mini"
                className="py-1"
              />
              <StewardContextButton
                label="Identify risks"
                prompt={`Analyze our fundraising dashboard and identify key risks. YTD: $${(summary?.ytdAmount ?? 0).toLocaleString()}, Retention: ${retention?.rate ?? "?"}%, Overdue tasks: ${summary?.overdueTasks ?? 0}. What specific risks should we address this week?`}
                moduleKey="donor"
                mode="analyze"
                variant="mini"
                className="py-1"
              />
            </WorkspaceRibbonGroup>
            <WorkspaceRibbonGroup label="Dashboard">
              <WorkspaceRibbonButton label="Refresh" onClick={() => void load()} />
              {!editMode ? (
                <WorkspaceRibbonButton label="Edit Layout" onClick={() => { if (!locked) setEditMode(true); }} disabled={locked} />
              ) : (
                <WorkspaceRibbonButton label="Done" onClick={() => setEditMode(false)} variant="primary" />
              )}
              <WorkspaceRibbonButton label={locked ? "Unlock" : "Lock"} onClick={() => setLocked((value) => !value)} />
              <WorkspaceRibbonButton label="Customize" onClick={() => setShowCustomizeModal(true)} />
              <WorkspaceRibbonButton
                label="Masonry"
                onClick={() => setLayoutMode((current) => (current === "MASONRY" ? "GRID" : "MASONRY"))}
                active={layoutMode === "MASONRY"}
                disabled={editMode}
                title={editMode ? "Exit edit mode to change layout flow" : "Toggle free-flow masonry layout"}
              />
              <WorkspaceRibbonButton label="Reset Sizes" onClick={() => setWidgetSizes({ ...DEFAULT_WIDGET_SIZES })} disabled={locked} />
            </WorkspaceRibbonGroup>
          </WorkspaceRibbon>
        </div>
      )}
    >
      <div className="space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-950">
              {greeting}, {name}!
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              What&apos;s happening with your fundraising work today.
            </p>
          </div>
          {summary?.freshness?.dataThrough ? (
            <p className="text-xs text-slate-500">
              Data through {new Date(summary.freshness.dataThrough).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          ) : null}
        </section>

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

      <section id="dashboard-overview" className="scroll-mt-28 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
        <div className={sectionLayoutClassName}>
          {visibleSectionWidgets(topKpiWidgets).map(renderWidgetById)}
        </div>
      </section>

      <section id="dashboard-stewardship" className="scroll-mt-28 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Stewardship And Actions</h2>
        <div className={sectionLayoutClassName}>
          {visibleSectionWidgets(stewardshipWidgets).map(renderWidgetById)}
        </div>
      </section>

      {visibleSectionWidgets(intelligenceWidgets).length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Steward Intelligence</h2>
          <div className={sectionLayoutClassName}>
            {visibleSectionWidgets(intelligenceWidgets).map(renderWidgetById)}
          </div>
        </section>
      ) : null}

      <section id="dashboard-analytics" className="scroll-mt-28 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Giving Analytics</h2>
        <div className={sectionLayoutClassName}>
          {visibleSectionWidgets(analyticsWidgets).map(renderWidgetById)}
        </div>
      </section>

      <section id="dashboard-activity" className="scroll-mt-28 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Activity</h2>
        <div className={sectionLayoutClassName}>
          {visibleSectionWidgets(activityWidgets).map(renderWidgetById)}
        </div>
      </section>

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

interface DashboardStartHereCardProps {
  action: StartHereAction;
  compact?: boolean;
}

/** DashboardStartHereWidget renders guided "first action" cards for staff onboarding and daily work. */
function DashboardStartHereWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-600">
          Choose a common action to begin your day. Each card opens a guided workspace.
        </p>
        <WorkspaceHelpTip
          title="What is Start Here?"
          summary="Common daily actions"
          body="Use Start Here when you are not sure which workspace to open first. It is built for day-to-day nonprofit tasks."
          example="Send a thank-you: create an email or printable letter for a recent donation."
          href="/help?scope=donor&scopePath=/"
          hrefLabel="Open donor help guides"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {START_HERE_ACTIONS.slice(0, 8).map((action) => (
          <DashboardStartHereCard key={action.id} action={action} compact />
        ))}
      </div>
    </div>
  );
}

interface DashboardTodaysFocusWidgetProps {
  items: DashboardFocusItem[];
  loading: boolean;
}

/** DashboardTodaysFocusWidget renders a concise priority summary for day-to-day staff work. */
function DashboardTodaysFocusWidget({ items, loading }: DashboardTodaysFocusWidgetProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-600">
          A plain-language snapshot of what matters most right now.
        </p>
        <WorkspaceHelpTip
          title="How to use this section"
          summary="Read this first"
          body="Use these cards to choose your next workspace quickly. Each card links to a page where you can take action safely."
          example="If Needs Attention shows overdue tasks, open Tasks and clear urgent follow-ups first."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-green-300 transition-colors p-2.5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.title}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{loading ? "Loading..." : item.value}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** DashboardStartHereCard renders a guided first-action card with one clear CTA. */
function DashboardStartHereCard({ action, compact = false }: DashboardStartHereCardProps) {
  return (
    <DashboardStartHereCardContent action={action} compact={compact} />
  );
}

interface DashboardStartHereCardContentProps {
  action: StartHereAction;
  compact: boolean;
}

/** DashboardStartHereCardContent supports full and compact card layouts. */
function DashboardStartHereCardContent({ action, compact }: DashboardStartHereCardContentProps) {
  return (
    <Link
      href={action.href}
      className={`rounded-lg border border-green-200 bg-white hover:border-green-400 hover:bg-green-50/50 transition-colors ${compact ? "p-2.5" : "p-3"}`}
    >
      <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gray-900`}>{action.title}</p>
      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{action.description}</p>
      <p className="text-xs font-semibold text-green-700 mt-2">{action.actionLabel}</p>
    </Link>
  );
}
