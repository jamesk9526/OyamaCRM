/**
 * WorkflowNodeCard renders one node in the workflow as a clean rounded card
 * with an icon dot, title, optional status chip, and a short summary.
 *
 * Cards are stacked vertically by WorkflowCanvas (the "ordered structured cards"
 * fallback for the visual map until drag/drop lands).
 */
"use client";

import { PALETTE_ITEMS } from "./palette-catalog";
import { getReadinessBadge, type WorkflowNode } from "./workflow-types";
import { getEngagementStatusChipClass } from "@/app/lib/engagement-status";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  index: number;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Looks up the palette item describing this node's kind. */
function findPaletteItem(kind: string) {
  return PALETTE_ITEMS.find((item) => item.kind === kind);
}

/** Card rendered for one node on the canvas. */
export default function WorkflowNodeCard({
  node,
  index,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: WorkflowNodeCardProps) {
  const palette = findPaletteItem(node.kind);
  const readiness = palette?.readiness ?? "not-implemented";
  const badge = getReadinessBadge(readiness);
  const summary = palette?.summary ?? "Custom step.";

  const selectedClass = isSelected
    ? "border-green-500 ring-2 ring-green-200"
    : "border-gray-200 hover:border-green-300";

  return (
    <div
      className={`rounded-xl border bg-white p-3 transition-shadow ${selectedClass}`}
      role="button"
      tabIndex={0}
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
          <div className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{node.title || palette?.label || node.kind}</p>
            <p className="text-xs text-gray-500 mt-0.5">{summary}</p>
            {node.note && <p className="text-[11px] text-gray-500 italic mt-1">{node.note}</p>}
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
          className="px-1.5 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
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
          className="px-1.5 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(node.id);
          }}
          className="px-1.5 py-0.5 text-[11px] font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
