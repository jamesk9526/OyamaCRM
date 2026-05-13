/**
 * StewardPathBuilderPage is the three-panel visual builder skeleton:
 * left palette, center canvas (ordered structured cards), right inspector.
 *
 * This is a Phase 4 skeleton — it edits a workflow document in memory only.
 * Persistence wiring to /api/steward-paths happens in a later pass once parity
 * with the existing /automations editor is verified.
 *
 * See docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md.
 */
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import NodeInspector from "./NodeInspector";
import NodePalette from "./NodePalette";
import WorkflowCanvas from "./WorkflowCanvas";
import {
  ENGAGEMENT_STATUS_LEGEND,
  getEngagementStatusChipClass,
} from "@/app/lib/engagement-status";
import type { NodePaletteItem, WorkflowDocument, WorkflowNode } from "./workflow-types";

/** Initial empty workflow document the builder starts with. */
const INITIAL_DOCUMENT: WorkflowDocument = {
  pathName: "Untitled Steward Path",
  status: "draft",
  audienceLabel: "Manual enrollment",
  nodes: [],
  edges: [],
};

/** Generates a stable-enough id for a new node within a single session. */
function makeNodeId(): string {
  return `node_${Math.random().toString(36).slice(2, 10)}`;
}

/** The three-panel Steward Paths builder skeleton. */
export default function StewardPathBuilderPage() {
  const [doc, setDoc] = useState<WorkflowDocument>(INITIAL_DOCUMENT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => doc.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [doc.nodes, selectedNodeId],
  );

  const addNode = useCallback((item: NodePaletteItem) => {
    const next: WorkflowNode = {
      id: makeNodeId(),
      kind: item.kind,
      title: item.label,
      config: item.defaultConfig ? { ...item.defaultConfig } : {},
      statusLabel: "Draft",
    };
    setDoc((prev) => ({ ...prev, nodes: [...prev.nodes, next] }));
    setSelectedNodeId(next.id);
  }, []);

  const updateNode = useCallback((next: WorkflowNode) => {
    setDoc((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === next.id ? next : node)),
    }));
  }, []);

  const moveNode = useCallback((nodeId: string, delta: -1 | 1) => {
    setDoc((prev) => {
      const index = prev.nodes.findIndex((node) => node.id === nodeId);
      if (index === -1) return prev;
      const target = index + delta;
      if (target < 0 || target >= prev.nodes.length) return prev;
      const next = prev.nodes.slice();
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      return { ...prev, nodes: next };
    });
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setDoc((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== nodeId),
    }));
    setSelectedNodeId((current) => (current === nodeId ? null : current));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Workflow-level header controls */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={doc.pathName}
                onChange={(event) => setDoc((prev) => ({ ...prev, pathName: event.target.value }))}
                className="text-base font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-gray-300 outline-none px-1"
              />
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                Preview Skeleton
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Visual builder skeleton (Phase 4). The production editor still lives at
              {" "}
              <Link href="/automations" className="underline">/automations</Link>.
              Changes here are not persisted yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={doc.status}
              onChange={(event) => setDoc((prev) => ({ ...prev, status: event.target.value as WorkflowDocument["status"] }))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="draft">Draft</option>
              <option value="test-mode">Test Mode</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="button"
              disabled
              title="Persistence wires up in a later phase"
              className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled
              title="Persistence wires up in a later phase"
              className="px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md disabled:opacity-50"
            >
              Run Test Enrollment
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-500 mr-1">Status legend:</span>
          {ENGAGEMENT_STATUS_LEGEND.map((label) => (
            <span
              key={label}
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-gray-200 ${getEngagementStatusChipClass(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAdd={addNode} />
        <WorkflowCanvas
          nodes={doc.nodes}
          selectedNodeId={selectedNodeId}
          onSelect={setSelectedNodeId}
          onMoveUp={(id) => moveNode(id, -1)}
          onMoveDown={(id) => moveNode(id, 1)}
          onRemove={removeNode}
        />
        <NodeInspector node={selectedNode} onChange={updateNode} />
      </div>
    </div>
  );
}
