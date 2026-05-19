"use client";
/** DashboardLayoutModal manages widget order, visibility, size, and revenue settings. */

import { useRef, useState } from "react";
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

/** DashboardLayoutModal — tabbed widget/settings modal, no external shell dependency. */
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
  const [localHiddenWidgets, setLocalHiddenWidgets] = useState<Set<string>>(
    new Set(initialHiddenWidgetIds)
  );
  const [localRevenueProgressSource, setLocalRevenueProgressSource] =
    useState<RevenueProgressSource>(initialRevenueProgressSource);
  const [localIncludeGrants, setLocalIncludeGrants] = useState<boolean>(initialIncludeGrants);
  const [localRevenueGoalMode, setLocalRevenueGoalMode] =
    useState<RevenueGoalMode>(initialRevenueGoalMode);
  const [localManualRevenueGoalAmount, setLocalManualRevenueGoalAmount] = useState<string>(
    String(initialManualRevenueGoalAmount || 0)
  );
  const [localWidgetSizes, setLocalWidgetSizes] =
    useState<Record<string, DashboardWidgetSize>>(initialWidgetSizes);
  const [activeTab, setActiveTab] = useState<"widgets" | "settings">("widgets");
  const dragFrom = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const activeOrder = localOrder.filter((id) => !localHiddenWidgets.has(id));
  const hiddenOrder = localOrder.filter((id) => localHiddenWidgets.has(id));
  const metaMap = Object.fromEntries(widgetMeta.map((m) => [m.id, m]));

  function commitActiveOrder(nextActive: string[]) {
    setLocalOrder([...nextActive, ...hiddenOrder]);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...activeOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    commitActiveOrder(next);
  }

  function moveDown(idx: number) {
    if (idx === activeOrder.length - 1) return;
    const next = [...activeOrder];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    commitActiveOrder(next);
  }

  function handleDragStart(idx: number) {
    dragFrom.current = idx;
  }

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

  function handleDragEnd() {
    dragFrom.current = null;
    setDragOverIdx(null);
  }

  function toggleWidgetVisibility(id: string) {
    setLocalHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (localOrder.length - next.size <= 1) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function setWidgetSize(id: string, size: DashboardWidgetSize) {
    setLocalWidgetSizes((current) => ({ ...current, [id]: size }));
  }

  function handleApply() {
    onApply(localOrder, {
      revenueProgressSource: localRevenueProgressSource,
      includeGrants: localIncludeGrants,
      revenueGoalMode: localRevenueGoalMode,
      manualRevenueGoalAmount: Math.max(0, Number(localManualRevenueGoalAmount || 0)),
      hiddenWidgetIds: Array.from(localHiddenWidgets),
      widgetSizes: localWidgetSizes,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customize Dashboard Layout</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Reorder, show/hide, and resize your dashboard widgets
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-gray-50 px-6 py-2">
          <button
            onClick={() => setActiveTab("widgets")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "widgets"
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Widgets
            <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              {activeOrder.length} visible
            </span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Revenue Settings
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">

          {/* WIDGETS TAB */}
          {activeTab === "widgets" && (
            <div className="space-y-4">
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Drag rows to reorder visible widgets. Click the eye icon to show or hide. Use the size picker to control how wide each widget renders.
              </p>

              {/* column headers */}
              <div
                className="grid items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
                style={{ gridTemplateColumns: "1.25rem 1.25rem 1fr 7rem 3.5rem 2rem" }}
              >
                <span />
                <span>#</span>
                <span>Widget</span>
                <span>Size</span>
                <span className="text-center">Visible</span>
                <span />
              </div>

              {/* Visible widgets */}
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
                      className={`grid cursor-grab select-none items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-100 active:cursor-grabbing ${
                        isOver
                          ? "border-green-400 bg-green-50 ring-2 ring-green-300 ring-offset-1"
                          : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100"
                      }`}
                      style={{ gridTemplateColumns: "1.25rem 1.25rem 1fr 7rem 3.5rem 2rem" }}
                    >
                      {/* drag grip */}
                      <svg viewBox="0 0 10 16" fill="currentColor" className="h-4 w-3 shrink-0 text-gray-300">
                        <circle cx="2" cy="2" r="1.5" />
                        <circle cx="8" cy="2" r="1.5" />
                        <circle cx="2" cy="8" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="2" cy="14" r="1.5" />
                        <circle cx="8" cy="14" r="1.5" />
                      </svg>

                      {/* index */}
                      <span className="text-center font-mono text-xs text-gray-400">{idx + 1}</span>

                      {/* label + description */}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {meta?.label ?? id}
                        </p>
                        {meta?.description && (
                          <p className="truncate text-xs text-gray-400">{meta.description}</p>
                        )}
                      </div>

                      {/* size picker */}
                      <select
                        value={localWidgetSizes[id] ?? "standard"}
                        onChange={(e) => setWidgetSize(id, e.target.value as DashboardWidgetSize)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-400"
                      >
                        {WIDGET_SIZE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      {/* visibility toggle — hide */}
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWidgetVisibility(id);
                          }}
                          className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-50 hover:text-green-800"
                          title="Hide widget"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* up / down */}
                      <div className="flex flex-col">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveUp(idx);
                          }}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-20"
                          title="Move up"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveDown(idx);
                          }}
                          disabled={idx === activeOrder.length - 1}
                          className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-20"
                          title="Move down"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hidden widgets */}
              {hiddenOrder.length > 0 && (
                <div>
                  <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Hidden ({hiddenOrder.length})
                  </p>
                  <div className="space-y-1.5">
                    {hiddenOrder.map((id) => {
                      const meta = metaMap[id];
                      return (
                        <div
                          key={id}
                          className="grid items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-2.5 opacity-60"
                          style={{ gridTemplateColumns: "1.25rem 1.25rem 1fr 7rem 3.5rem 2rem" }}
                        >
                          <span />
                          <span />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-500 line-through">
                              {meta?.label ?? id}
                            </p>
                            {meta?.description && (
                              <p className="truncate text-xs text-gray-400">{meta.description}</p>
                            )}
                          </div>
                          <select
                            value={localWidgetSizes[id] ?? "standard"}
                            onChange={(e) => setWidgetSize(id, e.target.value as DashboardWidgetSize)}
                            className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-500"
                          >
                            {WIDGET_SIZE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => toggleWidgetVisibility(id)}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              title="Show widget"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                />
                              </svg>
                            </button>
                          </div>
                          <span />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="max-w-lg space-y-5">
              {/* Revenue source */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-800">Revenue Progress Source</p>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="revenue-progress-source"
                      checked={localRevenueProgressSource === "YTD_DONATIONS"}
                      onChange={() => setLocalRevenueProgressSource("YTD_DONATIONS")}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">YTD Donations</p>
                      <p className="text-xs text-gray-400">January 1 to today</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="revenue-progress-source"
                      checked={localRevenueProgressSource === "ACTIVE_CAMPAIGNS"}
                      onChange={() => setLocalRevenueProgressSource("ACTIVE_CAMPAIGNS")}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Active Campaign Total</p>
                      <p className="text-xs text-gray-400">Sum of raised amounts across active campaigns</p>
                    </div>
                  </label>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-gray-100 pt-3">
                  <input
                    type="checkbox"
                    checked={localIncludeGrants}
                    onChange={(e) => setLocalIncludeGrants(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Include awarded grants in revenue progress</span>
                </label>
              </div>

              {/* Revenue goal */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-800">Revenue Goal</p>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="revenue-goal-mode"
                      checked={localRevenueGoalMode === "AUTO"}
                      onChange={() => setLocalRevenueGoalMode("AUTO")}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Automatic</p>
                      <p className="text-xs text-gray-400">Sum of active campaign goal amounts</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="revenue-goal-mode"
                      checked={localRevenueGoalMode === "MANUAL"}
                      onChange={() => setLocalRevenueGoalMode("MANUAL")}
                      className="mt-0.5 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Manual goal amount</p>
                      <p className="text-xs text-gray-400">Set a fixed fundraising target</p>
                    </div>
                  </label>
                  {localRevenueGoalMode === "MANUAL" && (
                    <div className="ml-7">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">$</span>
                        <input
                          type="number"
                          min={0}
                          step="1000"
                          value={localManualRevenueGoalAmount}
                          onChange={(e) => setLocalManualRevenueGoalAmount(e.target.value)}
                          className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="250000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-3.5">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {activeOrder.length} visible &middot; {hiddenOrder.length} hidden
            </span>
            <button
              onClick={handleApply}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 active:bg-green-800"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}