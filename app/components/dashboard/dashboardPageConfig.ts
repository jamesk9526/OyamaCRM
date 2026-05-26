/**
 * Shared dashboard page config, storage keys, and layout helpers.
 * Keeping this logic in one module makes the dashboard page route easier to maintain.
 */

import type { DashboardWidgetSize } from "./DashboardWidget";
import type { RevenueGoalMode, RevenueProgressSource } from "./DashboardLayoutModal";

/** Shape returned by /api/reports/summary (extended) */
export interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  /** YTD awarded grant total - always returned; added to ytdAmount when includeGrants=true */
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

export interface RetentionData {
  total: number;
  retained: number;
  rate: number;
}

/** Previous shipped default order (kept to support one-time migration logic). */
export const PREVIOUS_DEFAULT_WIDGET_ORDER = [
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
export const DEFAULT_WIDGET_ORDER = [
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

export type WidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];
export type DashboardLayoutMode = "GRID" | "MASONRY";
export type AutoArrangePreset = "BALANCED" | "ALTERNATING_WIDE" | "FEATURE_FIRST" | "COMPACT";

type WidgetMeta = {
  id: WidgetId;
  label: string;
  description: string;
};

/** Human-readable label + description for each widget (used in the layout modal). */
export const WIDGET_META: WidgetMeta[] = [
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

export const LS_ORDER_KEY = "dashboard-widget-order";
export const LS_LOCK_KEY = "dashboard-locked";
export const LS_HIDDEN_WIDGETS_KEY = "dashboard-hidden-widgets";
export const LS_WIDGET_SIZES_KEY = "dashboard-widget-sizes";
export const LS_LAYOUT_MODE_KEY = "dashboard-layout-mode";
export const LS_AUTO_ARRANGE_PRESET_KEY = "dashboard-auto-arrange-preset";
/** Persists the "Include Grants in revenue" preference. */
export const LS_GRANTS_KEY = "dashboard-include-grants";
/** Persists which data source Revenue Progress should display. */
export const LS_REVENUE_SOURCE_KEY = "dashboard-revenue-progress-source";
/** Persists whether Revenue Progress goal is automatic or manually overridden. */
export const LS_REVENUE_GOAL_MODE_KEY = "dashboard-revenue-goal-mode";
/** Persists manual Revenue Progress goal amount when override mode is enabled. */
export const LS_MANUAL_REVENUE_GOAL_KEY = "dashboard-manual-revenue-goal";
/** Persists whether AI-specific dashboard widgets are enabled. */
export const LS_AI_WIDGETS_ENABLED_KEY = "dashboard-ai-widgets-enabled";

export const DEFAULT_WIDGET_SIZES: Record<WidgetId, DashboardWidgetSize> = {
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

export const TOP_KPI_WIDGETS: WidgetId[] = [
  "revenue",
  "goal-health",
  "donation-velocity",
  "fundraising-forecast",
  "retention",
  "engagement-pulse",
  "workflow-pressure",
  "follow-up-capacity",
];

export const STEWARDSHIP_WIDGETS: WidgetId[] = ["actionable-insights", "stewardship-attention"];
export const INTELLIGENCE_WIDGETS: WidgetId[] = ["ai-insights", "ai-opportunities", "ai-chat"];
export const WEEKLY_WIDGETS: WidgetId[] = ["weekly-stats", "recent-donations"];
export const MONTHLY_WIDGETS: WidgetId[] = ["monthly-donors", "giving-trend"];
export const OTHER_WIDGETS: WidgetId[] = ["top-donors", "tasks", "meetings"];

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return value === "compact" || value === "standard" || value === "wide" || value === "hero";
}

/** Load widget order from localStorage, falling back to defaults. */
export function loadOrder(): WidgetId[] {
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
    // Merge: keep saved order, but append any new widgets not yet in the saved list.
    const existing = new Set(validSavedOrder);
    return [...validSavedOrder, ...DEFAULT_WIDGET_ORDER.filter((widgetId) => !existing.has(widgetId))];
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

/** Load hidden widgets from localStorage. */
export function loadHiddenWidgets(): WidgetId[] {
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

/** Load dashboard lock state from localStorage. */
export function loadLocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_LOCK_KEY) === "true";
}

/** Load grant-inclusion preference from localStorage. */
export function loadIncludeGrants(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_GRANTS_KEY) === "true";
}

/** Load Revenue Progress source preference from localStorage. */
export function loadRevenueProgressSource(): RevenueProgressSource {
  if (typeof window === "undefined") return "YTD_DONATIONS";
  const stored = localStorage.getItem(LS_REVENUE_SOURCE_KEY);
  return stored === "ACTIVE_CAMPAIGNS" ? "ACTIVE_CAMPAIGNS" : "YTD_DONATIONS";
}

/** Load Revenue Progress goal mode preference from localStorage. */
export function loadRevenueGoalMode(): RevenueGoalMode {
  if (typeof window === "undefined") return "AUTO";
  const stored = localStorage.getItem(LS_REVENUE_GOAL_MODE_KEY);
  return stored === "MANUAL" ? "MANUAL" : "AUTO";
}

/** Load manual Revenue Progress goal override from localStorage. */
export function loadManualRevenueGoalAmount(): number {
  if (typeof window === "undefined") return 0;
  const stored = Number(localStorage.getItem(LS_MANUAL_REVENUE_GOAL_KEY) ?? "0");
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

/** Load AI widget visibility preference from localStorage. */
export function loadAiWidgetsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(LS_AI_WIDGETS_ENABLED_KEY) !== "false";
}

/** Load dashboard card-flow layout mode preference from localStorage. */
export function loadLayoutMode(): DashboardLayoutMode {
  if (typeof window === "undefined") return "MASONRY";
  return localStorage.getItem(LS_LAYOUT_MODE_KEY) === "MASONRY" ? "MASONRY" : "GRID";
}

/** Load auto-arrange visual preset from localStorage. */
export function loadAutoArrangePreset(): AutoArrangePreset {
  if (typeof window === "undefined") return "BALANCED";
  const stored = localStorage.getItem(LS_AUTO_ARRANGE_PRESET_KEY);
  if (stored === "ALTERNATING_WIDE" || stored === "FEATURE_FIRST" || stored === "COMPACT") return stored;
  return "BALANCED";
}

/** Load persisted widget size tokens, falling back to the product defaults. */
export function loadWidgetSizes(): Record<WidgetId, DashboardWidgetSize> {
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

export function getWidgetLayoutClass(size: DashboardWidgetSize): string {
  if (size === "compact") return "xl:col-span-3";
  if (size === "wide") return "xl:col-span-6";
  if (size === "hero") return "xl:col-span-12 min-h-[300px]";
  return "xl:col-span-4";
}

/** Widget class used when masonry flow is enabled. */
export function getMasonryWidgetLayoutClass(): string {
  return "w-full";
}

export function getAutoArrangePresetLabel(preset: AutoArrangePreset): string {
  if (preset === "ALTERNATING_WIDE") return "Alternating Wide";
  if (preset === "FEATURE_FIRST") return "Feature First";
  if (preset === "COMPACT") return "Compact Tiles";
  return "Balanced";
}

export function getAutoArrangeWidgetLayoutClass(id: WidgetId, idx: number, preset: AutoArrangePreset): string {
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
export function getSectionLayoutClass(layoutMode: DashboardLayoutMode): string {
  if (layoutMode === "MASONRY") {
    return "grid grid-cols-1 gap-4 grid-flow-row-dense md:grid-cols-2 xl:grid-cols-6";
  }
  return "grid grid-cols-1 gap-4 grid-flow-row-dense xl:grid-cols-12";
}

export function formatUsd(value: number): string {
  return `$${value.toLocaleString()}`;
}