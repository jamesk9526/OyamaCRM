/**
 * WorkflowMap recursively renders workflow nodes, connectors, and branch groups.
 */
"use client";

import BranchGroup from "./BranchGroup";
import WorkflowConnector from "./WorkflowConnector";
import WorkflowNodeCard from "./WorkflowNodeCard";
import type { NodeInsertTarget, WorkflowDocument, WorkflowNodeCanvasOffset } from "./workflow-types";
import { isBranchNode } from "./workflow-types";
import type { WorkflowContainerRef } from "./workflow-utils";
import type { DragEvent } from "react";

interface WorkflowMapProps {
  doc: WorkflowDocument;
  nodeIds: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, delta: -1 | 1) => void;
  onRemoveNode: (nodeId: string) => void;
  onInsertTarget: (target: NodeInsertTarget) => void;
  onDropNode: (nodeId: string, container: WorkflowContainerRef, index: number) => void;
  onDropPaletteKind: (kind: string, target: NodeInsertTarget) => void;
  container:
    | { kind: "root" }
    | { kind: "branch-lane"; branchNodeId: string; laneId: string };
  compact?: boolean;
  /** Passed from WorkflowCanvas to reveal drop zones while dragging. */
  isDragging?: boolean;
  nodeOffsets: Record<string, WorkflowNodeCanvasOffset>;
  onNodeOffsetChange: (nodeId: string, offset: WorkflowNodeCanvasOffset) => void;
  laneOffsets: Record<string, WorkflowNodeCanvasOffset>;
  onLaneOffsetChange: (laneId: string, offset: WorkflowNodeCanvasOffset) => void;
  gridSize: number;
  numberPrefix?: string;
}

/** Recursive map renderer for top-level workflow nodes and nested lane nodes. */
export default function WorkflowMap({
  doc,
  nodeIds,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onRemoveNode,
  onInsertTarget,
  onDropNode,
  onDropPaletteKind,
  container,
  compact = false,
  isDragging = false,
  nodeOffsets,
  onNodeOffsetChange,
  laneOffsets,
  onLaneOffsetChange,
  gridSize,
  numberPrefix = "",
}: WorkflowMapProps) {
  const containerRef: WorkflowContainerRef = container.kind === "root"
    ? { kind: "root" }
    : { kind: "branch-lane", branchNodeId: container.branchNodeId, laneId: container.laneId };

  function handleDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData("application/x-oyama-node-id");
    if (nodeId) {
      onDropNode(nodeId, containerRef, index);
      return;
    }

    const paletteKind = event.dataTransfer.getData("application/x-oyama-palette-kind");
    if (!paletteKind) return;

    if (containerRef.kind === "root") {
      if (index <= 0 || nodeIds.length === 0) {
        onDropPaletteKind(paletteKind, nodeIds.length === 0 ? { kind: "root-end" } : { kind: "root-start" });
        return;
      }
      const previousNodeId = nodeIds[Math.min(index - 1, nodeIds.length - 1)] ?? null;
      onDropPaletteKind(paletteKind, previousNodeId ? { kind: "after-node", nodeId: previousNodeId } : { kind: "root-end" });
      return;
    }

    if (index <= 0) {
      onDropPaletteKind(paletteKind, {
        kind: "branch-lane",
        branchNodeId: containerRef.branchNodeId,
        laneId: containerRef.laneId,
      });
      return;
    }

    const previousNodeId = nodeIds[Math.min(index - 1, nodeIds.length - 1)] ?? null;
    onDropPaletteKind(paletteKind, {
      kind: "branch-lane",
      branchNodeId: containerRef.branchNodeId,
      laneId: containerRef.laneId,
      afterNodeId: previousNodeId ?? undefined,
    });
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-1"}>
      {/* Top drop zone — only visible when dragging */}
      <WorkflowConnector
        showLine={false}
        isDragging={isDragging}
        onDrop={(e) => handleDrop(e, 0)}
      />

      {nodeIds.map((nodeId, index) => {
        const node = doc.nodesById[nodeId];
        if (!node) return null;
        const numberLabel = `${numberPrefix}${index + 1}`;

        return (
          <div key={node.id} className="flex flex-col items-center">
            <div className={compact ? "w-full" : "w-full"}>
              <div className={compact ? "w-full" : "mx-auto w-[255px]"}>
                <WorkflowNodeCard
                  node={node}
                  numberLabel={numberLabel}
                  isSelected={selectedNodeId === node.id}
                  onSelect={onSelectNode}
                  onMoveUp={(id) => onMoveNode(id, -1)}
                  onMoveDown={(id) => onMoveNode(id, 1)}
                  onRemove={onRemoveNode}
                  canMoveUp={index > 0}
                  canMoveDown={index < nodeIds.length - 1}
                  compact={compact}
                  freeOffset={nodeOffsets[node.id] ?? { x: 0, y: 0 }}
                  onFreeMove={onNodeOffsetChange}
                  gridSize={gridSize}
                  onDragStartNode={() => {
                    onSelectNode(node.id);
                  }}
                />
              </div>

              {isBranchNode(node) && (
                <BranchGroup
                  branchNode={node}
                  selectedBranchNode={selectedNodeId === node.id}
                  onSelectBranchNode={onSelectNode}
                  laneOffsets={laneOffsets}
                  onLaneOffsetChange={onLaneOffsetChange}
                  gridSize={gridSize}
                  onAddToLaneStart={(laneId) => onInsertTarget({
                    kind: "branch-lane",
                    branchNodeId: node.id,
                    laneId,
                  })}
                  renderLaneContent={(lane, laneIndex) => (
                    <WorkflowMap
                      doc={doc}
                      nodeIds={lane.nodeIds}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={onSelectNode}
                      onMoveNode={onMoveNode}
                      onRemoveNode={onRemoveNode}
                      onInsertTarget={onInsertTarget}
                      onDropNode={onDropNode}
                      onDropPaletteKind={onDropPaletteKind}
                      container={{ kind: "branch-lane", branchNodeId: node.id, laneId: lane.id }}
                      compact
                      isDragging={isDragging}
                      nodeOffsets={nodeOffsets}
                      onNodeOffsetChange={onNodeOffsetChange}
                      laneOffsets={laneOffsets}
                      onLaneOffsetChange={onLaneOffsetChange}
                      gridSize={gridSize}
                      numberPrefix={`${numberLabel}${String.fromCharCode(65 + laneIndex)}.`}
                    />
                  )}
                />
              )}
            </div>

            {/* Connector between nodes — becomes drop zone while dragging */}
            <WorkflowConnector
              showLine={index < nodeIds.length - 1}
              onAdd={() => onInsertTarget({ kind: "after-node", nodeId: node.id })}
              addLabel="Add step after this node"
              isDragging={isDragging}
              onDrop={(e) => handleDrop(e, index + 1)}
            />
          </div>
        );
      })}

      {nodeIds.length === 0 && container.kind === "root" && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => onInsertTarget({ kind: "root-end" })}
            className="rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
          >
            + Add first step
          </button>
        </div>
      )}

      {nodeIds.length === 0 && container.kind === "branch-lane" && (
        <div
          className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/70 p-3 text-center text-xs text-emerald-800"
          onDragOver={(event) => { event.preventDefault(); }}
          onDrop={(event) => handleDrop(event, 0)}
        >
          Drop first step in this lane
        </div>
      )}
    </div>
  );
}
