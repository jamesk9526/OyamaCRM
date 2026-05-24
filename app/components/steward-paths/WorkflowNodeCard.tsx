/**
 * WorkflowNodeCard renders one action/branch node card for the visual canvas.
 * Design follows the Steward Paths mockup: colored step-type icons, type label above,
 * and icon-only action controls on the right side of the card.
 */
"use client";

import { useRef } from "react";
import type { PointerEvent } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { PALETTE_ITEMS } from "./palette-catalog";
import { isBranchNode, type WorkflowNode, type WorkflowNodeCanvasOffset } from "./workflow-types";
import { getEngagementStatusChipClass } from "@/app/lib/engagement-status";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  numberLabel: string;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  compact?: boolean;
  freeOffset: WorkflowNodeCanvasOffset;
  onFreeMove: (nodeId: string, offset: WorkflowNodeCanvasOffset) => void;
  onDragStartNode?: (nodeId: string) => void;
  onDragEndNode?: () => void;
}

/** Looks up the palette item describing this node's kind. */
function findPaletteItem(kind: string) {
  return PALETTE_ITEMS.find((item) => item.kind === kind);
}

/** Returns a human-readable step-type label shown above the card. */
function nodeTypeLabel(kind: string): string {
  if (kind.startsWith("trigger.")) return "TRIGGER";
  if (kind.startsWith("timing.")) return "WAIT";
  if (kind.startsWith("logic.")) return "CONDITION";
  if (kind.startsWith("safety.")) return "SAFETY";
  if (kind.startsWith("donor-data.") || kind.startsWith("donor.")) return "DATA";
  return "ACTION";
}

/** Returns Tailwind bg+text classes for the icon container based on node kind. */
function nodeIconStyle(kind: string): string {
  if (kind.startsWith("trigger.")) return "bg-green-100 text-green-700";
  if (kind.startsWith("timing.")) return "bg-amber-100 text-amber-600";
  if (kind.startsWith("logic.")) return "bg-violet-100 text-violet-700";
  if (kind.startsWith("safety.")) return "bg-orange-100 text-orange-600";
  if (kind.startsWith("email.")) return "bg-blue-100 text-blue-700";
  if (kind.startsWith("print.")) return "bg-cyan-100 text-cyan-700";
  if (kind.startsWith("task.")) return "bg-indigo-100 text-indigo-700";
  if (kind.startsWith("donor-data.") || kind.startsWith("donor.")) return "bg-teal-100 text-teal-700";
  return "bg-slate-100 text-slate-600";
}

/** Converts execution-oriented labels into the concise node copy from the visual mockup. */
function displayNodeTitle(node: WorkflowNode, fallback: string): string {
  if (node.kind === "timing.delay") {
    const amount = typeof node.config.amount === "number" ? node.config.amount : 1;
    const unit = typeof node.config.unit === "string" ? node.config.unit : "days";
    return `Wait ${amount} ${unit}`;
  }

  const replacements: Record<string, string> = {
    "trigger.added_to_segment": "Segment Enters",
    "email.create_draft": "Send Email",
    "logic.if_else": "Did donor make another gift?",
    "donor.add_tag": "Add Tag",
    "task.create": "Create Task",
    "safety.stop_enrollment": "Workflow Complete",
  };
  const replacement = replacements[node.kind];
  if (replacement && (!node.title || node.title === fallback)) return replacement;
  return node.title || replacement || fallback;
}

/** Border tone by node kind, matching the reference workflow colors. */
function nodeBorderStyle(kind: string): string {
  if (kind.startsWith("trigger.")) return "border-emerald-300";
  if (kind.startsWith("timing.")) return "border-amber-300 bg-amber-50/45";
  if (kind.startsWith("logic.")) return "border-violet-300 bg-violet-50/40";
  if (kind.startsWith("email.")) return "border-blue-300 bg-blue-50/35";
  if (kind.startsWith("task.")) return "border-violet-300 bg-violet-50/35";
  if (kind.startsWith("donor.")) return "border-emerald-300 bg-emerald-50/35";
  if (kind.startsWith("safety.")) return "border-slate-200 bg-slate-50";
  return "border-slate-200";
}

/** Returns a small SVG icon for the node kind. */
function NodeIcon({ kind }: { kind: string }) {
  const cls = "h-4 w-4";
  if (kind.startsWith("trigger.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    );
  }
  if (kind.startsWith("timing.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 5v3l2.5 1.5" />
      </svg>
    );
  }
  if (kind.startsWith("logic.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M5 7l3 2 3-2M5 11h6M4 13h2M10 13h2" />
      </svg>
    );
  }
  if (kind.startsWith("email.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5l6.5 4 6.5-4" />
      </svg>
    );
  }
  if (kind.startsWith("print.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5V2h8v3M2 5h12a1 1 0 011 1v5a1 1 0 01-1 1h-2v2H4v-2H2a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </svg>
    );
  }
  if (kind.startsWith("task.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l2 2 3-3" />
      </svg>
    );
  }
  if (kind.startsWith("safety.")) {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2L3 4.5v4c0 3.1 2.5 5.5 5 6.5 2.5-1 5-3.4 5-6.5v-4L8 2z" />
      </svg>
    );
  }
  // donor-data / default
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  );
}

