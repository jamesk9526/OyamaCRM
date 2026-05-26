/**
 * Pure workflow document mutation helpers for the Steward Paths visual canvas.
 */

import type {
  NodeInsertTarget,
  NodePaletteItem,
  WorkflowBranchConditionGroup,
  WorkflowBranchLane,
  WorkflowBranchNode,
  WorkflowNodeCanvasOffset,
  WorkflowDocument,
  WorkflowNode,
} from "./workflow-types";
import { isBranchNode } from "./workflow-types";

/** Function signature used to generate stable node/lane ids during one edit session. */
export type WorkflowIdFactory = () => string;

/** Resolved location of a node inside either the root chain or a branch lane. */
interface WorkflowNodeLocation {
  index: number;
  container:
    | { kind: "root" }
    | { kind: "branch-lane"; branchNodeId: string; laneId: string };
}

/** Public container shape used by drag-and-drop relocation helpers. */
export type WorkflowContainerRef = WorkflowNodeLocation["container"];

/** Creates an empty workflow document with a persistence mode that supports linear saves. */
export function createWorkflowDocument(idFactory: WorkflowIdFactory): WorkflowDocument {
  return {
    id: idFactory(),
    pathName: "Untitled Steward Path",
    status: "draft",
    activeTab: "actions",
    audienceLabel: "Manual enrollment",
    rootNodeIds: [],
    nodesById: {},
    canvasLayout: {
      nodeOffsets: {},
    },
    persistence: {
      mode: "api",
      templateId: null,
      lastSavedAt: null,
    },
  };
}

/** Creates one condition group row for branch lane editors. */
export function createBranchConditionGroup(idFactory: WorkflowIdFactory): WorkflowBranchConditionGroup {
  return {
    id: idFactory(),
    operator: "eq",
    value: "",
  };
}

/** Creates one empty branch lane. */
export function createBranchLane(
  idFactory: WorkflowIdFactory,
  label: string,
  options?: { isFallback?: boolean; includeDefaultCondition?: boolean },
): WorkflowBranchLane {
  return {
    id: idFactory(),
    label,
    nodeIds: [],
    isFallback: options?.isFallback ?? false,
    conditionGroups: options?.includeDefaultCondition === false
      ? []
      : [createBranchConditionGroup(idFactory)],
  };
}

/**
 * Creates a new canvas node from one palette item.
 * Branch nodes get starter lanes so users can immediately see split paths.
 */
