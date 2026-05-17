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
    <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-900">Branch lanes</span>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          Condition field: {field}
        </span>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
          {branchNode.lanes.length} lane{branchNode.lanes.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mb-3 h-px w-full bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200" />

      <div className="grid gap-3 overflow-x-auto pb-1 lg:grid-cols-2">
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
