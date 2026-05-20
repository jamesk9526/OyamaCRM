/**
 * WorkflowCanvas renders the center visual map surface for Steward Paths.
 * Tracks global drag state so child connectors can show/hide drop zones.
 */
"use client";

import { useRef, useState } from "react";
import WorkflowMap from "./WorkflowMap";
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
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

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
      onDragEnter={() => { dragCountRef.current++; setIsDragging(true); }}
      onDragLeave={() => {
        dragCountRef.current--;
        if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragging(false); }
      }}
      onDrop={() => { dragCountRef.current = 0; setIsDragging(false); }}
    >
      <div className="mx-auto w-full min-w-[640px] max-w-3xl">
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
          isDragging={isDragging}
        />
      </div>
    </div>
  );
}
