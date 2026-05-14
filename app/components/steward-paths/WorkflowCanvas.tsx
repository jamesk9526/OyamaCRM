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

  if (doc.rootNodeIds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-100/80">
        <div className="max-w-md text-center px-6">
          <h2 className="text-base font-semibold text-gray-900">No steps yet</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add a trigger first, then connect timing, email, print, task, donor data, logic, and safety blocks into a visual stewardship map.
          </p>
          <button
            type="button"
            onClick={() => onInsertTarget({ kind: "root-end" })}
            className="mt-3 rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            + Add first step
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-100/80 p-6">
      <div className="mx-auto mb-3 flex w-full max-w-6xl items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
        <p className="text-xs font-medium text-gray-600">Workflow map depth: {depth} lane level{depth === 1 ? "" : "s"}</p>
        <p className="text-xs text-gray-500">Zoom-friendly spacing enabled. Drag and drop is active.</p>
      </div>

      <div className="mx-auto w-full min-w-[780px] max-w-6xl rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-inner">
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