export function createNodeFromPalette(item: NodePaletteItem, idFactory: WorkflowIdFactory): WorkflowNode {
  if (item.kind === "logic.if_else" || item.kind === "logic.segment_condition" || item.kind === "logic.donation_amount_condition" || item.kind === "logic.communication_preference_condition" || item.kind === "logic.email_engagement_condition") {
    if (item.kind === "logic.if_else") {
      return {
        id: idFactory(),
        nodeType: "branch",
        kind: item.kind,
        title: "If/else Branch",
        config: {
          field: "lastGiftAmount",
        },
        statusLabel: "Draft",
        lanes: [
          {
            ...createBranchLane(idFactory, "If true", { includeDefaultCondition: false }),
            conditionGroups: [{ id: idFactory(), operator: "gt", value: "0" }],
          },
          {
            ...createBranchLane(idFactory, "If false", { includeDefaultCondition: false }),
            conditionGroups: [{ id: idFactory(), operator: "lte", value: "0" }],
          },
          createBranchLane(idFactory, "Else", { isFallback: true, includeDefaultCondition: false }),
        ],
      };
    }

    if (item.kind === "logic.segment_condition") {
      return {
        id: idFactory(),
        nodeType: "branch",
        kind: item.kind,
        title: "Donor Segment Branch",
        config: {
          field: "segmentMembership",
          segmentKey: "Major Donor",
        },
        statusLabel: "Draft",
        lanes: [
          {
            ...createBranchLane(idFactory, "In segment", { includeDefaultCondition: false }),
            conditionGroups: [{ id: idFactory(), operator: "eq", value: "true" }],
          },
          createBranchLane(idFactory, "Not in segment", { isFallback: true, includeDefaultCondition: false }),
        ],
      };
    }

    if (item.kind === "logic.communication_preference_condition") {
      return {
        id: idFactory(),
        nodeType: "branch",
        kind: item.kind,
        title: "Communication Preference Branch",
        config: {
          field: "doNotEmail",
        },
        statusLabel: "Draft",
        lanes: [
          {
            ...createBranchLane(idFactory, "Can email", { includeDefaultCondition: false }),
            conditionGroups: [{ id: idFactory(), operator: "eq", value: "false" }],
          },
          createBranchLane(idFactory, "Do not email", { isFallback: true, includeDefaultCondition: false }),
        ],
      };
    }

    if (item.kind === "logic.email_engagement_condition") {
      return {
        id: idFactory(),
        nodeType: "branch",
        kind: item.kind,
        title: "Email Engagement Branch",
        config: {
          field: "engagementScore",
        },
        statusLabel: "Draft",
        lanes: [
          {
            ...createBranchLane(idFactory, "High engagement", { includeDefaultCondition: false }),
            conditionGroups: [{ id: idFactory(), operator: "gte", value: "70" }],
          },
          createBranchLane(idFactory, "Low engagement", { isFallback: true, includeDefaultCondition: false }),
        ],
      };
    }

    return {
      id: idFactory(),
      nodeType: "branch",
      kind: item.kind,
      title: item.kind === "logic.donation_amount_condition" ? "Donation Amount Branch" : "Conditional Branch",
      config: {
        field: "lastGiftAmount",
      },
      statusLabel: "Draft",
      lanes: [
        {
          ...createBranchLane(idFactory, "Less than $50", { includeDefaultCondition: false }),
          conditionGroups: [{ id: idFactory(), operator: "lt", value: "50" }],
        },
        {
          ...createBranchLane(idFactory, "Between $50 and $100", { includeDefaultCondition: false }),
          conditionGroups: [{ id: idFactory(), operator: "between", value: "50", valueTo: "100" }],
        },
        {
          ...createBranchLane(idFactory, "Greater than $100", { includeDefaultCondition: false }),
          conditionGroups: [{ id: idFactory(), operator: "gt", value: "100" }],
        },
        createBranchLane(idFactory, "Otherwise", { isFallback: true, includeDefaultCondition: false }),
      ],
    };
  }

  return {
    id: idFactory(),
    nodeType: "action",
    kind: item.kind,
    title: item.label,
    config: item.defaultConfig ? { ...item.defaultConfig } : {},
    statusLabel: "Draft",
  };
}

/** Returns all node ids in a deterministic traversal order. */
export function listNodeIds(doc: WorkflowDocument): string[] {
  const out: string[] = [];
  const visit = (ids: string[]) => {
    for (const id of ids) {
      out.push(id);
      const node = doc.nodesById[id];
      if (node && isBranchNode(node)) {
        for (const lane of node.lanes) {
          visit(lane.nodeIds);
        }
      }
    }
  };
  visit(doc.rootNodeIds);
  return out;
}

/** Finds where one node currently lives in the root chain or branch lanes. */
export function findNodeLocation(doc: WorkflowDocument, nodeId: string): WorkflowNodeLocation | null {
  const search = (
    ids: string[],
    container: WorkflowNodeLocation["container"],
  ): WorkflowNodeLocation | null => {
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (id === nodeId) return { index, container };
      const node = doc.nodesById[id];
      if (node && isBranchNode(node)) {
        for (const lane of node.lanes) {
          const found = search(lane.nodeIds, {
            kind: "branch-lane",
            branchNodeId: node.id,
            laneId: lane.id,
          });
          if (found) return found;
        }
      }
    }
    return null;
  };

  return search(doc.rootNodeIds, { kind: "root" });
}

/** Returns one lane object by id from a branch node. */
function findLane(branch: WorkflowBranchNode, laneId: string): WorkflowBranchLane | null {
  return branch.lanes.find((lane) => lane.id === laneId) ?? null;
}

/** Returns the current id list for a location container. */
function getContainerNodeIds(doc: WorkflowDocument, container: WorkflowNodeLocation["container"]): string[] {
  if (container.kind === "root") return doc.rootNodeIds;
  const branch = doc.nodesById[container.branchNodeId];
  if (!branch || !isBranchNode(branch)) return [];
  return findLane(branch, container.laneId)?.nodeIds ?? [];
}

