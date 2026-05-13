/**
 * Workflow type definitions for the Steward Paths visual builder.
 *
 * These types describe the in-memory shape of a path the visual builder edits.
 * They intentionally do not mirror the Prisma `StewardPathStep` row 1:1 — the
 * builder works in a UI-friendly representation and the persistence layer (to
 * land in Phase 5) will translate to/from this shape.
 *
 * See docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md (Phase 4).
 */

/** Top-level category each palette block belongs to. */
export type NodeCategory =
  | "trigger"
  | "timing"
  | "email"
  | "print"
  | "task"
  | "donor-data"
  | "logic"
  | "safety";

/** Implementation readiness for a node kind, surfaced in the UI as a badge. */
export type NodeReadiness = "working" | "partially-working" | "not-implemented";

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

/** Node placed on the canvas. */
export interface WorkflowNode {
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

/** Connection between two nodes. The builder defaults to linear chains; branching is Phase 5. */
export interface WorkflowEdge {
  fromNodeId: string;
  toNodeId: string;
  /** Optional branch identifier ("yes" / "no") for conditional edges. */
  branchLabel?: string;
}

/** A workflow draft the builder edits in memory. */
export interface WorkflowDocument {
  pathName: string;
  status: "draft" | "active" | "archived" | "test-mode";
  audienceLabel: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
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
