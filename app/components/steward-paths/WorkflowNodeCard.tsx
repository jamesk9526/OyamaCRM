/**
 * WorkflowNodeCard renders one action/branch node card for the visual canvas.
 * Design follows the Steward Paths mockup: colored step-type icons, type label above,
 * and icon-only action controls on the right side of the card.
 */
"use client";

import { PALETTE_ITEMS } from "./palette-catalog";
import { getReadinessBadge, isBranchNode, type WorkflowNode } from "./workflow-types";
import { getEngagementStatusChipClass } from "@/app/lib/engagement-status";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  index: number;
  indexLabel?: string;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  compact?: boolean;
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
  index,
  indexLabel,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  compact = false,
  onDragStartNode,
  onDragEndNode,
}: WorkflowNodeCardProps) {
  const palette = findPaletteItem(node.kind);
  const readiness = palette?.readiness ?? "not-implemented";
  const badge = getReadinessBadge(readiness);
  const typeLabel = nodeTypeLabel(node.kind);
  const summary = isBranchNode(node)
    ? `${node.lanes.length} branch lane${node.lanes.length === 1 ? "" : "s"}`
    : (palette?.summary ?? "Custom step.");

  const selectedClass = isSelected
    ? "border-green-500 ring-2 ring-green-200 shadow-md"
    : "border-slate-200 hover:border-slate-300 hover:shadow-sm";

  return (
    <div
      className={`group relative rounded-xl border bg-white ${compact ? "p-2.5 pl-5" : "p-3 pl-5"} transition-all ${selectedClass}`}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-oyama-node-id", node.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStartNode?.(node.id);
      }}
      onDragEnd={() => {
        onDragEndNode?.();
      }}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      {/* Drag handle — left edge grip dots, visible on hover */}
      <span
        className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
        aria-hidden="true"
      >
        {[0, 1, 2].map((row) => (
          <span key={row} className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />
            <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />
          </span>
        ))}
      </span>

      {/* Step type label */}
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{typeLabel}</p>

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Colored icon */}
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${nodeIconStyle(node.kind)}`}>
            <NodeIcon kind={node.kind} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {indexLabel ?? index + 1}
              </span>
              <p className="truncate text-sm font-semibold text-slate-900">{node.title || palette?.label || node.kind}</p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{summary}</p>
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

        {/* Status badges + action icons */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {node.statusLabel && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getEngagementStatusChipClass(node.statusLabel)}`}>
                {node.statusLabel}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.toneClass}`}>
              {badge.label}
            </span>
          </div>
          {/* Icon-only action buttons — visible on hover or when selected */}
          <div className={`flex items-center gap-1 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <button
              type="button"
              title="Move up"
              onClick={(event) => { event.stopPropagation(); onMoveUp(node.id); }}
              disabled={!canMoveUp}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12V4M4 8l4-4 4 4" />
              </svg>
            </button>
            <button
              type="button"
              title="Move down"
              onClick={(event) => { event.stopPropagation(); onMoveDown(node.id); }}
              disabled={!canMoveDown}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v8M4 8l4 4 4-4" />
              </svg>
            </button>
            <button
              type="button"
              title="Remove step"
              onClick={(event) => { event.stopPropagation(); onRemove(node.id); }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-red-200 text-red-500 hover:bg-red-50"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