/** Card rendered for one node on the canvas. */
export default function WorkflowNodeCard({
  node,
  numberLabel,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  compact = false,
  freeOffset,
  onFreeMove,
  onDragStartNode,
  onDragEndNode,
}: WorkflowNodeCardProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const palette = findPaletteItem(node.kind);
  const typeLabel = nodeTypeLabel(node.kind);
  const summary = isBranchNode(node)
    ? `${node.lanes.length} branch lane${node.lanes.length === 1 ? "" : "s"}`
    : (palette?.summary ?? "Custom step.");

  const selectedClass = isSelected
    ? "border-blue-500 ring-2 ring-blue-500/25 shadow-[0_12px_28px_rgba(37,99,235,0.16)]"
    : `${nodeBorderStyle(node.kind)} hover:border-slate-400 hover:shadow-sm`;

  function handleNodeDragStart(event: ReactDragEvent<HTMLElement>) {
    event.dataTransfer.setData("application/x-oyama-node-id", node.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStartNode?.(node.id);
  }

  function handleNodeDragEnd() {
    onDragEndNode?.();
  }

  function beginFreeDrag(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, a")) return;
    onSelect(node.id);
    onDragStartNode?.(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: freeOffset.x,
      offsetY: freeOffset.y,
    };
  }

  function updateFreeDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.offsetX + event.clientX - drag.startX;
    const nextY = drag.offsetY + event.clientY - drag.startY;
    onFreeMove(node.id, { x: nextX, y: nextY });
  }

  function endFreeDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    onDragEndNode?.();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={`group relative cursor-grab touch-none rounded-lg border ${compact ? "p-2.5 pl-4" : "p-3 pl-4"} transition-[border,box-shadow,background-color] active:cursor-grabbing ${selectedClass}`}
      style={{ transform: `translate(${freeOffset.x}px, ${freeOffset.y}px)`, zIndex: isSelected ? 20 : 1 }}
      data-workflow-node-id={node.id}
      role="button"
      tabIndex={0}
      onPointerDown={beginFreeDrag}
      onPointerMove={updateFreeDrag}
      onPointerUp={endFreeDrag}
      onPointerCancel={endFreeDrag}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <span
        className="absolute -left-3 -top-3 z-20 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-700 shadow-sm"
        title={`Workflow step ${numberLabel}`}
      >
        {numberLabel}
      </span>

      {isSelected ? (
        <>
          <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm" aria-hidden="true" />
          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm" aria-hidden="true" />
          <span className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm" aria-hidden="true" />
          <div className="absolute -right-14 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              title="Move step up"
              onClick={(event) => { event.stopPropagation(); onMoveUp(node.id); }}
              disabled={!canMoveUp}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12V4M4 8l4-4 4 4" />
              </svg>
            </button>
            <button
              type="button"
              title="Move step down"
              onClick={(event) => { event.stopPropagation(); onMoveDown(node.id); }}
              disabled={!canMoveDown}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v8M4 8l4 4 4-4" />
              </svg>
            </button>
            <button
              type="button"
              title="Delete step"
              onClick={(event) => { event.stopPropagation(); onRemove(node.id); }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-rose-50 hover:text-rose-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h7M6 4.5V3h4v1.5M6 6.5v5M10 6.5v5M5 4.5l.5 9h5l.5-9" />
              </svg>
            </button>
          </div>
        </>
      ) : null}

      {/* Drag handle — left edge grip dots, visible on hover */}
      <button
        type="button"
        draggable
        onDragStart={handleNodeDragStart}
        onDragEnd={handleNodeDragEnd}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        title="Drag to move this step"
        aria-label="Drag step"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
      >
        {[0, 1, 2].map((row) => (
          <span key={row} className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />
            <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />
          </span>
        ))}
      </button>

      {/* Step type label */}
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">{typeLabel}</p>

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Colored icon */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${nodeIconStyle(node.kind)}`}>
            <NodeIcon kind={node.kind} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-slate-950">{displayNodeTitle(node, palette?.label || node.kind)}</p>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600">{summary}</p>
            {node.note && <p className="text-[11px] text-slate-400 italic mt-1">{node.note}</p>}
            {isBranchNode(node) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {node.lanes.slice(0, 4).map((lane) => (
                  <span key={lane.id} className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {lane.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {node.statusLabel && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getEngagementStatusChipClass(node.statusLabel)}`}>
                {node.statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
