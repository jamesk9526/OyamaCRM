"use client";
/**
 * DashboardLayoutModal — overlay editor for reordering dashboard widgets.
 * Shows all active widgets as a sorted list. Each row can be dragged to a new
 * position OR moved with up/down arrow buttons. Changes are staged locally and
 * only committed to the dashboard when the user clicks "Apply Changes".
 */

import { useRef, useState } from "react";

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
}

interface Props {
  /** Current widget order (from parent dashboard) */
  order: string[];
  /** Metadata (label, description) for each widget ID */
  widgetMeta: WidgetMeta[];
  /** Called when the user confirms a new order */
  onApply: (newOrder: string[], settings: DashboardWidgetSettings) => void;
  /** Called when the user cancels or clicks backdrop */
  onClose: () => void;
  /** Initial source for Revenue Progress totals. */
  initialRevenueProgressSource: RevenueProgressSource;
  /** Initial include-grants preference for the Revenue Progress widget. */
  initialIncludeGrants: boolean;
  /** Initial goal mode for Revenue Progress. */
  initialRevenueGoalMode: RevenueGoalMode;
  /** Initial manual goal amount for Revenue Progress. */
  initialManualRevenueGoalAmount: number;
}

/**
 * DashboardLayoutModal renders a centered modal with a reorderable widget list.
 * Dragging a row or clicking the arrow buttons updates the local staging order.
 * "Apply Changes" commits to the parent; "Cancel" discards edits.
 */
export default function DashboardLayoutModal({
  order,
  widgetMeta,
  onApply,
  onClose,
  initialRevenueProgressSource,
  initialIncludeGrants,
  initialRevenueGoalMode,
  initialManualRevenueGoalAmount,
}: Props) {
  const [localOrder, setLocalOrder] = useState<string[]>(order);
  const [localRevenueProgressSource, setLocalRevenueProgressSource] = useState<RevenueProgressSource>(initialRevenueProgressSource);
  const [localIncludeGrants, setLocalIncludeGrants] = useState<boolean>(initialIncludeGrants);
  const [localRevenueGoalMode, setLocalRevenueGoalMode] = useState<RevenueGoalMode>(initialRevenueGoalMode);
  const [localManualRevenueGoalAmount, setLocalManualRevenueGoalAmount] = useState<string>(String(initialManualRevenueGoalAmount || 0));
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /** Swap a widget with the one above it */
  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...localOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLocalOrder(next);
  }

  /** Swap a widget with the one below it */
  function moveDown(idx: number) {
    if (idx === localOrder.length - 1) return;
    const next = [...localOrder];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setLocalOrder(next);
  }

  function handleDragStart(idx: number) {
    dragFrom.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragFrom.current === null || dragFrom.current === idx) return;
    const next = [...localOrder];
    const [moved] = next.splice(dragFrom.current, 1);
    next.splice(idx, 0, moved);
    setLocalOrder(next);
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  /** Build a lookup of id → metadata */
  const metaMap = Object.fromEntries(widgetMeta.map((m) => [m.id, m]));

  return (
    /* Backdrop — click to cancel */
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customize Dashboard</h2>
            <p className="text-xs text-gray-400 mt-0.5">Drag rows or use arrows to reorder your widgets</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-100"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Widget rows ── */}
        <div className="px-4 py-3 space-y-1.5 max-h-[400px] overflow-y-auto">
          {localOrder.map((id, idx) => {
            const meta = metaMap[id];
            const isOver = dragOverIdx === idx && dragFrom.current !== idx;

            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  handleDragStart(idx);
                }}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl border select-none
                  cursor-grab active:cursor-grabbing transition-all duration-100
                  ${isOver
                    ? "border-green-400 bg-green-50 ring-2 ring-green-300 ring-offset-1"
                    : "border-gray-100 bg-gray-50 hover:bg-gray-100 hover:border-gray-200"
                  }
                `}
              >
                {/* Six-dot drag handle */}
                <svg
                  viewBox="0 0 10 16"
                  fill="currentColor"
                  className="w-3 h-4 text-gray-400 shrink-0"
                >
                  <circle cx="2" cy="2" r="1.5" />
                  <circle cx="8" cy="2" r="1.5" />
                  <circle cx="2" cy="8" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="2" cy="14" r="1.5" />
                  <circle cx="8" cy="14" r="1.5" />
                </svg>

                {/* Position badge */}
                <span className="text-xs font-mono text-gray-400 w-4 shrink-0 text-center">
                  {idx + 1}
                </span>

                {/* Widget name + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">
                    {meta?.label ?? id}
                  </p>
                  {meta?.description && (
                    <p className="text-xs text-gray-400 truncate">{meta.description}</p>
                  )}
                </div>

                {/* Move up / down arrows */}
                <div className="flex flex-col gap-0 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveUp(idx); }}
                    disabled={idx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-1 rounded"
                    title="Move up"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveDown(idx); }}
                    disabled={idx === localOrder.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors p-1 rounded"
                    title="Move down"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Widget settings ── */}
        <div className="px-6 pt-2 pb-3 border-t border-gray-100 bg-white">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue Progress Settings</h3>
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
            <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
              <input
                type="checkbox"
                checked={localIncludeGrants}
                onChange={(event) => setLocalIncludeGrants(event.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Include awarded grants in Revenue Progress
            </label>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Revenue Goal</p>
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
              <label className="flex items-center gap-2 text-sm text-gray-700 mt-1">
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="250000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium"
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
              });
              onClose();
            }}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
