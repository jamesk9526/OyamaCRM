/**
 * NodePalette renders the "Add Step" left-panel block library for the canvas.
 * Organised into three sections: TRIGGERS, ACTIONS, FLOW CONTROL.
 */
"use client";

import { useMemo, useState } from "react";
import { PALETTE_ITEMS } from "./palette-catalog";
import type { NodeCategory, NodePaletteItem } from "./workflow-types";

interface NodePaletteProps {
  /** Called when the user clicks a palette block to add it. */
  onAdd: (item: NodePaletteItem) => void;
  /** Optional text describing where the next add action inserts in the canvas. */
  insertionTargetLabel?: string;
}

/** Three top-level sections and the categories that belong to each. */
const SECTIONS: Array<{
  key: string;
  label: string;
  categories: NodeCategory[];
}> = [
  { key: "triggers", label: "TRIGGERS", categories: ["trigger"] },
  { key: "actions", label: "ACTIONS", categories: ["email", "print", "task", "donor-data", "safety"] },
  { key: "flow-control", label: "FLOW CONTROL", categories: ["timing", "logic"] },
];

/** Returns an SVG icon element for a palette item based on its category/kind. */
function PaletteItemIcon({ kind, category }: { kind: string; category: NodeCategory }) {
  const cls = "h-4 w-4 shrink-0";

  if (category === "trigger") {
    if (kind.includes("donation")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 13.5S2.5 10 2.5 6a5.5 5.5 0 0111 0c0 4-5.5 7.5-5.5 7.5z" />
        </svg>
      );
    }
    if (kind.includes("form")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" d="M5 6h6M5 9h4" />
        </svg>
      );
    }
    if (kind.includes("event")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="10" rx="1.5" /><path strokeLinecap="round" d="M5 2v3M11 2v3M2 7h12" />
        </svg>
      );
    }
    if (kind.includes("api")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 5.5L2 8l3.5 2.5M10.5 5.5L14 8l-3.5 2.5M9 4l-2 8" />
        </svg>
      );
    }
    if (kind.includes("tag")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
        </svg>
      );
    }
    // default trigger = person/segment
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    );
  }

  if (category === "email") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5l6.5 4 6.5-4" />
      </svg>
    );
  }

  if (category === "print") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5V2h8v3M2 5h12a1 1 0 011 1v5a1 1 0 01-1 1h-2v2H4v-2H2a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </svg>
    );
  }

  if (category === "task") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l2 2 3-3" />
      </svg>
    );
  }

  if (category === "donor-data") {
    if (kind.includes("tag")) {
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5V2z" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
        </svg>
      );
    }
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="5" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    );
  }

  if (category === "safety") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2L3 4.5v4c0 3.1 2.5 5.5 5 6.5 2.5-1 5-3.4 5-6.5v-4L8 2z" />
      </svg>
    );
  }

  if (category === "timing") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 5v3l2.5 1.5" />
      </svg>
    );
  }

  if (category === "logic") {
    return (
      <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M5 7l3 2 3-2M5 11h6M4 13h2M10 13h2" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" />
    </svg>
  );
}

/** Color class for the icon container background based on section. */
function iconBg(section: string): string {
  if (section === "triggers") return "bg-green-100 text-green-700";
  if (section === "actions") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

/** Left-panel palette of clickable step blocks, grouped into TRIGGERS / ACTIONS / FLOW CONTROL. */
export default function NodePalette({ onAdd, insertionTargetLabel }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    triggers: false,
    actions: false,
    "flow-control": false,
  });

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SECTIONS.map((section) => {
      const items = PALETTE_ITEMS.filter(
        (item) => section.categories.includes(item.category as NodeCategory),
      ).filter((item) =>
        !needle
          || item.label.toLowerCase().includes(needle)
          || item.summary.toLowerCase().includes(needle)
          || item.kind.toLowerCase().includes(needle),
      );
      return { ...section, items };
    }).filter((s) => s.items.length > 0);
  }, [query]);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* header */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Add Step</h2>
        {insertionTargetLabel && (
          <p className="mt-0.5 truncate text-[11px] text-green-600">{insertionTargetLabel}</p>
        )}
        {/* search */}
        <div className="relative mt-2">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search steps"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-green-500 focus:bg-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            {/* section header */}
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{section.label}</span>
              <svg
                className={`h-3 w-3 text-slate-400 transition-transform ${collapsed[section.key] ? "" : "rotate-180"}`}
                viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {/* items */}
            {!collapsed[section.key] && (
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-oyama-palette-kind", item.kind);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(item)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 active:bg-slate-100"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg(section.key)}`}>
                      <PaletteItemIcon kind={item.kind} category={item.category as NodeCategory} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{item.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {sections.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
            No steps match your search.
          </p>
        )}
      </div>
    </aside>
  );
}
