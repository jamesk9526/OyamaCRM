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
  const tone = lane.isFallback
    ? {
      laneBadge: "bg-slate-100 text-slate-800 border-slate-300",
      panelBorder: "border-slate-200",
      accent: "bg-slate-400",
      summary: "text-slate-600",
      emptyBorder: "border-slate-300",
      emptyBg: "bg-slate-50/70",
      buttonBorder: "border-slate-300",
      buttonText: "text-slate-700",
      buttonHover: "hover:bg-slate-50",
    }
    : {
      laneBadge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      panelBorder: "border-emerald-200",
      accent: "bg-emerald-500",
      summary: "text-emerald-700",
      emptyBorder: "border-emerald-300",
      emptyBg: "bg-emerald-50/70",
      buttonBorder: "border-emerald-300",
      buttonText: "text-emerald-700",
      buttonHover: "hover:bg-emerald-50",
    };

  return (
    <article className={`relative min-w-[260px] flex-1 rounded-xl border bg-white/95 p-3 shadow-sm ${tone.panelBorder}`}>
      <span className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${tone.accent}`} />

      <div className="mb-2 flex items-start justify-between gap-2 pl-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.laneBadge}`}>
          {lane.label}
        </span>
        {lane.isFallback && (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            Otherwise
          </span>
        )}
      </div>

      <div className="pl-2">
        <p className={`text-[11px] font-medium ${tone.summary}`}>{conditionSummary}</p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          {lane.nodeIds.length} step{lane.nodeIds.length === 1 ? "" : "s"} in this lane
        </p>
      </div>

      <div className="mt-3 pl-2">
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
    </article>
  );
}
