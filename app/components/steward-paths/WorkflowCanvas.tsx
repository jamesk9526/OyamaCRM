/**
 * WorkflowCanvas renders the center visual map surface for Steward Paths.
 * Tracks global drag state so child connectors can show/hide drop zones.
 */
"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import WorkflowMap from "./WorkflowMap";
import type { NodeInsertTarget, WorkflowDocument, WorkflowNodeCanvasOffset } from "./workflow-types";
import { isBranchNode } from "./workflow-types";
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
  nodeOffsets: Record<string, WorkflowNodeCanvasOffset>;
  onNodeOffsetChange: (nodeId: string, offset: WorkflowNodeCanvasOffset) => void;
}

interface CanvasConnectorLine {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

/** Returns visual parent-child edges that should stay connected during free drag. */
function collectWorkflowEdges(doc: WorkflowDocument): Array<{ sourceId: string; targetId: string }> {
  const edges: Array<{ sourceId: string; targetId: string }> = [];

  function visit(ids: string[]) {
    for (let index = 0; index < ids.length; index += 1) {
      const currentId = ids[index];
      const nextId = ids[index + 1];
      if (nextId) {
        edges.push({ sourceId: currentId, targetId: nextId });
      }

      const node = doc.nodesById[currentId];
      if (node && isBranchNode(node)) {
        for (const lane of node.lanes) {
          const firstLaneNodeId = lane.nodeIds[0];
          if (firstLaneNodeId) {
            edges.push({ sourceId: node.id, targetId: firstLaneNodeId });
          }
          visit(lane.nodeIds);
        }
      }
    }
  }

  visit(doc.rootNodeIds);
  return edges;
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
  nodeOffsets,
  onNodeOffsetChange,
}: WorkflowCanvasProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [connectorLines, setConnectorLines] = useState<CanvasConnectorLine[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 900 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragCountRef = useRef(0);

  const measureConnectorLines = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setCanvasSize((current) => (
      current.width === canvas.scrollWidth && current.height === canvas.scrollHeight
        ? current
        : { width: canvas.scrollWidth, height: canvas.scrollHeight }
    ));

    const canvasRect = canvas.getBoundingClientRect();
    const edges = collectWorkflowEdges(doc);
    const nextLines = edges.flatMap((edge) => {
      const source = canvas.querySelector<HTMLElement>(`[data-workflow-node-id="${edge.sourceId}"]`);
      const target = canvas.querySelector<HTMLElement>(`[data-workflow-node-id="${edge.targetId}"]`);
      if (!source || !target) return [];

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      return [{
        id: `${edge.sourceId}-${edge.targetId}`,
        sourceX: sourceRect.left - canvasRect.left + canvas.scrollLeft + sourceRect.width / 2,
        sourceY: sourceRect.bottom - canvasRect.top + canvas.scrollTop,
        targetX: targetRect.left - canvasRect.left + canvas.scrollLeft + targetRect.width / 2,
        targetY: targetRect.top - canvasRect.top + canvas.scrollTop,
      }];
    });

    setConnectorLines(nextLines);
  }, [doc]);

  useLayoutEffect(() => {
    measureConnectorLines();
  }, [doc, measureConnectorLines, nodeOffsets]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resizeObserver = new ResizeObserver(() => measureConnectorLines());
    resizeObserver.observe(canvas);
    const onScroll = () => measureConnectorLines();
    canvas.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureConnectorLines);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureConnectorLines);
    };
  }, [measureConnectorLines]);

  if (doc.rootNodeIds.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center bg-white"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.28) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      >
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
      ref={canvasRef}
      className="relative flex-1 overflow-auto p-6"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.28) 1px, transparent 0)",
        backgroundSize: "18px 18px",
      }}
      onDragEnter={() => { dragCountRef.current++; setIsDragging(true); }}
      onDragLeave={() => {
        dragCountRef.current--;
        if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragging(false); }
      }}
      onDrop={() => { dragCountRef.current = 0; setIsDragging(false); }}
    >
      <svg
        className="pointer-events-none absolute left-0 top-0 z-0"
        width={canvasSize.width}
        height={canvasSize.height}
        aria-hidden="true"
      >
        <defs>
          <marker id="steward-path-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1 1 7 4 1 7" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {connectorLines.map((line) => {
          const bend = Math.max(38, Math.abs(line.targetY - line.sourceY) * 0.45);
          const path = `M ${line.sourceX} ${line.sourceY} C ${line.sourceX} ${line.sourceY + bend}, ${line.targetX} ${line.targetY - bend}, ${line.targetX} ${line.targetY}`;
          return (
            <path
              key={line.id}
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.6"
              strokeLinecap="round"
              markerEnd="url(#steward-path-arrow)"
            />
          );
        })}
      </svg>

      <div className="relative z-10 mx-auto w-full min-w-[780px] max-w-5xl">
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
          nodeOffsets={nodeOffsets}
          onNodeOffsetChange={onNodeOffsetChange}
        />
      </div>
      <div className="pointer-events-none sticky bottom-5 left-full ml-auto mr-3 h-36 w-36 rounded-lg border border-slate-300 bg-white/90 p-2 shadow-sm">
        <div className="relative h-full w-full rounded bg-slate-50">
          <span className="absolute left-12 top-2 h-5 w-8 rounded border border-slate-300 bg-white" />
          <span className="absolute left-11 top-9 h-6 w-10 rounded border border-blue-300 bg-blue-50" />
          <span className="absolute left-12 top-[4.4rem] h-5 w-8 rounded border border-amber-300 bg-amber-50" />
          <span className="absolute left-3 top-[5.8rem] h-5 w-9 rounded border border-green-300 bg-green-50" />
          <span className="absolute right-3 top-[5.8rem] h-5 w-9 rounded border border-blue-300 bg-blue-50" />
          <span className="absolute inset-x-6 top-8 h-16 rounded border-2 border-blue-400/70" />
        </div>
      </div>
    </div>
  );
}
