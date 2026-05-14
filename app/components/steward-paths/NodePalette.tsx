/**
 * NodePalette renders a searchable, collapsible block library for the canvas.
 */
"use client";

import { useMemo, useState } from "react";

import { CATEGORY_LABELS, PALETTE_ITEMS } from "./palette-catalog";
import { getReadinessBadge, type NodeCategory, type NodePaletteItem } from "./workflow-types";

interface NodePaletteProps {
  /** Called when the user clicks the "Add" button on a palette block. */
  onAdd: (item: NodePaletteItem) => void;
  /** Optional text describing where the next add action inserts in the canvas. */
  insertionTargetLabel?: string;
}

const CATEGORY_ORDER: NodeCategory[] = [
  "trigger",
  "timing",
  "email",
  "print",
  "task",
  "donor-data",
  "logic",
  "safety",
];

/** Groups items by category so the palette renders one section per group. */
function groupByCategory(): Array<{ category: NodeCategory; items: NodePaletteItem[] }> {
  const groups = new Map<NodeCategory, NodePaletteItem[]>();
  for (const item of PALETTE_ITEMS) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return CATEGORY_ORDER
    .map((category) => ({ category, items: groups.get(category) ?? [] }))
    .filter((group) => group.items.length > 0);
}

/** Left-panel palette of draggable blocks. */
export default function NodePalette({ onAdd, insertionTargetLabel }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<NodeCategory, boolean>>({
    trigger: false,
    timing: false,
    email: false,
    print: true,
    task: false,
    "donor-data": true,
    logic: false,
    safety: true,
  });

  const groups = useMemo(() => {
    const allGroups = groupByCategory();
    const needle = query.trim().toLowerCase();
    if (!needle) return allGroups;
    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => (
          item.label.toLowerCase().includes(needle)
          || item.summary.toLowerCase().includes(needle)
          || item.kind.toLowerCase().includes(needle)
        )),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Block Library</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Drag blocks onto the map or click Add to insert at the selected connector.
        </p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks"
          className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
        {insertionTargetLabel && (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
            <p className="text-[11px] font-semibold text-emerald-800">Add target</p>
            <p className="text-[11px] text-emerald-700">{insertionTargetLabel}</p>
          </div>
        )}
      </div>
      <div className="p-3 space-y-4">
        {groups.map((group) => (
          <section key={group.category}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.category]: !prev[group.category] }))}
              className="mb-2 flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"
            >
              <span>{CATEGORY_LABELS[group.category]}</span>
              <span>{collapsed[group.category] ? "+" : "-"}</span>
            </button>
            {!collapsed[group.category] && (
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const badge = getReadinessBadge(item.readiness);
                  return (
                    <div
                      key={item.kind}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/x-oyama-palette-kind", item.kind);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      className="rounded-md border border-gray-200 bg-gray-50 p-2 transition-colors hover:border-green-300 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{item.summary}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.toneClass}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Drag or Add</span>
                        <button
                          type="button"
                          onClick={() => onAdd(item)}
                          className="rounded-md border border-green-300 px-2 py-0.5 text-[11px] font-semibold text-green-700 hover:bg-green-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-xs text-gray-500">
            No blocks match your search.
          </p>
        )}
      </div>
    </aside>
  );
}