/** Applies updated node ids to one container while preserving document immutability. */
function setContainerNodeIds(
  doc: WorkflowDocument,
  container: WorkflowNodeLocation["container"],
  nextNodeIds: string[],
): WorkflowDocument {
  if (container.kind === "root") {
    return {
      ...doc,
      rootNodeIds: nextNodeIds,
    };
  }

  const node = doc.nodesById[container.branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  const nextBranch: WorkflowBranchNode = {
    ...node,
    lanes: node.lanes.map((lane) => (
      lane.id === container.laneId
        ? { ...lane, nodeIds: nextNodeIds }
        : lane
    )),
  };

  return {
    ...doc,
    nodesById: {
      ...doc.nodesById,
      [nextBranch.id]: nextBranch,
    },
  };
}

/** Collects one node id and all descendant ids nested under branch lanes. */
function collectDescendantNodeIds(doc: WorkflowDocument, nodeId: string): string[] {
  const node = doc.nodesById[nodeId];
  if (!node) return [];

  const ids = [nodeId];
  if (isBranchNode(node)) {
    for (const lane of node.lanes) {
      for (const childId of lane.nodeIds) {
        ids.push(...collectDescendantNodeIds(doc, childId));
      }
    }
  }
  return ids;
}

/** Inserts a node at one connector target selected from the canvas. */
export function insertNodeAtTarget(
  doc: WorkflowDocument,
  target: NodeInsertTarget,
  node: WorkflowNode,
): WorkflowDocument {
  let nextDoc: WorkflowDocument = {
    ...doc,
    nodesById: {
      ...doc.nodesById,
      [node.id]: node,
    },
    canvasLayout: {
      ...doc.canvasLayout,
      nodeOffsets: {
        ...doc.canvasLayout.nodeOffsets,
        [node.id]: doc.canvasLayout.nodeOffsets[node.id] ?? { x: 0, y: 0 },
      },
    },
  };

  if (target.kind === "root-start") {
    nextDoc = {
      ...nextDoc,
      rootNodeIds: [node.id, ...nextDoc.rootNodeIds],
    };
    return nextDoc;
  }

  if (target.kind === "root-end") {
    nextDoc = {
      ...nextDoc,
      rootNodeIds: [...nextDoc.rootNodeIds, node.id],
    };
    return nextDoc;
  }

  if (target.kind === "after-node") {
    const location = findNodeLocation(nextDoc, target.nodeId);
    if (!location) {
      return {
        ...nextDoc,
        rootNodeIds: [...nextDoc.rootNodeIds, node.id],
      };
    }

    const containerNodeIds = getContainerNodeIds(nextDoc, location.container);
    const updatedContainerNodeIds = containerNodeIds.slice();
    updatedContainerNodeIds.splice(location.index + 1, 0, node.id);
    return setContainerNodeIds(nextDoc, location.container, updatedContainerNodeIds);
  }

  const branchNode = nextDoc.nodesById[target.branchNodeId];
  if (!branchNode || !isBranchNode(branchNode)) {
    return {
      ...nextDoc,
      rootNodeIds: [...nextDoc.rootNodeIds, node.id],
    };
  }

  const lane = findLane(branchNode, target.laneId);
  if (!lane) {
    return {
      ...nextDoc,
      rootNodeIds: [...nextDoc.rootNodeIds, node.id],
    };
  }

  const laneNodeIds = [...lane.nodeIds];
  if (target.afterNodeId) {
    const index = laneNodeIds.indexOf(target.afterNodeId);
    if (index >= 0) {
      laneNodeIds.splice(index + 1, 0, node.id);
    } else {
      laneNodeIds.push(node.id);
    }
  } else {
    laneNodeIds.unshift(node.id);
  }

  return setContainerNodeIds(nextDoc, { kind: "branch-lane", branchNodeId: branchNode.id, laneId: lane.id }, laneNodeIds);
}

/** Moves one node up or down inside its current container. */
export function moveNodeInContainer(doc: WorkflowDocument, nodeId: string, delta: -1 | 1): WorkflowDocument {
  const location = findNodeLocation(doc, nodeId);
  if (!location) return doc;

  const containerNodeIds = getContainerNodeIds(doc, location.container);
  const targetIndex = location.index + delta;
  if (targetIndex < 0 || targetIndex >= containerNodeIds.length) return doc;

  const next = [...containerNodeIds];
  const [removed] = next.splice(location.index, 1);
  next.splice(targetIndex, 0, removed);
  return setContainerNodeIds(doc, location.container, next);
}

/**
 * Relocates one node to any valid container/index for drag-and-drop.
 *
 * This supports moving between root and branch lanes while preserving
 * descendants under the moved node.
 */
export function relocateNode(
  doc: WorkflowDocument,
  nodeId: string,
  targetContainer: WorkflowContainerRef,
  targetIndex: number,
): WorkflowDocument {
  const location = findNodeLocation(doc, nodeId);
  if (!location) return doc;

  // Prevent dropping a branch node into one of its own descendant lanes.
  if (targetContainer.kind === "branch-lane") {
    const blocked = new Set(collectDescendantNodeIds(doc, nodeId));
    if (blocked.has(targetContainer.branchNodeId)) {
      return doc;
    }
  }

  const sourceIds = [...getContainerNodeIds(doc, location.container)];
  if (location.index < 0 || location.index >= sourceIds.length) return doc;

  sourceIds.splice(location.index, 1);
  let nextDoc = setContainerNodeIds(doc, location.container, sourceIds);

  const destinationIds = [...getContainerNodeIds(nextDoc, targetContainer)];
  const clampedIndex = Math.max(0, Math.min(targetIndex, destinationIds.length));
  destinationIds.splice(clampedIndex, 0, nodeId);
  nextDoc = setContainerNodeIds(nextDoc, targetContainer, destinationIds);

  return nextDoc;
}

/** Updates one node record in-place without changing list ordering. */
export function updateNode(doc: WorkflowDocument, nodeId: string, nextNode: WorkflowNode): WorkflowDocument {
  if (!doc.nodesById[nodeId]) return doc;
  return {
    ...doc,
    nodesById: {
      ...doc.nodesById,
      [nodeId]: nextNode,
    },
  };
}

/** Patches one node config key and returns the updated document. */
export function updateNodeConfig(
  doc: WorkflowDocument,
  nodeId: string,
  key: string,
  value: unknown,
): WorkflowDocument {
  const node = doc.nodesById[nodeId];
  if (!node) return doc;

  return updateNode(doc, nodeId, {
    ...node,
    config: {
      ...node.config,
      [key]: value,
    },
  });
}

/** Removes one node and any descendants nested under that node's branch lanes. */
export function removeNode(doc: WorkflowDocument, nodeId: string): WorkflowDocument {
  const location = findNodeLocation(doc, nodeId);
  if (!location) return doc;

  const idsToRemove = new Set(collectDescendantNodeIds(doc, nodeId));
  const containerNodeIds = getContainerNodeIds(doc, location.container);
  const nextContainerNodeIds = containerNodeIds.filter((id) => id !== nodeId);
  let nextDoc = setContainerNodeIds(doc, location.container, nextContainerNodeIds);

  const nextNodesById: Record<string, WorkflowNode> = { ...nextDoc.nodesById };
  for (const id of idsToRemove) {
    delete nextNodesById[id];
  }

  nextDoc = {
    ...nextDoc,
    nodesById: nextNodesById,
    canvasLayout: {
      ...nextDoc.canvasLayout,
      nodeOffsets: Object.fromEntries(
        Object.entries(nextDoc.canvasLayout.nodeOffsets).filter(([id]) => !idsToRemove.has(id)),
      ),
    },
  };

  return nextDoc;
}

/** Stores a UI-only free-drag offset for one node card without changing workflow order. */
export function setNodeCanvasOffset(
  doc: WorkflowDocument,
  nodeId: string,
  offset: WorkflowNodeCanvasOffset,
): WorkflowDocument {
  if (!doc.nodesById[nodeId]) return doc;
  return {
    ...doc,
    canvasLayout: {
      ...doc.canvasLayout,
      nodeOffsets: {
        ...doc.canvasLayout.nodeOffsets,
        [nodeId]: {
          x: Math.round(offset.x),
          y: Math.round(offset.y),
        },
      },
    },
  };
}

/** Clears all free-drag offsets and returns the canvas to generated workflow layout. */
export function resetCanvasLayout(doc: WorkflowDocument): WorkflowDocument {
  return {
    ...doc,
    canvasLayout: {
      ...doc.canvasLayout,
      nodeOffsets: {},
    },
  };
}

/** Adds one new branch lane and inserts it before any fallback lane. */
export function addBranchLane(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneLabel: string,
  idFactory: WorkflowIdFactory,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  const nextLane = createBranchLane(idFactory, laneLabel);
  const fallbackIndex = node.lanes.findIndex((lane) => lane.isFallback);
  const nextLanes = node.lanes.slice();
  if (fallbackIndex >= 0) {
    nextLanes.splice(fallbackIndex, 0, nextLane);
  } else {
    nextLanes.push(nextLane);
  }

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: nextLanes,
  });
}

