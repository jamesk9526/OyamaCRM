"use client";
/** DashboardLayoutModal manages widget order, visibility, and revenue widget settings. */

import { useRef, useState } from "react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import type { DashboardWidgetSize } from "@/app/components/dashboard/DashboardWidget";

export interface WidgetMeta {
  id: string;
  label: string;
  description: string;
}

export type RevenueProgressSource = "YTD_DONATIONS" | "ACTIVE_CAMPAIGNS";
export type RevenueGoalMode = "AUTO" | "MANUAL";

interface DashboardWidgetSettings {
  revenueProgressSource: RevenueProgressSource;
  includeGrants: boolean;
  revenueGoalMode: RevenueGoalMode;
  manualRevenueGoalAmount: number;
  hiddenWidgetIds: string[];
  widgetSizes: Record<string, DashboardWidgetSize>;
}

interface Props {
  order: string[];
  widgetMeta: WidgetMeta[];
  onApply: (newOrder: string[], settings: DashboardWidgetSettings) => void;
  onClose: () => void;
  initialRevenueProgressSource: RevenueProgressSource;
  initialIncludeGrants: boolean;
  initialRevenueGoalMode: RevenueGoalMode;
  initialManualRevenueGoalAmount: number;
  initialHiddenWidgetIds: string[];
  initialWidgetSizes: Record<string, DashboardWidgetSize>;
}

const WIDGET_SIZE_OPTIONS: Array<{ value: DashboardWidgetSize; label: string }> = [
  { value: "compact", label: "Small" },
  { value: "standard", label: "Medium" },
  { value: "wide", label: "Wide" },
  { value: "hero", label: "Hero" },
];

