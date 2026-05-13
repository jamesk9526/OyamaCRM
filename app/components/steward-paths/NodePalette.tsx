/**
 * NodePalette renders the categorized list of palette blocks the user can add
 * to the workflow canvas. Each block button calls onAdd to append a node.
 *
 * Drag/drop is not implemented in this skeleton — the structured "Add" button
 * is the always-available fallback, per the refactor doc Phase 4.
 */
"use client";

import { CATEGORY_LABELS, PALETTE_ITEMS } from "./palette-catalog";
import { getReadinessBadge, type NodeCategory, type NodePaletteItem } from "./workflow-types";

interface NodePaletteProps {
  /** Called when the user clicks the "Add" button on a palette block. */
  onAdd: (item: NodePaletteItem) => void;
}

/** Groups items by category so the palette renders one section per group. */
function groupByCategory(): Array<{ category: NodeCategory; items: NodePaletteItem[] }> {
  const groups = new Map<NodeCategory, NodePaletteItem[]>();
  for (const item of PALETTE_ITEMS) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

/** Left-panel palette of draggable blocks. */
export default function NodePalette({ onAdd }: NodePaletteProps) {
  const groups = groupByCategory();

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Block Library</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Click Add to drop a block onto the canvas. Drag-and-drop is in development.
        </p>
      </div>
      <div className="p-3 space-y-4">
        {groups.map((group) => (
          <section key={group.category}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {CATEGORY_LABELS[group.category]}
            </h3>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const badge = getReadinessBadge(item.readiness);
                return (
                  <div
                    key={item.kind}
                    className="rounded-md border border-gray-200 bg-gray-50 p-2 hover:border-green-300 hover:bg-white transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.summary}</p>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.toneClass}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onAdd(item)}
                        className="px-2 py-0.5 text-[11px] font-semibold text-green-700 border border-green-300 rounded-md hover:bg-green-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
