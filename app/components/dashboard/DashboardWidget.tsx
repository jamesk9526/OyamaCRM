"use client";
/**
 * DashboardWidget — drag-and-drop wrapper for dashboard cards.
 * Provides a uniform card shell with a drag handle, title, and optional
 * "drag over" highlight ring. Children are rendered inside the card body.
 *
 * Drag state is managed by the parent (app/page.tsx). This component is
 * purely presentational — it fires the parent's drag event handlers.
 */

import React from "react";

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

  /* ── Drag & drop callbacks ── */
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /** True while this widget is being dragged (dim it) */
  isDragging?: boolean;
  /** True while another widget is dragged over this one (highlight) */
  isDragOver?: boolean;
}

/**
 * DashboardWidget renders a white card with a top drag handle.
 * The six-dot drag handle (⠿) is visible on hover to keep the UI clean.
 */
export default function DashboardWidget({
  id,
  title,
  subtitle,
  headerRight,
  children,
  className = "",
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false,
}: DashboardWidgetProps) {
  return (
    <div
      data-widget-id={id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        bg-white rounded-xl shadow-sm border transition-all duration-150 flex flex-col
        ${isDragging ? "opacity-40 scale-[0.98] shadow-none" : ""}
        ${isDragOver ? "ring-2 ring-green-400 ring-offset-1 border-transparent" : "border-gray-200"}
        ${className}
      `}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 select-none">
        {/* Drag handle — visible on hover */}
        <div className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors">
          <svg viewBox="0 0 10 16" fill="currentColor" className="w-3 h-4">
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="2" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="2" cy="14" r="1.5" />
            <circle cx="8" cy="14" r="1.5" />
          </svg>
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-400 truncate">{subtitle}</p>
          )}
        </div>

        {/* Optional right-side slot */}
        {headerRight && (
          <div className="shrink-0">{headerRight}</div>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
