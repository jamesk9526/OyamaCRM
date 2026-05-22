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
  renderLaneContent: (lane: WorkflowBranchLane, laneIndex: number) => ReactNode;
  onAddToLaneStart: (laneId: string) => void;
}

/** Horizontal split group with lane cards and a top connector rail. */
export default function BranchGroup({ branchNode, renderLaneContent, onAddToLaneStart }: BranchGroupProps) {
  const field = typeof branchNode.config.field === "string" ? branchNode.config.field : "field";

  return (
    <div className="mt-2 w-full">
      <div className="mx-auto mb-2 h-6 w-px bg-slate-300" />
      <div className="grid min-w-[640px] gap-28 overflow-x-auto pb-1 lg:grid-cols-2">
        {branchNode.lanes.map((lane, laneIndex) => (
          <BranchLane
            key={lane.id}
            lane={lane}
            laneLetter={String.fromCharCode(65 + laneIndex)}
            conditionSummary={formatLaneConditionSummary(field, lane)}
            onAddAtStart={() => onAddToLaneStart(lane.id)}
          >
            {renderLaneContent(lane, laneIndex)}
          </BranchLane>
        ))}
      </div>
    </div>
  );
}
