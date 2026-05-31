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
      <div className="flex flex-col items-center py-1.5">
        {showLine && <span className="h-4 w-px bg-slate-300" />}
        <div
          className={`flex w-full max-w-[240px] items-center justify-center rounded-full border-2 border-dashed text-[11px] font-semibold transition-all duration-100 select-none
            ${isOver
              ? "h-9 border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
              : "h-6 border-slate-300 bg-white text-slate-400"
            }`}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsOver(true); }}
          onDragLeave={() => setIsOver(false)}
          onDrop={(e) => { onDrop(e); setIsOver(false); }}
        >
          {isOver ? "Drop node here" : "Drop zone"}
        </div>
        {showLine && <span className="h-4 w-px bg-slate-300" />}
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-center py-1.5">
      {showLine && <span className="h-5 w-px bg-slate-300" />}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[12px] leading-none text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          aria-label={addLabel}
          title={addLabel}
        >
          +
        </button>
      )}
    </div>
  );
}
