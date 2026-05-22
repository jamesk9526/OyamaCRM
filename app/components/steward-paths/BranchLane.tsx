/**
 * BranchLane renders one visual lane card inside a branch node split.
 */
"use client";

import type { ReactNode } from "react";
import type { WorkflowBranchLane as WorkflowBranchLaneType } from "./workflow-types";

interface BranchLaneProps {
  lane: WorkflowBranchLaneType;
  laneLetter: string;
  conditionSummary: string;
  children: ReactNode;
  onAddAtStart: () => void;
}

/** Visual lane container with condition chip and empty-state affordance. */
export default function BranchLane({ lane, laneLetter, conditionSummary, children, onAddAtStart }: BranchLaneProps) {
  const tone = lane.isFallback
    ? {
      laneBadge: "bg-rose-50 text-rose-700 border-rose-200",
      panelBorder: "border-transparent",
      accent: "bg-rose-300",
      summary: "text-slate-600",
      emptyBorder: "border-slate-300",
      emptyBg: "bg-slate-50/70",
      buttonBorder: "border-slate-300",
      buttonText: "text-slate-700",
      buttonHover: "hover:bg-slate-50",
    }
    : {
      laneBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      panelBorder: "border-transparent",
      accent: "bg-emerald-500",
      summary: "text-emerald-700",
      emptyBorder: "border-emerald-300",
      emptyBg: "bg-emerald-50/70",
      buttonBorder: "border-emerald-300",
      buttonText: "text-emerald-700",
      buttonHover: "hover:bg-emerald-50",
    };

  return (
    <article className={`relative min-w-[260px] flex-1 border bg-transparent p-0 ${tone.panelBorder}`}>
      <div className="mb-3 flex items-center justify-center">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.laneBadge}`}>
          {laneLetter} · {lane.label}
        </span>
      </div>

      <div>
        {lane.nodeIds.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-3 text-center ${tone.emptyBorder} ${tone.emptyBg}`}>
            <p className="text-xs font-medium text-gray-800">Drop or add an action here</p>
            <button
              type="button"
              onClick={onAddAtStart}
              className={`mt-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold ${tone.buttonBorder} ${tone.buttonText} ${tone.buttonHover}`}
            >
              + Add step
            </button>
          </div>
        ) : (
          children
        )}
      </div>
      <p className={`mt-2 text-center text-[10px] font-medium ${tone.summary}`}>{conditionSummary}</p>
    </article>
  );
}
