/**
 * WorkflowNodeCard renders one action/branch node card for the visual map.
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

/** Returns a short map icon label based on kind prefix. */
function nodeGlyph(kind: string): string {
  if (kind.startsWith("trigger.")) return "TR";
  if (kind.startsWith("timing.")) return "TM";
  if (kind.startsWith("email.")) return "EM";
  if (kind.startsWith("print.")) return "PR";
  if (kind.startsWith("task.")) return "TK";
  if (kind.startsWith("donor.")) return "DD";
  if (kind.startsWith("logic.")) return "LG";
  if (kind.startsWith("safety.")) return "SF";
  return "ST";
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
  const summary = isBranchNode(node)
    ? `${node.lanes.length} branch lane${node.lanes.length === 1 ? "" : "s"}`
    : (palette?.summary ?? "Custom step.");

  const selectedClass = isSelected
    ? "border-emerald-500 ring-2 ring-emerald-200 shadow-md"
    : "border-gray-200 hover:border-emerald-300";

  return (
    <div
      className={`rounded-xl border bg-white ${compact ? "p-2.5" : "p-3"} transition-shadow ${selectedClass}`}
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-semibold text-emerald-700">
            {nodeGlyph(node.kind)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                {indexLabel ?? index + 1}
              </span>
              <p className="truncate text-sm font-semibold text-gray-900">{node.title || palette?.label || node.kind}</p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{summary}</p>
            {node.note && <p className="text-[11px] text-gray-500 italic mt-1">{node.note}</p>}
            {isBranchNode(node) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {node.lanes.slice(0, 4).map((lane) => (
                  <span key={lane.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
                    {lane.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {node.statusLabel && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getEngagementStatusChipClass(node.statusLabel)}`}>
              {node.statusLabel}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.toneClass}`}>
            {badge.label}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveUp(node.id);
          }}
          disabled={!canMoveUp}
          className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveDown(node.id);
          }}
          disabled={!canMoveDown}
          className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(node.id);
          }}
          className="rounded-md border border-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
