/**
 * BranchGroup renders split lanes and branch metadata below a branch node card.
 */
"use client";

import type { ReactNode } from "react";

import BranchLane from "./BranchLane";
import { formatLaneConditionSummary } from "./workflow-utils";
import type { WorkflowBranchLane, WorkflowBranchNode, WorkflowNodeCanvasOffset } from "./workflow-types";

interface BranchGroupProps {
  branchNode: WorkflowBranchNode;
  selectedBranchNode: boolean;
  onSelectBranchNode: (branchNodeId: string) => void;
  laneOffsets: Record<string, WorkflowNodeCanvasOffset>;
  onLaneOffsetChange: (laneId: string, offset: WorkflowNodeCanvasOffset) => void;
  gridSize: number;
  renderLaneContent: (lane: WorkflowBranchLane, laneIndex: number) => ReactNode;
  onAddToLaneStart: (laneId: string) => void;
}

/** Horizontal split group with lane cards and a top connector rail. */
export default function BranchGroup({
  branchNode,
  selectedBranchNode,
  onSelectBranchNode,
  laneOffsets,
  onLaneOffsetChange,
  gridSize,
  renderLaneContent,
  onAddToLaneStart,
}: BranchGroupProps) {
  const field = typeof branchNode.config.field === "string" ? branchNode.config.field : "field";
  const laneTrackMinWidth = Math.max(640, branchNode.lanes.length * 300);

  return (
    <div className="mt-3 w-full">
      <div className="pb-1">
        <div className="mx-auto flex w-max min-w-full items-start gap-10 px-1" style={{ minWidth: laneTrackMinWidth }}>
          {branchNode.lanes.map((lane, laneIndex) => (
            <BranchLane
              key={lane.id}
              lane={lane}
              laneLetter={laneIndex === 0 ? "Yes" : laneIndex === 1 ? "No" : String.fromCharCode(65 + laneIndex)}
              conditionSummary={formatLaneConditionSummary(field, lane)}
              freeOffset={laneOffsets[lane.id] ?? { x: 0, y: 0 }}
              onFreeMove={onLaneOffsetChange}
              gridSize={gridSize}
              isSelected={selectedBranchNode}
              onSelectLane={() => onSelectBranchNode(branchNode.id)}
              onAddAtStart={() => onAddToLaneStart(lane.id)}
            >
              {renderLaneContent(lane, laneIndex)}
            </BranchLane>
          ))}
        </div>
      </div>
    </div>
  );
}
