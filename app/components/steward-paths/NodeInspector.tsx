/**
 * NodeInspector is the right-panel editor for the currently selected workflow
 * node. It lets the user rename the node, edit a free-form note, and (for
 * step kinds with shipped configuration) tweak supported fields like delay
 * amount/unit or task title.
 *
 * Phase 4 keeps this intentionally minimal — the per-kind dynamic forms will
 * grow as Phase 5 step types come online.
 */
"use client";

import { PALETTE_ITEMS } from "./palette-catalog";
import { getReadinessBadge, type WorkflowNode } from "./workflow-types";

interface NodeInspectorProps {
  node: WorkflowNode | null;
  onChange: (next: WorkflowNode) => void;
}

/** Reads a string value from the node config safely. */
function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

/** Reads a numeric value from the node config safely. */
function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Right-panel inspector for the selected node. */
export default function NodeInspector({ node, onChange }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="w-80 shrink-0 border-l border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Inspector</h2>
        <p className="text-xs text-gray-500 mt-1">Select a node on the canvas to edit its settings.</p>
      </aside>
    );
  }

  const palette = PALETTE_ITEMS.find((item) => item.kind === node.kind);
  const badge = getReadinessBadge(palette?.readiness ?? "not-implemented");

  function update(partial: Partial<WorkflowNode>) {
    if (!node) return;
    onChange({ ...node, ...partial });
  }

  function updateConfig(key: string, value: unknown) {
    if (!node) return;
    onChange({ ...node, config: { ...node.config, [key]: value } });
  }

  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Inspector</h2>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.toneClass}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{palette?.label ?? node.kind}</p>
      </div>

      <div className="p-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Title</span>
          <input
            type="text"
            value={node.title}
            onChange={(event) => update({ title: event.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700">Note</span>
          <textarea
            value={node.note ?? ""}
            onChange={(event) => update({ note: event.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            rows={2}
            placeholder="Optional note shown beneath the title."
          />
        </label>

        {node.kind === "timing.delay" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Amount</span>
              <input
                type="number"
                min={1}
                value={readNumber(node.config, "amount", 1)}
                onChange={(event) => updateConfig("amount", Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Unit</span>
              <select
                value={readString(node.config, "unit") || "days"}
                onChange={(event) => updateConfig("unit", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </label>
          </div>
        )}

        {node.kind === "task.create" && (
          <>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Task title</span>
              <input
                type="text"
                value={readString(node.config, "title")}
                onChange={(event) => updateConfig("title", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Priority</span>
              <select
                value={readString(node.config, "priority") || "MEDIUM"}
                onChange={(event) => updateConfig("priority", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
          </>
        )}

        {node.kind === "print.generate_letter" && (
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Letter template ID</span>
            <input
              type="text"
              value={readString(node.config, "templateId")}
              onChange={(event) => updateConfig("templateId", event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              placeholder="Open Letters & Printables to copy a template ID"
            />
          </label>
        )}

        {palette?.readiness !== "working" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            This block is {palette ? getReadinessBadge(palette.readiness).label.toLowerCase() : "not implemented"}.
            It will appear on the path but will not run end-to-end yet. See the unified refactor doc for the rollout plan.
          </div>
        )}
      </div>
    </aside>
  );
}
