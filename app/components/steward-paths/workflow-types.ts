/**
 * Workflow type definitions for the Steward Paths visual builder.
 *
 * These types describe the branch-capable in-memory shape that the visual
 * canvas edits. They intentionally do not mirror Prisma row-for-row: the UI
 * model is tree-friendly, and adapters translate to server step payloads.
 *
 * See docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md (Phase 4).
 */

import type { BranchOperator } from "@/app/lib/engagement-orchestration";

/** Builder tab values rendered in the workflow top bar. */
export type WorkflowBuilderTab = "actions" | "settings" | "history";

/** Top-level category each palette block belongs to. */
export type NodeCategory =
  | "trigger"
  | "timing"
  | "email"
  | "print"
  | "task"
  | "livecom"
  | "donor-data"
  | "logic"
  | "safety";

/** Implementation readiness for a node kind, surfaced in the UI as a badge. */
export type NodeReadiness = "working" | "partially-working" | "not-implemented";

/** Shared workflow status values used by the builder header. */
export type WorkflowDocumentStatus = "draft" | "active" | "archived" | "test-mode";

/** Branch operators shown in the condition editor (adds UI-only `between`). */
export type WorkflowBranchOperator = BranchOperator | "between";

/** One condition row inside a branch lane. */
export interface WorkflowBranchConditionGroup {
  id: string;
  operator: WorkflowBranchOperator;
  /** Stored as a string for forgiving form input and JSON persistence. */
  value: string;
  /** Optional upper bound used by `between` operator. */
  valueTo?: string;
}

/** One lane inside an if/else branch node. */
export interface WorkflowBranchLane {
  id: string;
  label: string;
  /** Ordered node chain for this lane. */
  nodeIds: string[];
  /** `true` marks the fallback/otherwise lane. */
  isFallback?: boolean;
  /** Optional condition groups evaluated for this lane. */
  conditionGroups: WorkflowBranchConditionGroup[];
}

/**
 * A palette block users drag onto the canvas.
 * Each block defines its category, label, brief description, and execution status.
 */
export interface NodePaletteItem {
  kind: string;
  category: NodeCategory;
  label: string;
  summary: string;
  readiness: NodeReadiness;
  /** Optional default config rendered into the inspector when a node is added. */
  defaultConfig?: Record<string, unknown>;
}

/** Shared fields present on every node card type. */
export interface WorkflowNodeBase {
  id: string;
  kind: string;
  /** Display title shown on the node card. Editable in the inspector. */
  title: string;
  /** Per-node configuration (template id, delay amount, etc.). */
  config: Record<string, unknown>;
  /** UI status chip rendered on the card; mapped from execution state. */
  statusLabel?: string;
  /** Optional sticky note displayed under the title. */
  note?: string;
}

/** Standard action node (timing, email, print, task, etc.). */
export interface WorkflowActionNode extends WorkflowNodeBase {
  nodeType: "action";
}

/** If/else node that contains one or more branch lanes. */
export interface WorkflowBranchNode extends WorkflowNodeBase {
  nodeType: "branch";
  lanes: WorkflowBranchLane[];
}

/** Union of all node types the canvas can render. */
export type WorkflowNode = WorkflowActionNode | WorkflowBranchNode;

/** Insert target emitted by connector plus-buttons and used by the palette. */
export type NodeInsertTarget =
  | { kind: "root-start" }
  | { kind: "root-end" }
  | { kind: "after-node"; nodeId: string }
  | { kind: "branch-lane"; branchNodeId: string; laneId: string; afterNodeId?: string };

/** Save-mode metadata shown in the top bar and warning banners. */
export interface WorkflowPersistenceState {
  mode: "memory-only" | "api";
  templateId: string | null;
  lastSavedAt: string | null;
}

/** UI-only canvas offset for a node, relative to the generated workflow layout. */
export interface WorkflowNodeCanvasOffset {
  x: number;
  y: number;
}

/** Visual layout metadata; ignored by backend execution adapters. */
export interface WorkflowCanvasLayout {
  nodeOffsets: Record<string, WorkflowNodeCanvasOffset>;
}

/** A workflow draft the builder edits in memory. */
export interface WorkflowDocument {
  id: string;
  pathName: string;
  status: WorkflowDocumentStatus;
  activeTab: WorkflowBuilderTab;
  audienceLabel: string;
  /** Ordered top-level node chain. */
  rootNodeIds: string[];
  /** Lookup table for nodes used across root and branch lanes. */
  nodesById: Record<string, WorkflowNode>;
  /** UI-only free-drag offsets for canvas cards. */
  canvasLayout: WorkflowCanvasLayout;
  persistence: WorkflowPersistenceState;
}

/** Branch operator option metadata for select menus. */
export const BRANCH_OPERATOR_OPTIONS: Array<{ value: WorkflowBranchOperator; label: string }> = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "between", label: "Between" },
  { value: "in", label: "In list" },
  { value: "not_in", label: "Not in list" },
];

/** Type guard for branch nodes. */
export function isBranchNode(node: WorkflowNode): node is WorkflowBranchNode {
  return node.nodeType === "branch";
}

/** Type guard for action nodes. */
export function isActionNode(node: WorkflowNode): node is WorkflowActionNode {
  return node.nodeType === "action";
}

/**
 * Returns the readiness badge label and tone for a palette item.
 * Used by the palette and node card UIs so the same vocabulary appears everywhere.
 */
export function getReadinessBadge(readiness: NodeReadiness): { label: string; toneClass: string } {
  switch (readiness) {
    case "working":
      return { label: "Working", toneClass: "bg-green-100 text-green-700" };
    case "partially-working":
      return { label: "Partially Working", toneClass: "bg-amber-100 text-amber-700" };
    case "not-implemented":
    default:
      return { label: "Not Implemented", toneClass: "bg-gray-100 text-gray-600" };
  }
}
