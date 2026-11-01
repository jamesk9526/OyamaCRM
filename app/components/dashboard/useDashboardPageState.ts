import { resolveDashboardRevenueGoal } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { useDonorDashboardData } from "@/app/features/donor-dashboard/useDonorDashboardData";
/**
 * useDashboardPageState centralizes dashboard state, effects, persistence, and layout controls.
 * This keeps the route component focused on composing UI sections.
 */

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { DashboardWidgetSize } from "./DashboardWidget";
import type { RevenueGoalMode, RevenueProgressSource } from "./DashboardLayoutModal";
import {
  DEFAULT_WIDGET_ORDER,
  DEFAULT_WIDGET_SIZES,
  DEFAULT_HIDDEN_WIDGETS,
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
  locked?: boolean;
  revenueProgressSource: RevenueProgressSource;
  includeGrants: boolean;
  revenueGoalMode: RevenueGoalMode;
  manualRevenueGoalAmount: number;
  hiddenWidgetIds: string[];
  widgetSizes: Record<string, DashboardWidgetSize>;
  layoutMode: DashboardLayoutMode;
  autoArrangePreset: AutoArrangePreset;
}

/** Storage may be unavailable (private browsing/quota); preferences still work in memory. */
function saveDashboardPreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Nonessential persistence. */ }
}

function isWidgetId(value: string): value is WidgetId {
  return DEFAULT_WIDGET_ORDER.includes(value as WidgetId);
}

export function useDashboardPageState() {
  const metrics = useDonorDashboardData();
  const { summary } = metrics;

  // Layout state.
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(loadOrder);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>(loadHiddenWidgets);
  const [editMode, setEditMode] = useState(false);
  const [locked, setLocked] = useState(loadLocked);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [aiWidgetsEnabled, setAiWidgetsEnabled] = useState(loadAiWidgetsEnabled);
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>(loadLayoutMode);
  const [autoArrangePreset, setAutoArrangePreset] = useState<AutoArrangePreset>(loadAutoArrangePreset);
  const [widgetSizes, setWidgetSizes] = useState<Record<WidgetId, DashboardWidgetSize>>(loadWidgetSizes);

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

  // Persist dashboard preferences.
  useEffect(() => {
    saveDashboardPreference(LS_ORDER_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  useEffect(() => {
    saveDashboardPreference(LS_HIDDEN_WIDGETS_KEY, JSON.stringify(hiddenWidgets));
  }, [hiddenWidgets]);

  useEffect(() => {
    saveDashboardPreference(LS_LOCK_KEY, locked ? "true" : "false");
    if (locked) setEditMode(false);
  }, [locked]);

  useEffect(() => {
    saveDashboardPreference(LS_GRANTS_KEY, includeGrants ? "true" : "false");
  }, [includeGrants]);

  useEffect(() => {
    saveDashboardPreference(LS_REVENUE_SOURCE_KEY, revenueProgressSource);
  }, [revenueProgressSource]);

  useEffect(() => {
    saveDashboardPreference(LS_REVENUE_GOAL_MODE_KEY, revenueGoalMode);
  }, [revenueGoalMode]);

  useEffect(() => {
    saveDashboardPreference(LS_MANUAL_REVENUE_GOAL_KEY, String(manualRevenueGoalAmount));
  }, [manualRevenueGoalAmount]);

  useEffect(() => {
    saveDashboardPreference(LS_AI_WIDGETS_ENABLED_KEY, aiWidgetsEnabled ? "true" : "false");
  }, [aiWidgetsEnabled]);

  useEffect(() => {
    saveDashboardPreference(LS_LAYOUT_MODE_KEY, layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    saveDashboardPreference(LS_AUTO_ARRANGE_PRESET_KEY, autoArrangePreset);
  }, [autoArrangePreset]);

  useEffect(() => {
    saveDashboardPreference(LS_WIDGET_SIZES_KEY, JSON.stringify(widgetSizes));
  }, [widgetSizes]);

  const autoGoal = summary?.activeGoalTotal ?? 0;
  const revenueGoal = resolveDashboardRevenueGoal(revenueGoalMode, manualRevenueGoalAmount, autoGoal);

  function moveWidget(from: number, to: number) {
    if (from < 0 || from >= visibleWidgetOrder.length || to < 0 || to >= visibleWidgetOrder.length) return;
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
    if (dragFrom.current !== null && dragFrom.current !== idx) moveWidget(dragFrom.current, idx);
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
    const normalizedOrder = [...new Set(newOrder.filter(isWidgetId))];
    const normalizedHidden = settings.hiddenWidgetIds.filter(isWidgetId);
    setWidgetOrder(normalizedOrder.length > 0 ? normalizedOrder : [...DEFAULT_WIDGET_ORDER]);
    setRevenueProgressSource(settings.revenueProgressSource);
    setIncludeGrants(settings.includeGrants);
    setRevenueGoalMode(settings.revenueGoalMode);
    setManualRevenueGoalAmount(settings.manualRevenueGoalAmount);
    setHiddenWidgets(normalizedHidden);
    setWidgetSizes({ ...DEFAULT_WIDGET_SIZES, ...(settings.widgetSizes as Partial<Record<WidgetId, DashboardWidgetSize>>) });
    setLayoutMode(settings.layoutMode);
    setAutoArrangePreset(settings.autoArrangePreset);
    if (settings.locked !== undefined) {
      setLocked(settings.locked);
      if (settings.locked) setEditMode(false);
    }
  }

  function resetLayout() {
    setWidgetOrder([...DEFAULT_WIDGET_ORDER]);
    setWidgetSizes({ ...DEFAULT_WIDGET_SIZES });
    setHiddenWidgets([...DEFAULT_HIDDEN_WIDGETS]);
    setLayoutMode("MASONRY");
    setAutoArrangePreset("BALANCED");
    setEditMode(false);
  }

  function showAllWidgets() {
    setHiddenWidgets([]);
  }

  function toggleEditMode() {
    if (locked) return;
    setEditMode((current) => !current);
  }

  function applySmartLayout(preset: AutoArrangePreset = "BALANCED") {
    setLayoutMode("MASONRY");
    setAutoArrangePreset(preset);
    setEditMode(false);
  }

  function toggleLayoutLock() {
    setLocked((current) => !current);
  }

  return {
    ...metrics,
    widgetOrder,
    hiddenWidgets,
    editMode,
    locked,
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
    visibleWidgetOrder,
    sectionLayoutClassName,
    visibleTopKpiWidgets,
    visibleWeeklyWidgets,
    visibleMonthlyWidgets,
    visibleStewardshipWidgets,
    visibleIntelligenceWidgets,
    visibleOtherWidgets,
    revenueGoal,
    enableAiWidgets,
    toggleGrants,
    openCustomizeModal,
    closeCustomizeModal,
    applyCustomizeSettings,
    resetLayout,
    showAllWidgets,
    toggleEditMode,
    beginEditMode: () => { setLocked(false); setEditMode(true); },
    applySmartLayout,
    toggleLayoutLock,
    getWidgetFrameProps,
  };
}
