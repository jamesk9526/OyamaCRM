/**
 * WorkflowCanvas renders the center visual map surface for Steward Paths.
 * Tracks global drag state so child connectors can show/hide drop zones.
 */
"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import WorkflowMap from "./WorkflowMap";
import type { NodeInsertTarget, WorkflowDocument, WorkflowNodeCanvasOffset } from "./workflow-types";
import { isBranchNode } from "./workflow-types";
import {
  getBranchLaneEndAnchorId,
  getBranchLaneStartAnchorId,
  type WorkflowContainerRef,
} from "./workflow-utils";

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
  onResetLayout?: () => void;
}

interface CanvasConnectorLine {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  overlay: boolean;
}

interface CanvasPanDragState {
  pointerId: number;
  startX: number;
  startY: number;
  originPanX: number;
  originPanY: number;
}

interface CanvasMiniNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CANVAS_GRID_SIZE = 20;

/** Returns visual parent-child edges that should stay connected during free drag. */
function collectWorkflowEdges(doc: WorkflowDocument): Array<{ sourceId: string; targetId: string }> {
  const edges: Array<{ sourceId: string; targetId: string }> = [];

  function visit(ids: string[]) {
    for (let index = 0; index < ids.length; index += 1) {
      const currentId = ids[index];
      const nextId = ids[index + 1];

      const node = doc.nodesById[currentId];
      if (!node) continue;

      if (!isBranchNode(node)) {
        if (nextId) {
          edges.push({ sourceId: currentId, targetId: nextId });
        }
        continue;
      }

      for (const lane of node.lanes) {
        const laneStartAnchorId = getBranchLaneStartAnchorId(lane.id);
        const laneEndAnchorId = getBranchLaneEndAnchorId(lane.id);
        const firstLaneNodeId = lane.nodeIds[0];
        const laneTerminalNodeId = lane.nodeIds[lane.nodeIds.length - 1] ?? laneStartAnchorId;

        edges.push({ sourceId: node.id, targetId: laneStartAnchorId });
        if (firstLaneNodeId) {
          edges.push({ sourceId: laneStartAnchorId, targetId: firstLaneNodeId });
        }
        edges.push({ sourceId: laneTerminalNodeId, targetId: laneEndAnchorId });
        if (nextId) {
          edges.push({ sourceId: laneEndAnchorId, targetId: nextId });
        }

        visit(lane.nodeIds);
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
  onResetLayout,
}: WorkflowCanvasProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [connectorLines, setConnectorLines] = useState<CanvasConnectorLine[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 900 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [laneOffsets, setLaneOffsets] = useState<Record<string, WorkflowNodeCanvasOffset>>({});
  const [miniNodes, setMiniNodes] = useState<CanvasMiniNode[]>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragCountRef = useRef(0);
  const panDragRef = useRef<CanvasPanDragState | null>(null);

  const setZoomClamped = useCallback((nextZoom: number | ((current: number) => number)) => {
    setZoom((current) => {
      const resolved = typeof nextZoom === "function" ? nextZoom(current) : nextZoom;
      return Math.min(1.7, Math.max(0.55, resolved));
    });
  }, []);

  function canStartPanFromTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.closest("[data-workflow-node-id], button, input, select, textarea, a")) return false;
    return true;
  }

  function beginCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    const allowMiddleButtonPan = event.button === 1;
    const allowLeftButtonPan = event.button === 0 && canStartPanFromTarget(event.target);
    if (!allowMiddleButtonPan && !allowLeftButtonPan) return;

    event.preventDefault();
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
    };
    setIsPanning(true);

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function moveCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    setPan({ x: drag.originPanX + deltaX, y: drag.originPanY + deltaY });
  }

  function endCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      setZoomClamped((current) => current - event.deltaY * 0.0015);
      return;
    }

    setPan((current) => ({
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    }));
  }, [setZoomClamped]);

  const handleLaneOffsetChange = useCallback((laneId: string, offset: WorkflowNodeCanvasOffset) => {
    setLaneOffsets((current) => {
      const existing = current[laneId] ?? { x: 0, y: 0 };
      if (existing.x === offset.x && existing.y === offset.y) return current;
      return {
        ...current,
        [laneId]: offset,
      };
    });
  }, []);

  const measureConnectorLines = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setCanvasSize((current) => (
      current.width === canvas.clientWidth && current.height === canvas.clientHeight
        ? current
        : { width: canvas.clientWidth, height: canvas.clientHeight }
    ));

    const canvasRect = canvas.getBoundingClientRect();
    const edges = collectWorkflowEdges(doc);
    const branchNodeIds = new Set(
      Object.values(doc.nodesById)
        .filter((node) => isBranchNode(node))
        .map((node) => node.id),
    );
    const nextLines = edges.flatMap((edge) => {
      const source = canvas.querySelector<HTMLElement>(`[data-workflow-node-id="${edge.sourceId}"]`);
      const target = canvas.querySelector<HTMLElement>(`[data-workflow-node-id="${edge.targetId}"]`);
      if (!source || !target) return [];

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const branchAnchorEdge = edge.sourceId.startsWith("__branch_lane_") || edge.targetId.startsWith("__branch_lane_");
      const branchNodeEdge = branchNodeIds.has(edge.sourceId) || branchNodeIds.has(edge.targetId);

      return [{
        id: `${edge.sourceId}-${edge.targetId}`,
        sourceX: sourceRect.left - canvasRect.left + sourceRect.width / 2,
        sourceY: sourceRect.bottom - canvasRect.top,
        targetX: targetRect.left - canvasRect.left + targetRect.width / 2,
        targetY: targetRect.top - canvasRect.top,
        overlay: branchAnchorEdge || branchNodeEdge,
      }];
    });

    setConnectorLines(nextLines);

    const nextMiniNodes = Array.from(canvas.querySelectorAll<HTMLElement>("[data-workflow-node-id]")).flatMap((element) => {
      const nodeId = element.getAttribute("data-workflow-node-id") || "";
      if (!nodeId || nodeId.startsWith("__branch_lane_")) return [];

      const rect = element.getBoundingClientRect();
      return [{
        id: nodeId,
        x: rect.left - canvasRect.left,
        y: rect.top - canvasRect.top,
        width: rect.width,
        height: rect.height,
      }];
    });
    setMiniNodes(nextMiniNodes);
  }, [doc]);

  const miniMapGeometry = useMemo(() => {
    const miniWidth = 108;
    const miniHeight = 82;
    const padding = 5;

    const contentMinX = miniNodes.length ? Math.min(...miniNodes.map((node) => node.x)) : 0;
    const contentMinY = miniNodes.length ? Math.min(...miniNodes.map((node) => node.y)) : 0;
    const contentMaxX = miniNodes.length ? Math.max(...miniNodes.map((node) => node.x + node.width)) : canvasSize.width;
    const contentMaxY = miniNodes.length ? Math.max(...miniNodes.map((node) => node.y + node.height)) : canvasSize.height;

    const totalWidth = Math.max(contentMaxX - contentMinX, canvasSize.width, 1);
    const totalHeight = Math.max(contentMaxY - contentMinY, canvasSize.height, 1);

    const scale = Math.min((miniWidth - padding * 2) / totalWidth, (miniHeight - padding * 2) / totalHeight);
    const scaledWidth = totalWidth * scale;
    const scaledHeight = totalHeight * scale;
    const originX = (miniWidth - scaledWidth) / 2;
    const originY = (miniHeight - scaledHeight) / 2;

    return {
      miniWidth,
      miniHeight,
      contentMinX,
      contentMinY,
      scale,
      originX,
      originY,
      viewportRect: {
        x: originX + (0 - contentMinX) * scale,
        y: originY + (0 - contentMinY) * scale,
        width: canvasSize.width * scale,
        height: canvasSize.height * scale,
      },
    };
  }, [canvasSize.height, canvasSize.width, miniNodes]);

  useLayoutEffect(() => {
    measureConnectorLines();
  }, [doc, measureConnectorLines, nodeOffsets, laneOffsets, zoom, pan]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resizeObserver = new ResizeObserver(() => measureConnectorLines());
    resizeObserver.observe(canvas);
    canvas.addEventListener("wheel", handleCanvasWheel, { passive: false });
    window.addEventListener("resize", measureConnectorLines);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", handleCanvasWheel);
      window.removeEventListener("resize", measureConnectorLines);
    };
  }, [handleCanvasWheel, measureConnectorLines]);

  if (doc.rootNodeIds.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center bg-white"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.22) 1px, transparent 0)",
          backgroundSize: "20px 20px",
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
      className={`relative flex-1 overflow-hidden p-3 md:p-4 ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        backgroundColor: "#f8fafb",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.22) 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }}
      onPointerDown={beginCanvasPan}
      onPointerMove={moveCanvasPan}
      onPointerUp={endCanvasPan}
      onPointerCancel={endCanvasPan}
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
          if (line.overlay) return null;
          const bend = Math.max(34, Math.abs(line.targetY - line.sourceY) * 0.45);
          const path = `M ${line.sourceX} ${line.sourceY} C ${line.sourceX} ${line.sourceY + bend}, ${line.targetX} ${line.targetY - bend}, ${line.targetX} ${line.targetY}`;
          return (
            <path
              key={line.id}
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
              markerEnd="url(#steward-path-arrow)"
            />
          );
        })}
      </svg>

      <svg
        className="pointer-events-none absolute left-0 top-0 z-[12]"
        width={canvasSize.width}
        height={canvasSize.height}
        aria-hidden="true"
      >
        <defs>
          <marker id="steward-path-arrow-overlay" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1 1 7 4 1 7" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {connectorLines.map((line) => {
          if (!line.overlay) return null;
          const bend = Math.max(34, Math.abs(line.targetY - line.sourceY) * 0.45);
          const path = `M ${line.sourceX} ${line.sourceY} C ${line.sourceX} ${line.sourceY + bend}, ${line.targetX} ${line.targetY - bend}, ${line.targetX} ${line.targetY}`;
          return (
            <path
              key={`overlay-${line.id}`}
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
              markerEnd="url(#steward-path-arrow-overlay)"
            />
          );
        })}
      </svg>

      <div className="pointer-events-auto absolute right-4 top-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setZoomClamped(zoom - 0.1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          title="Zoom out"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path strokeLinecap="round" d="M4.5 7h5" />
            <path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setZoomClamped(1)}
          className="inline-flex h-7 min-w-[58px] items-center justify-center rounded-md px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={() => setZoomClamped(zoom + 0.1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          title="Zoom in"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path strokeLinecap="round" d="M4.5 7h5M7 4.5v5" />
            <path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            setZoomClamped(1.2);
            setPan({ x: 0, y: 0 });
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          title="Focus"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6v-3.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setShowMiniMap((current) => !current)}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${showMiniMap ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`}
          title={showMiniMap ? "Hide mini map" : "Show mini map"}
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" d="M3.5 3.5h9v9h-9z" />
            <path d="M6.5 3.5v9M9.5 3.5v9M3.5 6.5h9M3.5 9.5h9" />
          </svg>
        </button>
      </div>

      {showMiniMap ? (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex items-end gap-2">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-sm">
            <svg width={miniMapGeometry.miniWidth} height={miniMapGeometry.miniHeight} aria-hidden="true">
              <rect x="0" y="0" width={miniMapGeometry.miniWidth} height={miniMapGeometry.miniHeight} fill="#f8fafc" stroke="#e2e8f0" />
              {miniNodes.map((node) => (
                <rect
                  key={node.id}
                  x={miniMapGeometry.originX + (node.x - miniMapGeometry.contentMinX) * miniMapGeometry.scale}
                  y={miniMapGeometry.originY + (node.y - miniMapGeometry.contentMinY) * miniMapGeometry.scale}
                  width={Math.max(2, node.width * miniMapGeometry.scale)}
                  height={Math.max(2, node.height * miniMapGeometry.scale)}
                  rx="0.8"
                  fill="#cbd5e1"
                  stroke="#94a3b8"
                  strokeWidth="0.5"
                />
              ))}
              <rect
                x={miniMapGeometry.viewportRect.x}
                y={miniMapGeometry.viewportRect.y}
                width={miniMapGeometry.viewportRect.width}
                height={miniMapGeometry.viewportRect.height}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1"
              />
            </svg>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setZoomClamped(1.2);
                setPan({ x: 0, y: 0 });
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
              title="Fit view"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6v-3.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
            {onResetLayout ? (
              <button
                type="button"
                onClick={() => {
                  onResetLayout();
                  setLaneOffsets({});
                  setPan({ x: 0, y: 0 });
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                title="Reset layout"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a5 5 0 0 1 8.5-3.5L13 6M13 3v3h-3M13 8a5 5 0 0 1-8.5 3.5L3 10M3 13v-3h3" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="relative z-10 mx-auto w-full min-w-[780px] max-w-5xl"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "top center",
        }}
      >
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
          laneOffsets={laneOffsets}
          onLaneOffsetChange={handleLaneOffsetChange}
          gridSize={CANVAS_GRID_SIZE}
        />
      </div>

    </div>
  );
}
