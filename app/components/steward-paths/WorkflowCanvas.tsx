/**
 * WorkflowCanvas renders the center visual map surface for Steward Paths.
 */
"use client";

import WorkflowMap from "./WorkflowMap";
import { computeWorkflowDepth } from "./workflow-layout";
import type { NodeInsertTarget, WorkflowDocument } from "./workflow-types";
import type { WorkflowContainerRef } from "./workflow-utils";

interface WorkflowCanvasProps {
  doc: WorkflowDocument;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onMoveNode: (nodeId: string, delta: -1 | 1) => void;
  onRemove: (nodeId: string) => void;
  onInsertTarget: (target: NodeInsertTarget) => void;
  onDropNode: (nodeId: string, container: WorkflowContainerRef, index: number) => void;
  onDropPaletteKind: (kind: string, target: NodeInsertTarget) => void;
}

/** Center-panel map canvas with recursive lane rendering and zoom-friendly spacing. */
export default function WorkflowCanvas({
  doc,
  selectedNodeId,
  onSelect,
  onMoveNode,
  onRemove,
  onInsertTarget,
  onDropNode,
  onDropPaletteKind,
}: WorkflowCanvasProps) {
  const depth = computeWorkflowDepth(doc);
  const totalNodeCount = Object.keys(doc.nodesById).length;
  const branchNodeCount = Object.values(doc.nodesById).filter((node) => node.nodeType === "branch").length;

  if (doc.rootNodeIds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-emerald-50/40">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white/95 px-6 py-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">No steps yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add a trigger first, then connect timing, email, print, task, donor data, logic, and safety blocks into a visual stewardship map.
          </p>
          <button
            type="button"
            onClick={() => onInsertTarget({ kind: "root-end" })}
            className="mt-4 rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            + Add first step
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.18) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="mx-auto mb-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-semibold text-gray-700">
            {totalNodeCount} node{totalNodeCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
            {branchNodeCount} branch group{branchNodeCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
            Depth {depth}
          </span>
        </div>
        <p className="text-xs text-gray-500">Drag blocks from library. Drop zones are highlighted for fast insertion.</p>
      </div>

      <div className="mx-auto w-full min-w-[820px] max-w-6xl rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-inner backdrop-blur-[1px]">
        <WorkflowMap
          doc={doc}
          nodeIds={doc.rootNodeIds}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelect}
          onMoveNode={onMoveNode}
          onRemoveNode={onRemove}
          onInsertTarget={onInsertTarget}
          onDropNode={onDropNode}
          onDropPaletteKind={onDropPaletteKind}
          container={{ kind: "root" }}
        />
      </div>
    </div>
  );
}
