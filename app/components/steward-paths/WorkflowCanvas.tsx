/**
 * WorkflowCanvas renders the ordered list of workflow nodes as cards with
 * connector dots between them. This is the structured-card fallback for the
 * visual map; drag/drop will layer on top in a later pass.
 */
"use client";

import WorkflowNodeCard from "./WorkflowNodeCard";
import type { WorkflowNode } from "./workflow-types";

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onMoveUp: (nodeId: string) => void;
  onMoveDown: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

/** Center-panel canvas with vertically connected node cards. */
export default function WorkflowCanvas({
  nodes,
  selectedNodeId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
}: WorkflowCanvasProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center px-6">
          <h2 className="text-base font-semibold text-gray-900">No steps yet</h2>
          <p className="text-sm text-gray-500 mt-1">
            Use the Block Library on the left to add a trigger and follow it with timing, email, print, task, donor data, logic, or safety blocks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {nodes.map((node, index) => (
          <div key={node.id}>
            <WorkflowNodeCard
              node={node}
              index={index}
              isSelected={selectedNodeId === node.id}
              onSelect={onSelect}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onRemove={onRemove}
              canMoveUp={index > 0}
              canMoveDown={index < nodes.length - 1}
            />
            {index < nodes.length - 1 && (
              <div className="flex justify-center py-1.5">
                <span className="w-px h-4 bg-gray-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