/** Renames one branch lane label. */
export function renameBranchLane(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
  laneLabel: string,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: node.lanes.map((lane) => (
      lane.id === laneId
        ? { ...lane, label: laneLabel }
        : lane
    )),
  });
}

/** Marks one lane as the fallback lane and clears fallback on other lanes. */
export function setBranchFallbackLane(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: node.lanes.map((lane) => ({
      ...lane,
      isFallback: lane.id === laneId,
    })),
  });
}

/** Adds one condition group to a lane for AND-style condition chaining. */
export function addBranchLaneConditionGroup(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
  idFactory: WorkflowIdFactory,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: node.lanes.map((lane) => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        conditionGroups: [...lane.conditionGroups, createBranchConditionGroup(idFactory)],
      };
    }),
  });
}

/** Removes one condition group from a branch lane. */
export function removeBranchLaneConditionGroup(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
  conditionGroupId: string,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: node.lanes.map((lane) => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        conditionGroups: lane.conditionGroups.filter((condition) => condition.id !== conditionGroupId),
      };
    }),
  });
}

/** Updates one field on a branch condition group row. */
export function updateBranchLaneConditionGroup(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
  conditionGroupId: string,
  partial: Partial<WorkflowBranchConditionGroup>,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;

  return updateNode(doc, branchNodeId, {
    ...node,
    lanes: node.lanes.map((lane) => {
      if (lane.id !== laneId) return lane;
      return {
        ...lane,
        conditionGroups: lane.conditionGroups.map((condition) => (
          condition.id === conditionGroupId
            ? { ...condition, ...partial }
            : condition
        )),
      };
    }),
  });
}

