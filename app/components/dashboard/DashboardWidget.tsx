"use client";
/**
 * DashboardWidget — card shell for all dashboard widgets.
 * In normal mode: clean white card, no drag handles (reference CRM style).
 * In edit mode: reveals drag handle + move up/down arrows so the user can
 * rearrange widgets without accidentally triggering drags when interacting
 * with card content in normal usage.
 *
 * All drag state is managed by the parent (app/page.tsx).
 */

import React from "react";

export type DashboardWidgetSize = "compact" | "standard" | "wide" | "hero";

interface DashboardWidgetProps {
  /** Stable widget ID (used for order persistence) */
  id: string;
  /** Card header title */
  title: string;
  /** Optional subtitle shown in header row */
  subtitle?: string;
  /** Optional header right-side slot (e.g. filter tabs) */
  headerRight?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Extra CSS classes on the outer card */
  className?: string;
  /** Grid/layout classes from the dashboard layout engine */
  layoutClassName?: string;

  /* ── Edit mode ── */
  /** When true, exposes drag handles + move buttons. Default false. */
  editMode?: boolean;
  /** Called when the user clicks the "move up" button */
  onMoveUp?: () => void;
  /** Called when the user clicks the "move down" button */
  onMoveDown?: () => void;
  /** True if this widget can move up (not already first) */
  canMoveUp?: boolean;
  /** True if this widget can move down (not already last) */
  canMoveDown?: boolean;

  /* ── Drag & drop callbacks (only wired in edit mode) ── */
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /** True while this widget is being dragged (dims the card) */
  isDragging?: boolean;
  /** True while another widget is dragged over this one (highlight ring) */
  isDragOver?: boolean;
  /** Current persisted widget size */
  size?: DashboardWidgetSize;
  /** Called when staff resize a widget in edit mode */
  onResize?: (size: DashboardWidgetSize) => void;
}

const WIDGET_SIZE_OPTIONS: Array<{ value: DashboardWidgetSize; label: string; title: string }> = [
  { value: "compact", label: "S", title: "Small card" },
  { value: "standard", label: "M", title: "Standard card" },
  { value: "wide", label: "W", title: "Wide card" },
  { value: "hero", label: "XL", title: "Hero card" },
];

/**
 * Renders a white dashboard card. Drag/move controls are visible only
 * when `editMode` is true so the normal view stays completely clean.
 */
export default function DashboardWidget({
  id,
  title,
  subtitle,
  headerRight,
  children,
  className = "",
  layoutClassName = "",
  editMode = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false,
  size = "standard",
  onResize,
}: DashboardWidgetProps) {
  return (
    <div
      data-widget-id={id}
      /* Only participates in drag-and-drop during edit mode */
      draggable={editMode}
      onDragStart={editMode ? onDragStart : undefined}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={editMode ? onDrop : undefined}
      onDragEnd={editMode ? onDragEnd : undefined}
      className={`
        group/widget min-w-0 overflow-hidden bg-white/92 rounded-2xl border border-white/90 flex flex-col transition-all duration-300 shadow-[0_14px_36px_rgba(15,23,42,0.075),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl
        ${editMode && isDragging ? "opacity-40 scale-[0.98] shadow-none" : ""}
        ${editMode && isDragOver ? "ring-2 ring-emerald-400 ring-offset-1 border-transparent" : ""}
        ${editMode ? "ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-emerald-50/50" : "hover:-translate-y-0.5 hover:border-emerald-200/80 hover:shadow-[0_20px_46px_rgba(15,23,42,0.11)]"}
        ${layoutClassName}
        ${className}
      `}
    >
      {/* ── Card header ── */}
      <div className="flex min-w-0 min-h-14 items-center gap-2.5 border-b border-slate-100/90 bg-gradient-to-r from-white via-white to-slate-50/70 px-4 py-3 select-none">

        {/* Six-dot drag handle — visible only in edit mode */}
        {editMode && (
          <div className="text-gray-400 hover:text-green-600 cursor-grab active:cursor-grabbing shrink-0 transition-colors">
            <svg viewBox="0 0 10 16" fill="currentColor" className="w-3 h-4">
              <circle cx="2" cy="2" r="1.5" />
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </div>
        )}

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>

        {/* Optional right-side slot (visible in normal mode) */}
        {headerRight && !editMode && (
          <div className="shrink-0">{headerRight}</div>
        )}

        {/* Move up / down arrows — visible only in edit mode */}
        {editMode && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="hidden items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex">
              {WIDGET_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onResize?.(option.value);
                  }}
                  title={option.title}
                  className={`h-7 min-w-7 rounded-lg px-1.5 text-[10px] font-semibold transition-colors ${
                    size === option.value
                      ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!canMoveUp}
              className="rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
              title="Move up"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!canMoveDown}
              className="rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
              title="Move down"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="flex-1 overflow-auto bg-gradient-to-b from-white to-slate-50/25 p-4">
        {children}
      </div>
    </div>
  );
}
