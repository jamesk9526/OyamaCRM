/**
 * WorkflowConnector renders map connector lines, plus-buttons, and drag-over drop zones.
 * In drag mode (isDragging=true) it becomes the primary drop target between nodes.
 */
"use client";

import { useState } from "react";
import type { DragEvent } from "react";

interface WorkflowConnectorProps {
  showLine?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  /** Set to true while any node is being dragged over the canvas. */
  isDragging?: boolean;
  /** Called when a node or palette item is dropped on this connector's drop zone. */
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}

/** Vertical connector with optional add-step button, and a drag-over drop zone in drag mode. */
export default function WorkflowConnector({
  showLine = true,
  onAdd,
  addLabel = "Add step",
  isDragging = false,
  onDrop,
}: WorkflowConnectorProps) {
  const [isOver, setIsOver] = useState(false);

  if (isDragging && onDrop) {
    return (
      <div className="flex flex-col items-center py-1">
        {showLine && <span className="h-3 w-px bg-slate-200" />}
        <div
          className={`w-full max-w-xs rounded-lg border-2 border-dashed transition-all duration-100 flex items-center justify-center text-xs font-medium select-none
            ${isOver
              ? "h-10 border-green-500 bg-green-50 text-green-700 shadow-sm"
              : "h-5 border-slate-300 bg-slate-50/50 text-slate-300"
            }`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsOver(true); }}
          onDragLeave={() => setIsOver(false)}
          onDrop={(e) => { onDrop(e); setIsOver(false); }}
        >
          {isOver ? "Drop here" : "·"}
        </div>
        {showLine && <span className="h-3 w-px bg-slate-200" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-1">
      {showLine && <span className="h-6 w-px bg-gradient-to-b from-emerald-300 to-emerald-100" />}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300 bg-white text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 text-sm leading-none"
          aria-label={addLabel}
          title={addLabel}
        >
          +
        </button>
      )}
    </div>
  );
}