/** Removes one lane and all descendant nodes nested under that lane. */
export function removeBranchLane(
  doc: WorkflowDocument,
  branchNodeId: string,
  laneId: string,
): WorkflowDocument {
  const node = doc.nodesById[branchNodeId];
  if (!node || !isBranchNode(node)) return doc;
  if (node.lanes.length <= 1) return doc;

  const laneToRemove = findLane(node, laneId);
  if (!laneToRemove) return doc;

  const idsToDelete = new Set<string>();
  for (const childId of laneToRemove.nodeIds) {
    for (const nestedId of collectDescendantNodeIds(doc, childId)) {
      idsToDelete.add(nestedId);
    }
  }

  const nextLanes = node.lanes.filter((lane) => lane.id !== laneId);
  if (!nextLanes.some((lane) => lane.isFallback) && nextLanes.length > 0) {
    const lastLaneIndex = nextLanes.length - 1;
    nextLanes[lastLaneIndex] = {
      ...nextLanes[lastLaneIndex],
      isFallback: true,
      conditionGroups: [],
    };
  }

  const nextNodesById: Record<string, WorkflowNode> = { ...doc.nodesById };
  for (const id of idsToDelete) {
    delete nextNodesById[id];
  }

  return {
    ...doc,
    nodesById: {
      ...nextNodesById,
      [branchNodeId]: {
        ...node,
        lanes: nextLanes,
      },
    },
    canvasLayout: {
      ...doc.canvasLayout,
      nodeOffsets: Object.fromEntries(
        Object.entries(doc.canvasLayout.nodeOffsets).filter(([id]) => !idsToDelete.has(id)),
      ),
    },
  };
}

/** Returns a readable text summary for one branch lane's condition groups. */
export function formatLaneConditionSummary(field: string, lane: WorkflowBranchLane): string {
  if (lane.isFallback) {
    return "Fallback branch";
  }

  if (!lane.conditionGroups.length) {
    return `When ${field} matches custom condition`;
  }

  const summary = lane.conditionGroups
    .map((group) => {
      if (group.operator === "between") {
        return `${field} between ${group.value || "?"} and ${group.valueTo || "?"}`;
      }
      return `${field} ${group.operator} ${group.value || "?"}`;
    })
    .join(" AND ");

  return `When ${summary}`;
}
