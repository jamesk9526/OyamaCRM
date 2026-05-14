/**
 * BranchLane renders one visual lane card inside a branch node split.
 */
"use client";

import type { ReactNode } from "react";
import type { WorkflowBranchLane as WorkflowBranchLaneType } from "./workflow-types";

interface BranchLaneProps {
  lane: WorkflowBranchLaneType;
  conditionSummary: string;
  children: ReactNode;
  onAddAtStart: () => void;
}

/** Visual lane container with condition chip and empty-state affordance. */
export default function BranchLane({ lane, conditionSummary, children, onAddAtStart }: BranchLaneProps) {
  return (
    <article className="min-w-[260px] flex-1 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          {lane.label}
        </span>
        {lane.isFallback && (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            Otherwise
          </span>
        )}
      </div>

      <p className="text-[11px] text-gray-500">{conditionSummary}</p>

      <div className="mt-3">
        {lane.nodeIds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-center">
            <p className="text-xs font-medium text-emerald-800">Drop or add an action here</p>
            <button
              type="button"
              onClick={onAddAtStart}
              className="mt-2 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              + Add step
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}
