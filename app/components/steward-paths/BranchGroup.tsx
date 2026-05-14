/**
 * BranchGroup renders split lanes and branch metadata below a branch node card.
 */
"use client";

import type { ReactNode } from "react";

import BranchLane from "./BranchLane";
import { formatLaneConditionSummary } from "./workflow-utils";
import type { WorkflowBranchLane, WorkflowBranchNode } from "./workflow-types";

interface BranchGroupProps {
  branchNode: WorkflowBranchNode;
  renderLaneContent: (lane: WorkflowBranchLane) => ReactNode;
  onAddToLaneStart: (laneId: string) => void;
}

/** Horizontal split group with lane cards and a top connector rail. */
export default function BranchGroup({ branchNode, renderLaneContent, onAddToLaneStart }: BranchGroupProps) {
  const field = typeof branchNode.config.field === "string" ? branchNode.config.field : "field";

  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-800">Branch lanes</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
          Condition field: {field}
        </span>
      </div>

      <div className="mb-3 h-px w-full bg-emerald-200" />

      <div className="flex gap-3 overflow-x-auto pb-1">
        {branchNode.lanes.map((lane) => (
          <BranchLane
            key={lane.id}
            lane={lane}
            conditionSummary={formatLaneConditionSummary(field, lane)}
            onAddAtStart={() => onAddToLaneStart(lane.id)}
          >
            {renderLaneContent(lane)}
          </BranchLane>
        ))}
      </div>
    </div>
  );
}