/** DashboardLayoutModal renders a 2-column control center for dashboard personalization. */
export default function DashboardLayoutModal({
  order,
  widgetMeta,
  onApply,
  onClose,
  initialRevenueProgressSource,
  initialIncludeGrants,
  initialRevenueGoalMode,
  initialManualRevenueGoalAmount,
  initialHiddenWidgetIds,
  initialWidgetSizes,
}: Props) {
  const [localOrder, setLocalOrder] = useState<string[]>(order);
  const [localHiddenWidgets, setLocalHiddenWidgets] = useState<Set<string>>(new Set(initialHiddenWidgetIds));
  const [localRevenueProgressSource, setLocalRevenueProgressSource] = useState<RevenueProgressSource>(initialRevenueProgressSource);
  const [localIncludeGrants, setLocalIncludeGrants] = useState<boolean>(initialIncludeGrants);
  const [localRevenueGoalMode, setLocalRevenueGoalMode] = useState<RevenueGoalMode>(initialRevenueGoalMode);
  const [localManualRevenueGoalAmount, setLocalManualRevenueGoalAmount] = useState<string>(String(initialManualRevenueGoalAmount || 0));
  const [localWidgetSizes, setLocalWidgetSizes] = useState<Record<string, DashboardWidgetSize>>(initialWidgetSizes);
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const activeOrder = localOrder.filter((id) => !localHiddenWidgets.has(id));
  const hiddenOrder = localOrder.filter((id) => localHiddenWidgets.has(id));
  const metaMap = Object.fromEntries(widgetMeta.map((m) => [m.id, m]));

  /** Applies reordered active widgets while preserving hidden widgets at the end. */
  function commitActiveOrder(nextActive: string[]) {
    setLocalOrder([...nextActive, ...hiddenOrder]);
  }

  /** Moves one active widget up. */
  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...activeOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    commitActiveOrder(next);
  }

  /** Moves one active widget down. */
  function moveDown(idx: number) {
    if (idx === activeOrder.length - 1) return;
    const next = [...activeOrder];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    commitActiveOrder(next);
  }

  /** Starts drag reorder. */
  function handleDragStart(idx: number) {
    dragFrom.current = idx;
  }

  /** Reorders immediately on drag-over for more responsive drag-and-drop feedback. */
  function handleDragOver(event: React.DragEvent, idx: number) {
    event.preventDefault();
    if (dragFrom.current === null || dragFrom.current === idx) return;
    const next = [...activeOrder];
    const [moved] = next.splice(dragFrom.current, 1);
    next.splice(idx, 0, moved);
    commitActiveOrder(next);
    dragFrom.current = idx;
    setDragOverIdx(idx);
  }

  /** Completes drag reorder cycle. */
  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  /** Toggles whether a widget is visible on the dashboard. */
  function toggleWidgetVisibility(id: string) {
    setLocalHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Keep at least one widget visible.
        if (localOrder.length - next.size <= 1) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function setWidgetSize(id: string, size: DashboardWidgetSize) {
    setLocalWidgetSizes((current) => ({ ...current, [id]: size }));
  }

  return (
    <WorkspaceSetupModal
      title="Customize Layout"
      subtitle="Reorder, hide, and tune dashboard widgets for your stewardship workflow."
      checklist={[
        "1. Reorder visible widgets",
        "2. Toggle widget visibility",
        "3. Save revenue progress preferences",
      ]}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customize Layout</h2>
            <p className="mt-0.5 text-xs text-gray-400">Reorder, hide, and restore widgets for your workflow</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid max-h-[460px] gap-4 overflow-y-auto px-4 py-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Visible Widgets</p>
            <div className="space-y-1.5">
              {activeOrder.map((id, idx) => {
                const meta = metaMap[id];
                const isOver = dragOverIdx === idx;
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      handleDragStart(idx);
                    }}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDragEnd}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex cursor-grab select-none items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-100 active:cursor-grabbing
                      ${isOver
                        ? "border-green-400 bg-green-50 ring-2 ring-green-300 ring-offset-1"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100"
                      }
                    `}
                  >
                    <svg viewBox="0 0 10 16" fill="currentColor" className="h-4 w-3 shrink-0 text-gray-400">
                      <circle cx="2" cy="2" r="1.5" />
                      <circle cx="8" cy="2" r="1.5" />
                      <circle cx="2" cy="8" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="2" cy="14" r="1.5" />
                      <circle cx="8" cy="14" r="1.5" />
                    </svg>
                    <span className="w-4 shrink-0 text-center font-mono text-xs text-gray-400">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight text-gray-800">{meta?.label ?? id}</p>
                      {meta?.description && <p className="truncate text-xs text-gray-400">{meta.description}</p>}
                    </div>
                    <select
                      value={localWidgetSizes[id] ?? "standard"}
                      onChange={(event) => setWidgetSize(id, event.target.value as DashboardWidgetSize)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600"
                      title="Widget size"
                    >
                      {WIDGET_SIZE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <div className="flex shrink-0 flex-col gap-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveUp(idx);
                        }}
                        disabled={idx === 0}
                        className="rounded p-1 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-20"
                        title="Move up"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveDown(idx);
                        }}
                        disabled={idx === activeOrder.length - 1}
                        className="rounded p-1 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-20"
                        title="Move down"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Widget Visibility</p>
            <div className="space-y-1.5">
              {localOrder.map((id) => {
                const meta = metaMap[id];
                const hidden = localHiddenWidgets.has(id);
                return (
                  <label
                    key={`toggle-${id}`}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => toggleWidgetVisibility(id)}
                      className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight text-gray-800">{meta?.label ?? id}</p>
                      {meta?.description && <p className="truncate text-xs text-gray-400">{meta.description}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-white px-6 pb-3 pt-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue Progress Settings</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="revenue-progress-source"
                checked={localRevenueProgressSource === "YTD_DONATIONS"}
                onChange={() => setLocalRevenueProgressSource("YTD_DONATIONS")}
                className="text-green-600 focus:ring-green-500"
              />
              Use YTD Donations (Jan 1 to now)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="revenue-progress-source"
                checked={localRevenueProgressSource === "ACTIVE_CAMPAIGNS"}
                onChange={() => setLocalRevenueProgressSource("ACTIVE_CAMPAIGNS")}
                className="text-green-600 focus:ring-green-500"
              />
              Use Active Campaign Raised Amount
            </label>
            <label className="flex items-center gap-2 pt-1 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={localIncludeGrants}
                onChange={(event) => setLocalIncludeGrants(event.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Include awarded grants in Revenue Progress
            </label>

            <div className="border-t border-gray-100 pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue Goal</p>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="revenue-goal-mode"
                  checked={localRevenueGoalMode === "AUTO"}
                  onChange={() => setLocalRevenueGoalMode("AUTO")}
                  className="text-green-600 focus:ring-green-500"
                />
                Use active campaign goal total (automatic)
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="revenue-goal-mode"
                  checked={localRevenueGoalMode === "MANUAL"}
                  onChange={() => setLocalRevenueGoalMode("MANUAL")}
                  className="text-green-600 focus:ring-green-500"
                />
                Set manual goal amount
              </label>
              <div className="mt-2 pl-6">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={localManualRevenueGoalAmount}
                  onChange={(event) => setLocalManualRevenueGoalAmount(event.target.value)}
                  disabled={localRevenueGoalMode !== "MANUAL"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="250000"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(localOrder, {
                revenueProgressSource: localRevenueProgressSource,
                includeGrants: localIncludeGrants,
                revenueGoalMode: localRevenueGoalMode,
                manualRevenueGoalAmount: Math.max(0, Number(localManualRevenueGoalAmount || 0)),
                hiddenWidgetIds: Array.from(localHiddenWidgets),
                widgetSizes: localWidgetSizes,
              });
              onClose();
            }}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 active:bg-green-800"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </WorkspaceSetupModal>
  );
}
