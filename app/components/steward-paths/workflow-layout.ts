/**
 * Layout and display helpers for the Steward Paths visual workflow map.
 */

import type { NodeInsertTarget, WorkflowDocument } from "./workflow-types";
import { isBranchNode } from "./workflow-types";

/** Creates a short label describing the current insertion target for palette UX. */
export function describeInsertTarget(doc: WorkflowDocument, target: NodeInsertTarget | null): string {
  if (!target || target.kind === "root-end") {
    return "End of top-level workflow";
  }

  if (target.kind === "root-start") {
    return "Start of top-level workflow";
  }

  if (target.kind === "after-node") {
    const node = doc.nodesById[target.nodeId];
    return node ? `After ${node.title}` : "After selected node";
  }

  const branchNode = doc.nodesById[target.branchNodeId];
  if (!branchNode || !isBranchNode(branchNode)) {
    return "Branch lane";
  }

  const lane = branchNode.lanes.find((item) => item.id === target.laneId);
  if (!lane) return `${branchNode.title} lane`;

  return `${branchNode.title} → ${lane.label}`;
}

/**
 * Computes max depth for the visible workflow tree.
 * Used for responsive spacing/zoom hints in the canvas header.
 */
export function computeWorkflowDepth(doc: WorkflowDocument): number {
  const walk = (nodeIds: string[], depth: number): number => {
    let maxDepth = depth;
    for (const nodeId of nodeIds) {
      const node = doc.nodesById[nodeId];
      if (!node) continue;
      if (isBranchNode(node)) {
        for (const lane of node.lanes) {
          maxDepth = Math.max(maxDepth, walk(lane.nodeIds, depth + 1));
        }
      }
    }
    return maxDepth;
  };

  return walk(doc.rootNodeIds, 1);
}
