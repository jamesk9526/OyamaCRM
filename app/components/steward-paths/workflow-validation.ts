/** Validation helpers for visual Steward Paths save and activation guardrails. */
import type { WorkflowDocument } from "./workflow-types";
import { PALETTE_ITEMS } from "./palette-catalog";
import { analyzeWorkflowSupport } from "./workflow-transformers";

export interface WorkflowValidationResult {
  canSave: boolean;
  canActivate: boolean;
  errors: string[];
}

/** Validates builder document for save/activation and unsupported node kinds. */
export function validateWorkflowDocument(doc: WorkflowDocument): WorkflowValidationResult {
  const support = analyzeWorkflowSupport(doc);
  const errors = [...support.reasons];

  const unsupported = Object.values(doc.nodesById)
    .filter((node) => {
      const palette = PALETTE_ITEMS.find((item) => item.kind === node.kind);
      return !palette || palette.readiness === "not-implemented";
    })
    .map((node) => node.kind);

  if (unsupported.length > 0) {
    errors.push(`Unsupported node kinds: ${unsupported.join(", ")}`);
  }

  return {
    canSave: support.canSaveLinear,
    canActivate: support.canActivate && unsupported.length === 0,
    errors,
  };
}
