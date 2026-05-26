/**
 * useDashboardPageState centralizes dashboard state, effects, persistence, and layout controls.
 * This keeps the route component focused on composing UI sections.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { getStoredReportingYearMode, type ReportingYearMode } from "@/app/lib/fiscal-year";
import type { DashboardWidgetSize } from "./DashboardWidget";
import type { RevenueGoalMode, RevenueProgressSource } from "./DashboardLayoutModal";
import {
  DEFAULT_WIDGET_ORDER,
  DEFAULT_WIDGET_SIZES,
  INTELLIGENCE_WIDGETS,
  LS_AI_WIDGETS_ENABLED_KEY,
  LS_AUTO_ARRANGE_PRESET_KEY,
  LS_GRANTS_KEY,
  LS_HIDDEN_WIDGETS_KEY,
  LS_LAYOUT_MODE_KEY,
  LS_LOCK_KEY,
  LS_MANUAL_REVENUE_GOAL_KEY,
  LS_ORDER_KEY,
  LS_REVENUE_GOAL_MODE_KEY,
  LS_REVENUE_SOURCE_KEY,
  LS_WIDGET_SIZES_KEY,
  MONTHLY_WIDGETS,
  OTHER_WIDGETS,
  STEWARDSHIP_WIDGETS,
  TOP_KPI_WIDGETS,
  WEEKLY_WIDGETS,
  getAutoArrangePresetLabel,
  getAutoArrangeWidgetLayoutClass,
  getMasonryWidgetLayoutClass,
  getSectionLayoutClass,
  getWidgetLayoutClass,
  loadAiWidgetsEnabled,
  loadAutoArrangePreset,
  loadHiddenWidgets,
  loadIncludeGrants,
  loadLayoutMode,
  loadLocked,
  loadManualRevenueGoalAmount,
  loadOrder,
  loadRevenueGoalMode,
  loadRevenueProgressSource,
  loadWidgetSizes,
  type AutoArrangePreset,
  type DashboardLayoutMode,
  type RetentionData,
  type Summary,
  type WidgetId,
} from "./dashboardPageConfig";

export interface DashboardDragProps {
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

export interface DashboardWidgetFrameProps {
  editMode: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  size: DashboardWidgetSize;
  onResize: (size: DashboardWidgetSize) => void;
  layoutClassName: string;
  dragProps?: DashboardDragProps;
}

export interface DashboardLayoutApplySettings {
  revenueProgressSource: RevenueProgressSource;
  includeGrants: boolean;
  revenueGoalMode: RevenueGoalMode;
  manualRevenueGoalAmount: number;
  hiddenWidgetIds: string[];
  widgetSizes: Record<string, DashboardWidgetSize>;
}

function isWidgetId(value: string): value is WidgetId {
  return DEFAULT_WIDGET_ORDER.includes(value as WidgetId);
}

export function useDashboardPageState() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Layout state.
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

  // Revenue settings.
  const [includeGrants, setIncludeGrants] = useState(loadIncludeGrants);
  const [revenueProgressSource, setRevenueProgressSource] = useState<RevenueProgressSource>(loadRevenueProgressSource);
  const [revenueGoalMode, setRevenueGoalMode] = useState<RevenueGoalMode>(loadRevenueGoalMode);
  const [manualRevenueGoalAmount, setManualRevenueGoalAmount] = useState<number>(loadManualRevenueGoalAmount);

  // Drag state (only active in edit mode).
  const dragFrom = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const visibleWidgetOrder = widgetOrder.filter((id) => !hiddenWidgets.includes(id));
  const effectiveLayoutMode: DashboardLayoutMode = editMode ? "GRID" : layoutMode;
  const sectionLayoutClassName = getSectionLayoutClass(effectiveLayoutMode);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const dateBasisQuery = reportingYearMode === "fiscal" ? "?dateBasis=fiscal" : "";
      const [summaryResult, retentionResult] = await Promise.all([
        apiFetch<Summary>(`/api/reports/summary${dateBasisQuery}`),
        apiFetch<RetentionData>(`/api/reports/donor-retention${dateBasisQuery}`),
      ]);
      setSummary(summaryResult);
      setRetention(retentionResult);
      setLastRefreshed(new Date());
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [reportingYearMode]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Persist dashboard preferences.
  useEffect(() => {
    localStorage.setItem(LS_ORDER_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  useEffect(() => {
    localStorage.setItem(LS_HIDDEN_WIDGETS_KEY, JSON.stringify(hiddenWidgets));
  }, [hiddenWidgets]);

  useEffect(() => {
    localStorage.setItem(LS_LOCK_KEY, locked ? "true" : "false");
    if (locked) setEditMode(false);
  }, [locked]);

  useEffect(() => {
    localStorage.setItem(LS_GRANTS_KEY, includeGrants ? "true" : "false");
  }, [includeGrants]);

  useEffect(() => {
    localStorage.setItem(LS_REVENUE_SOURCE_KEY, revenueProgressSource);
  }, [revenueProgressSource]);

  useEffect(() => {
    localStorage.setItem(LS_REVENUE_GOAL_MODE_KEY, revenueGoalMode);
  }, [revenueGoalMode]);

  useEffect(() => {
    localStorage.setItem(LS_MANUAL_REVENUE_GOAL_KEY, String(manualRevenueGoalAmount));
  }, [manualRevenueGoalAmount]);

  useEffect(() => {
    localStorage.setItem(LS_AI_WIDGETS_ENABLED_KEY, aiWidgetsEnabled ? "true" : "false");
  }, [aiWidgetsEnabled]);

  useEffect(() => {
    localStorage.setItem(LS_LAYOUT_MODE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem(LS_AUTO_ARRANGE_PRESET_KEY, autoArrangePreset);
  }, [autoArrangePreset]);

  useEffect(() => {
    localStorage.setItem(LS_WIDGET_SIZES_KEY, JSON.stringify(widgetSizes));
  }, [widgetSizes]);

  const autoGoal = summary?.activeGoalTotal ?? 0;
  const dynamicFallbackGoal = Math.max(autoGoal, summary?.ytdAmount ?? 0, 1000);
  const revenueGoal = revenueGoalMode === "MANUAL" ? Math.max(1, manualRevenueGoalAmount) : dynamicFallbackGoal;
  const dataThroughLabel = summary?.freshness?.dataThrough
    ? `Data through ${new Date(summary.freshness.dataThrough).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : `Refreshed ${lastRefreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  function moveWidget(from: number, to: number) {
    if (to < 0 || to >= visibleWidgetOrder.length) return;
    const nextVisible = [...visibleWidgetOrder];
    const hidden = widgetOrder.filter((id) => hiddenWidgets.includes(id));
    const [moved] = nextVisible.splice(from, 1);
    nextVisible.splice(to, 0, moved);
    setWidgetOrder([...nextVisible, ...hidden]);
  }

  function resizeWidget(id: WidgetId, size: DashboardWidgetSize) {
    setWidgetSizes((current) => ({ ...current, [id]: size }));
  }

  function handleDragStart(idx: number) {
    dragFrom.current = idx;
    setDraggingIdx(idx);
  }

  function handleDragOver(event: DragEvent, idx: number) {
    event.preventDefault();
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

  function dragProps(idx: number): DashboardDragProps {
    return {
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        handleDragStart(idx);
      },
      onDragOver: (event: DragEvent) => handleDragOver(event, idx),
      onDrop: () => handleDrop(idx),
      onDragEnd: handleDragEnd,
      isDragging: draggingIdx === idx,
      isDragOver: dragOverIdx === idx && draggingIdx !== idx,
    };
  }

  function visibleSectionWidgets(ids: WidgetId[]) {
    return ids.filter((id) => visibleWidgetOrder.includes(id));
  }

  const visibleTopKpiWidgets = visibleSectionWidgets(TOP_KPI_WIDGETS);
  const visibleWeeklyWidgets = visibleSectionWidgets(WEEKLY_WIDGETS);
  const visibleMonthlyWidgets = visibleSectionWidgets(MONTHLY_WIDGETS);
  const visibleStewardshipWidgets = visibleSectionWidgets(STEWARDSHIP_WIDGETS);
  const visibleIntelligenceWidgets = visibleSectionWidgets(INTELLIGENCE_WIDGETS);
  const visibleOtherWidgets = visibleSectionWidgets(OTHER_WIDGETS);

  function getWidgetFrameProps(id: WidgetId, idx: number): DashboardWidgetFrameProps {
    return {
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
      dragProps: editMode ? dragProps(idx) : undefined,
    };
  }

  function enableAiWidgets() {
    setAiWidgetsEnabled(true);
  }

  function toggleGrants() {
    setIncludeGrants((value) => !value);
  }

  function openCustomizeModal() {
    setShowCustomizeModal(true);
  }

  function closeCustomizeModal() {
    setShowCustomizeModal(false);
  }

  function applyCustomizeSettings(newOrder: string[], settings: DashboardLayoutApplySettings) {
    const normalizedOrder = newOrder.filter(isWidgetId);
    const normalizedHidden = settings.hiddenWidgetIds.filter(isWidgetId);
    setWidgetOrder(normalizedOrder.length > 0 ? normalizedOrder : [...DEFAULT_WIDGET_ORDER]);
    setRevenueProgressSource(settings.revenueProgressSource);
    setIncludeGrants(settings.includeGrants);
    setRevenueGoalMode(settings.revenueGoalMode);
    setManualRevenueGoalAmount(settings.manualRevenueGoalAmount);
    setHiddenWidgets(normalizedHidden);
    setWidgetSizes({ ...DEFAULT_WIDGET_SIZES, ...(settings.widgetSizes as Partial<Record<WidgetId, DashboardWidgetSize>>) });
  }

  function resetLayout() {
    setWidgetOrder([...DEFAULT_WIDGET_ORDER]);
    setWidgetSizes({ ...DEFAULT_WIDGET_SIZES });
  }

  function showAllWidgets() {
    setHiddenWidgets([]);
  }

  return {
    summary,
    retention,
    loading,
    loadError,
    load,
    widgetOrder,
    hiddenWidgets,
    editMode,
    layoutMode,
    autoArrangePreset,
    autoArrangePresetLabel: getAutoArrangePresetLabel(autoArrangePreset),
    showCustomizeModal,
    aiWidgetsEnabled,
    setAiWidgetsEnabled,
    includeGrants,
    revenueProgressSource,
    revenueGoalMode,
    manualRevenueGoalAmount,
    widgetSizes,
    reportingYearMode,
    visibleWidgetOrder,
    sectionLayoutClassName,
    visibleTopKpiWidgets,
    visibleWeeklyWidgets,
    visibleMonthlyWidgets,
    visibleStewardshipWidgets,
    visibleIntelligenceWidgets,
    visibleOtherWidgets,
    revenueGoal,
    dataThroughLabel,
    enableAiWidgets,
    toggleGrants,
    openCustomizeModal,
    closeCustomizeModal,
    applyCustomizeSettings,
    resetLayout,
    showAllWidgets,
    getWidgetFrameProps,
  };
}