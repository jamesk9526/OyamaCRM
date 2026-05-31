/**
 * BranchLane renders one visual lane card inside a branch node split.
 */
"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent, ReactNode } from "react";
import type { WorkflowBranchLane as WorkflowBranchLaneType, WorkflowNodeCanvasOffset } from "./workflow-types";
import { getBranchLaneEndAnchorId, getBranchLaneStartAnchorId } from "./workflow-utils";

interface BranchLaneProps {
  lane: WorkflowBranchLaneType;
  laneLetter: string;
  conditionSummary: string;
  freeOffset: WorkflowNodeCanvasOffset;
  onFreeMove: (laneId: string, offset: WorkflowNodeCanvasOffset) => void;
  gridSize: number;
  isSelected: boolean;
  onSelectLane: () => void;
  children: ReactNode;
  onAddAtStart: () => void;
}

/** Visual lane container with condition chip and empty-state affordance. */
export default function BranchLane({
  lane,
  laneLetter,
  conditionSummary,
  freeOffset,
  onFreeMove,
  gridSize,
  isSelected,
  onSelectLane,
  children,
  onAddAtStart,
}: BranchLaneProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  function snapToGrid(value: number): number {
    if (gridSize <= 1) return value;
    return Math.round(value / gridSize) * gridSize;
  }

  function shouldStartLaneDrag(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.closest("button, input, select, textarea, a")) return false;
    if (element.closest('[data-workflow-node-id]:not([data-workflow-node-id^="__branch_lane_"])')) return false;
    return true;
  }

  function beginLaneMove(event: PointerEvent<HTMLElement>) {
    const fromHandle = Boolean((event.target as HTMLElement | null)?.closest("[data-lane-drag-handle='true']"));
    if (!fromHandle && !shouldStartLaneDrag(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    onSelectLane();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: freeOffset.x,
      originY: freeOffset.y,
    };

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function moveLane(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.originX + event.clientX - drag.startX;
    const nextY = drag.originY + event.clientY - drag.startY;
    onFreeMove(lane.id, { x: snapToGrid(nextX), y: snapToGrid(nextY) });
  }

  function endLaneMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleLaneSelect(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button, input, select, textarea, a")) return;
    if (target.closest('[data-workflow-node-id]:not([data-workflow-node-id^="__branch_lane_"])')) return;
    onSelectLane();
  }

  const tone = lane.isFallback
    ? {
      laneBadge: "bg-rose-100 text-rose-700 border-rose-200",
      panelBorder: "border-rose-200",
      summary: "text-rose-700",
      emptyBorder: "border-rose-300",
      emptyBg: "bg-rose-50/70",
      buttonBorder: "border-rose-300",
      buttonText: "text-rose-700",
      buttonHover: "hover:bg-rose-50",
    }
    : {
      laneBadge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      panelBorder: "border-emerald-200",
      summary: "text-emerald-700",
      emptyBorder: "border-emerald-300",
      emptyBg: "bg-emerald-50/70",
      buttonBorder: "border-emerald-300",
      buttonText: "text-emerald-700",
      buttonHover: "hover:bg-emerald-50",
    };

  return (
    <article
      className={`group relative min-w-[260px] flex-1 cursor-grab touch-none rounded-xl border bg-white px-2 py-2 active:cursor-grabbing ${isSelected ? "border-emerald-400 ring-2 ring-emerald-200" : tone.panelBorder}`}
      style={{ transform: `translate(${freeOffset.x}px, ${freeOffset.y}px)` }}
      onPointerDown={beginLaneMove}
      onPointerMove={moveLane}
      onPointerUp={endLaneMove}
      onPointerCancel={endLaneMove}
      onClick={handleLaneSelect}
    >
      <span
        aria-hidden="true"
        data-workflow-node-id={getBranchLaneStartAnchorId(lane.id)}
        className="pointer-events-none absolute -top-3 left-1/2 h-px w-px -translate-x-1/2"
      />
      <span
        aria-hidden="true"
        data-workflow-node-id={getBranchLaneEndAnchorId(lane.id)}
        className="pointer-events-none absolute -bottom-3 left-1/2 h-px w-px -translate-x-1/2"
      />

      <button
        type="button"
        data-lane-drag-handle="true"
        title="Drag branch lane"
        aria-label="Drag branch lane"
        className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:bg-slate-100 group-hover:opacity-100"
        onPointerDown={beginLaneMove}
        onPointerMove={moveLane}
        onPointerUp={endLaneMove}
        onPointerCancel={endLaneMove}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path strokeLinecap="round" d="M8 2.5v11M4.5 4.5h7M4.5 8h7M4.5 11.5h7" />
        </svg>
      </button>

      <div className="mb-2 flex items-center justify-center">
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone.laneBadge}`}>
          {laneLetter} · {lane.label}
        </span>
      </div>

      <div>
        {lane.nodeIds.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-3 text-center ${tone.emptyBorder} ${tone.emptyBg}`}>
            <p className="text-xs font-medium text-gray-800">Drop or add an action here</p>
            <button
              type="button"
              onClick={onAddAtStart}
              className={`mt-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold ${tone.buttonBorder} ${tone.buttonText} ${tone.buttonHover}`}
            >
              + Add step
            </button>
          </div>
        ) : (
          children
        )}
      </div>
      <p className={`mt-2 text-center text-[10px] font-semibold ${tone.summary}`}>{conditionSummary}</p>
    </article>
  );
}
