/**
 * Adapters between the visual workflow document and steward-paths API payloads.
 */

import { PALETTE_ITEMS } from "./palette-catalog";
import { createBranchLane, createWorkflowDocument } from "./workflow-utils";
import type {
  WorkflowDocument,
  WorkflowDocumentStatus,
  WorkflowNode,
  WorkflowBranchNode,
  WorkflowBranchConditionGroup,
} from "./workflow-types";
import { isBranchNode } from "./workflow-types";

/** Status values accepted by the steward-paths template API. */
export type BackendStewardPathStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

/** Step enum values accepted by the steward-paths step API. */
export type BackendStewardPathStepType =
  | "DELAY"
  | "CREATE_TASK"
  | "GENERATE_LETTER"
  | "DRAFT_EMAIL"
  | "SEND_EMAIL"
  | "MANUAL_ACTION"
  | "INTERNAL_NOTE"
  | "STATUS_CHANGE"
  | "BRANCH_PLACEHOLDER";

/** Payload used when creating or updating one steward path template. */
export interface BackendStewardPathTemplateInput {
  name: string;
  description?: string | null;
  targetType: "CONSTITUENT";
  crmScope: "DONOR";
  status: BackendStewardPathStatus;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
}

/** Payload used when creating one step row via the steward-paths API. */
export interface BackendStewardPathStepInput {
  name: string;
  description?: string | null;
  stepType: BackendStewardPathStepType;
  configJson?: Record<string, unknown>;
  orderIndex: number;
  isRequired: boolean;
  isActive: boolean;
}

/** Lightweight response shape used by the builder when loading an existing template. */
export interface BackendStewardPathTemplateResponse {
  id: string;
  name: string;
  status: BackendStewardPathStatus;
  targetType: string;
  crmScope: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown> | null;
  steps: Array<{
    id: string;
    name: string;
    description?: string | null;
    stepType: BackendStewardPathStepType;
    configJson?: Record<string, unknown> | null;
    orderIndex: number;
    isActive: boolean;
  }>;
}

/** Support report used by save/activate buttons to communicate readiness honestly. */
export interface WorkflowSupportReport {
  canSaveLinear: boolean;
  canActivate: boolean;
  hasBranchNodes: boolean;
  unsupportedKinds: string[];
  reasons: string[];
}

/** Result object returned by linear workflow export. */
export interface LinearWorkflowExport {
  template: BackendStewardPathTemplateInput;
  steps: BackendStewardPathStepInput[];
  report: WorkflowSupportReport;
}

/** Converts builder status values to the API status enum values. */
export function toBackendTemplateStatus(status: WorkflowDocumentStatus): BackendStewardPathStatus {
  if (status === "active") return "ACTIVE";
  if (status === "archived") return "ARCHIVED";
  if (status === "test-mode") return "PAUSED";
  return "DRAFT";
}

/** Converts API status values back into builder status values. */
export function fromBackendTemplateStatus(status: BackendStewardPathStatus): WorkflowDocumentStatus {
  if (status === "ACTIVE") return "active";
  if (status === "ARCHIVED") return "archived";
  if (status === "PAUSED") return "test-mode";
  return "draft";
}

/** Returns true when a node kind is one of the trigger blocks. */
function isTriggerKind(kind: string): boolean {
  return kind.startsWith("trigger.");
}

/** Maps one trigger kind to a template-level triggerType string. */
function toBackendTriggerType(kind: string | null): string {
  switch (kind) {
    case "trigger.new_donation":
      return "DONATION_RECEIVED";
    case "trigger.pledge_due":
      return "PLEDGE_DUE";
    case "trigger.donor_lapsed":
      return "DONOR_LAPSED";
    case "trigger.added_to_segment":
      return "CONSTITUENT_UPDATED";
    case "trigger.event_attended":
      return "EVENT_ATTENDED";
    case "trigger.manual_enrollment":
    default:
      return "MANUAL";
  }
}

/** Maps one API triggerType string to a builder trigger kind. */
function fromBackendTriggerType(triggerType: string): string {
  const normalized = triggerType.trim().toUpperCase();
  switch (normalized) {
    case "DONATION_RECEIVED":
      return "trigger.new_donation";
    case "PLEDGE_DUE":
      return "trigger.pledge_due";
    case "DONOR_LAPSED":
      return "trigger.donor_lapsed";
    case "CONSTITUENT_UPDATED":
      return "trigger.added_to_segment";
    case "EVENT_ATTENDED":
      return "trigger.event_attended";
    case "MANUAL":
    default:
      return "trigger.manual_enrollment";
  }
}

/** Reads one finite numeric value from config, with a fallback. */
function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Reads one non-empty string from config. */
function readString(config: Record<string, unknown>, key: string, fallback = ""): string {
  const value = config[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

/** Coerces a value into number/string for branch config payloads. */
function coerceComparable(value: string): number | string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

/** Maps one visual action node into one backend step payload when supported. */
function actionNodeToStep(node: WorkflowNode): Omit<BackendStewardPathStepInput, "orderIndex"> | null {
  if (isBranchNode(node)) {
    return null;
  }

  switch (node.kind) {
    case "timing.delay":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DELAY",
        configJson: {
          amount: Math.max(1, Math.floor(readNumber(node.config, "amount", 1))),
          unit: typeof node.config.unit === "string" ? node.config.unit : "days",
        },
        isRequired: true,
        isActive: true,
      };
    case "task.create":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "CREATE_TASK",
        configJson: node.config,
        isRequired: true,
        isActive: true,
      };
    case "print.generate_letter":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "GENERATE_LETTER",
        configJson: node.config,
        isRequired: true,
        isActive: true,
      };
    case "email.create_draft":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DRAFT_EMAIL",
        configJson: node.config,
        isRequired: true,
        isActive: true,
      };
    case "email.send_review_request":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DRAFT_EMAIL",
        configJson: {
          ...node.config,
          requireApprovalBeforeSend: true,
          waitForReview: true,
        },
        isRequired: true,
        isActive: true,
      };
    case "email.schedule_blast":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "SEND_EMAIL",
        configJson: {
          ...node.config,
          waitForReview: false,
        },
        isRequired: true,
        isActive: true,
      };
    case "timing.until_date":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DELAY",
        configJson: {
          mode: "until_date",
          dateIso: readString(node.config, "dateIso", readString(node.config, "date", "")),
        },
        isRequired: true,
        isActive: true,
      };
    case "timing.until_weekday_time":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DELAY",
        configJson: {
          mode: "until_weekday_time",
          weekday: readNumber(node.config, "weekday", 1),
          hour: readNumber(node.config, "hour", 9),
          minute: readNumber(node.config, "minute", 0),
        },
        isRequired: true,
        isActive: true,
      };
    case "timing.after_last_gift":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "DELAY",
        configJson: {
          mode: "after_last_gift",
          amount: Math.max(1, Math.floor(readNumber(node.config, "amount", 30))),
          unit: readString(node.config, "unit", "days"),
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.add_note":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "INTERNAL_NOTE",
        configJson: {
          noteTemplate: typeof node.config.noteTemplate === "string"
            ? node.config.noteTemplate
            : node.note || node.title,
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.update_status":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "STATUS_CHANGE",
        configJson: {
          targetField: "donorStatus",
          value: typeof node.config.value === "string" ? node.config.value : "ACTIVE",
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.adjust_engagement_score":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "STATUS_CHANGE",
        configJson: {
          targetField: "engagementScore",
          value: Math.max(0, Math.min(100, Math.floor(readNumber(node.config, "value", 50)))),
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.set_retention_stage":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "STATUS_CHANGE",
        configJson: {
          targetField: "retentionStage",
          value: typeof node.config.value === "string" ? node.config.value : "AT_RISK",
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.add_tag":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "INTERNAL_NOTE",
        configJson: {
          operation: "add_tag",
          tag: readString(node.config, "tag", "VIP"),
          noteTemplate: node.note || node.title,
        },
        isRequired: true,
        isActive: true,
      };
    case "donor.remove_tag":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "INTERNAL_NOTE",
        configJson: {
          operation: "remove_tag",
          tag: readString(node.config, "tag", "VIP"),
          noteTemplate: node.note || node.title,
        },
        isRequired: true,
        isActive: true,
      };
    case "print.add_to_print_queue":
    case "print.require_print_approval":
    case "print.mark_printed":
    case "print.add_to_mail_queue":
    case "print.mark_mailed": {
      const operationByKind: Record<string, string> = {
        "print.add_to_print_queue": "add_to_print_queue",
        "print.require_print_approval": "require_print_approval",
        "print.mark_printed": "mark_printed",
        "print.add_to_mail_queue": "add_to_mail_queue",
        "print.mark_mailed": "mark_mailed",
      };
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "INTERNAL_NOTE",
        configJson: {
          operation: operationByKind[node.kind],
          noteTemplate: node.note || node.title,
        },
        isRequired: true,
        isActive: true,
      };
    }
    case "task.assign_staff":
    case "task.wait_for_completion":
    case "task.escalate_overdue":
    case "livecom.send_message":
    case "livecom.wait_for_reply":
    case "email.add_to_sequence":
    case "email.wait_for_open":
    case "email.mark_failed":
    case "logic.segment_condition":
    case "logic.donation_amount_condition":
    case "logic.communication_preference_condition":
    case "logic.email_engagement_condition":
    case "logic.retention_risk_condition":
    case "safety.notify_staff":
    case "safety.stop_enrollment":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "MANUAL_ACTION",
        configJson: {
          command: node.kind,
          instruction: typeof node.config.instruction === "string"
            ? node.config.instruction
            : node.note || node.title,
          ...node.config,
        },
        isRequired: true,
        isActive: true,
      };
    case "livecom.route_to_staff":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "CREATE_TASK",
        configJson: {
          command: "livecom.route_to_staff",
          title: typeof node.config.title === "string" && node.config.title.trim()
            ? node.config.title
            : "Follow up LiveCom conversation",
          assignee: readString(node.config, "assignee", "Stewardship Team"),
          priority: readString(node.config, "priority", "MEDIUM"),
          instruction: readString(node.config, "instruction", "Route this LiveCom conversation to staff."),
        },
        isRequired: true,
        isActive: true,
      };
    case "safety.require_human_approval":
    case "safety.pause_path":
      return {
        name: node.title,
        description: node.note ?? null,
        stepType: "MANUAL_ACTION",
        configJson: {
          instruction: typeof node.config.instruction === "string"
            ? node.config.instruction
            : node.note || node.title,
        },
        isRequired: true,
        isActive: true,
      };
    default:
      return null;
  }
}

/** Evaluates save and activation readiness for one visual document. */
export function analyzeWorkflowSupport(doc: WorkflowDocument): WorkflowSupportReport {
  const hasBranchNodes = Object.values(doc.nodesById).some((node) => isBranchNode(node));
  const unsupportedKinds = new Set<string>();

  function inspectNodeIds(nodeIds: string[]) {
    for (const nodeId of nodeIds) {
      const node = doc.nodesById[nodeId];
      if (!node) continue;
      if (!isTriggerKind(node.kind) && !isBranchNode(node) && !actionNodeToStep(node)) {
        unsupportedKinds.add(node.kind);
      }
      if (isBranchNode(node)) {
        for (const lane of node.lanes) {
          inspectNodeIds(lane.nodeIds);
        }
      }
    }
  }

  inspectNodeIds(doc.rootNodeIds);

  const reasons: string[] = [];
  if (unsupportedKinds.size > 0) {
    reasons.push(`Unsupported step kinds for current API save: ${Array.from(unsupportedKinds).join(", ")}.`);
  }

  const linearStepCount = doc.rootNodeIds
    .map((nodeId) => doc.nodesById[nodeId])
    .filter((node): node is WorkflowNode => Boolean(node))
    .filter((node) => !isTriggerKind(node.kind))
    .length;
  if (linearStepCount === 0) {
    reasons.push("At least one non-trigger action step is required before saving.");
  }

  const canSaveLinear = reasons.length === 0;
  return {
    canSaveLinear,
    canActivate: canSaveLinear,
    hasBranchNodes,
    unsupportedKinds: Array.from(unsupportedKinds),
    reasons,
  };
}

interface PlannedStep {
  label: string;
  step: Omit<BackendStewardPathStepInput, "orderIndex">;
}

/** Branch condition from one lane (first row) using branch-node field selection. */
function buildLaneCondition(
  branchNode: WorkflowBranchNode,
  laneIndex: number,
): { field: string; operator: string; value: number | string | Array<number | string>; valueTo?: number | string } {
  const lane = branchNode.lanes[laneIndex];
  const first = lane?.conditionGroups[0];
  const field = typeof branchNode.config.field === "string" && branchNode.config.field.trim()
    ? branchNode.config.field
    : "engagementScore";

  if (!first) {
    return { field, operator: "in", value: ["true", "false"] };
  }

  if (first.operator === "in" || first.operator === "not_in") {
    const raw = String(first.value || "");
    const list = raw.split(",").map((part) => part.trim()).filter(Boolean).map(coerceComparable);
    return {
      field,
      operator: first.operator,
      value: list,
    };
  }

  if (first.operator === "between") {
    return {
      field,
      operator: "between",
      value: coerceComparable(String(first.value || "0")),
      valueTo: coerceComparable(String(first.valueTo || first.value || "0")),
    };
  }

  return {
    field,
    operator: first.operator,
    value: coerceComparable(String(first.value || "")),
  };
}

/** Adds one branch step with label-based jump placeholders. */
function pushBranchStep(
  steps: PlannedStep[],
  label: string,
  name: string,
  description: string | null,
  condition: Record<string, unknown>,
  whenTrueLabel: string | null,
  whenFalseLabel: string | null,
  builderMeta?: Record<string, unknown>,
) {
  const configJson: Record<string, unknown> = {
    condition,
    whenTrueAdvanceToLabel: whenTrueLabel,
    whenFalseAdvanceToLabel: whenFalseLabel,
  };

  if (builderMeta && Object.keys(builderMeta).length > 0) {
    configJson.builderMeta = builderMeta;
  }

  steps.push({
    label,
    step: {
      name,
      description,
      stepType: "BRANCH_PLACEHOLDER",
      configJson,
      isRequired: true,
      isActive: true,
    },
  });
}

/** Appends one unconditional jump implemented as a branch step. */
function pushJumpStep(steps: PlannedStep[], label: string, targetLabel: string | null) {
  pushBranchStep(
    steps,
    label,
    "Jump",
    null,
    { field: "doNotContact", operator: "in", value: ["true", "false"] },
    targetLabel,
    targetLabel,
  );
}

/** Compiles nested node chains into branch-aware planned steps. */
function compileNodeChain(
  doc: WorkflowDocument,
  nodeIds: string[],
  afterLabel: string | null,
  steps: PlannedStep[],
) {
  for (let index = 0; index < nodeIds.length; index += 1) {
    const nodeId = nodeIds[index];
    const node = doc.nodesById[nodeId];
    if (!node || isTriggerKind(node.kind)) continue;

    const nextSiblingId = index < nodeIds.length - 1 ? nodeIds[index + 1] : null;
    const nextLabel = nextSiblingId ? `node:${nextSiblingId}` : afterLabel;

    if (!isBranchNode(node)) {
      const mapped = actionNodeToStep(node);
      if (!mapped) continue;
      steps.push({ label: `node:${node.id}`, step: mapped });
      continue;
    }

    const nonFallback = node.lanes.filter((lane) => !lane.isFallback);
    const fallbackLane = node.lanes.find((lane) => lane.isFallback) ?? null;
    const branchGroupKey = `branch:${node.id}`;

    for (let laneIndex = 0; laneIndex < nonFallback.length; laneIndex += 1) {
      const lane = nonFallback[laneIndex];
      const checkLabel = laneIndex === 0 ? `node:${node.id}` : `node:${node.id}:check:${laneIndex}`;

      const laneStartLabel = lane.nodeIds.length > 0 ? `node:${lane.nodeIds[0]}` : nextLabel;
      const nextCheckLabel = laneIndex < nonFallback.length - 1
        ? `node:${node.id}:check:${laneIndex + 1}`
        : (fallbackLane && fallbackLane.nodeIds.length > 0 ? `node:${fallbackLane.nodeIds[0]}` : nextLabel);
      const laneCondition = buildLaneCondition(node, node.lanes.findIndex((candidate) => candidate.id === lane.id));

      pushBranchStep(
        steps,
        checkLabel,
        `${node.title} - ${lane.label}`,
        node.note ?? null,
        laneCondition,
        laneStartLabel,
        nextCheckLabel,
        {
          groupKey: branchGroupKey,
          title: node.title,
          laneLabel: lane.label,
          laneIndex,
          fallbackLabel: fallbackLane?.label ?? "Otherwise",
        },
      );

      if (lane.nodeIds.length > 0) {
        const jumpLabel = `node:${node.id}:lane:${lane.id}:jump`;
        compileNodeChain(doc, lane.nodeIds, jumpLabel, steps);
        pushJumpStep(steps, jumpLabel, nextLabel);
      }
    }

    if (fallbackLane?.nodeIds.length) {
      compileNodeChain(doc, fallbackLane.nodeIds, nextLabel, steps);
    }
  }
}

/** Resolves temporary branch jump labels into numeric order indexes. */
function resolveBranchJumpLabels(steps: PlannedStep[]): BackendStewardPathStepInput[] {
  const labelToOrder = new Map<string, number>();
  steps.forEach((entry, orderIndex) => {
    labelToOrder.set(entry.label, orderIndex);
  });

  return steps.map((entry, orderIndex) => {
    if (entry.step.stepType !== "BRANCH_PLACEHOLDER") {
      return {
        ...entry.step,
        orderIndex,
      };
    }

    const cfg = entry.step.configJson && typeof entry.step.configJson === "object"
      ? { ...(entry.step.configJson as Record<string, unknown>) }
      : {};

    const trueLabel = typeof cfg.whenTrueAdvanceToLabel === "string" ? cfg.whenTrueAdvanceToLabel : null;
    const falseLabel = typeof cfg.whenFalseAdvanceToLabel === "string" ? cfg.whenFalseAdvanceToLabel : null;

    delete cfg.whenTrueAdvanceToLabel;
    delete cfg.whenFalseAdvanceToLabel;

    if (trueLabel && labelToOrder.has(trueLabel)) {
      cfg.whenTrueAdvanceToOrderIndex = labelToOrder.get(trueLabel);
    }
    if (falseLabel && labelToOrder.has(falseLabel)) {
      cfg.whenFalseAdvanceToOrderIndex = labelToOrder.get(falseLabel);
    }

    return {
      ...entry.step,
      configJson: cfg,
      orderIndex,
    };
  });
}

/**
 * Converts the visual document into linear template + step payloads.
 *
 * TODO(branch-persistence): map branch lanes into backend branch jump indexes
 * once full branch execution and join semantics are finalized.
 */
export function toLinearWorkflowExport(doc: WorkflowDocument): LinearWorkflowExport {
  const triggerNode = doc.rootNodeIds
    .map((nodeId) => doc.nodesById[nodeId])
    .find((node) => node && isTriggerKind(node.kind)) ?? null;

  const template: BackendStewardPathTemplateInput = {
    name: doc.pathName.trim() || "Untitled Steward Path",
    description: null,
    targetType: "CONSTITUENT",
    crmScope: "DONOR",
    status: toBackendTemplateStatus(doc.status),
    triggerType: toBackendTriggerType(triggerNode?.kind ?? null),
    triggerConfig: triggerNode ? triggerNode.config : undefined,
  };

  const plannedSteps: PlannedStep[] = [];
  compileNodeChain(doc, doc.rootNodeIds, null, plannedSteps);
  const steps = resolveBranchJumpLabels(plannedSteps);

  return {
    template,
    steps,
    report: analyzeWorkflowSupport(doc),
  };
}

/** Maps one backend step row into a visual action/branch node kind. */
function kindFromBackendStep(step: BackendStewardPathTemplateResponse["steps"][number]): string {
  switch (step.stepType) {
    case "DELAY":
      return "timing.delay";
    case "CREATE_TASK": {
      const command = typeof step.configJson?.command === "string" ? step.configJson.command : "";
      if (command === "livecom.route_to_staff") return "livecom.route_to_staff";
      return "task.create";
    }
    case "GENERATE_LETTER":
      return "print.generate_letter";
    case "DRAFT_EMAIL": {
      if (step.configJson?.waitForReview === true || step.configJson?.requireApprovalBeforeSend === true) {
        return "email.send_review_request";
      }
      return "email.create_draft";
    }
    case "SEND_EMAIL":
      return "email.schedule_blast";
    case "INTERNAL_NOTE": {
      const operation = typeof step.configJson?.operation === "string" ? step.configJson.operation : "";
      if (operation === "add_tag") return "donor.add_tag";
      if (operation === "remove_tag") return "donor.remove_tag";
      if (operation === "add_to_print_queue") return "print.add_to_print_queue";
      if (operation === "require_print_approval") return "print.require_print_approval";
      if (operation === "mark_printed") return "print.mark_printed";
      if (operation === "add_to_mail_queue") return "print.add_to_mail_queue";
      if (operation === "mark_mailed") return "print.mark_mailed";
      return "donor.add_note";
    }
    case "STATUS_CHANGE": {
      const targetField = typeof step.configJson?.targetField === "string" ? step.configJson.targetField : "";
      if (targetField === "retentionStage") return "donor.set_retention_stage";
      return targetField === "engagementScore" ? "donor.adjust_engagement_score" : "donor.update_status";
    }
    case "MANUAL_ACTION": {
      const command = typeof step.configJson?.command === "string" ? step.configJson.command : "";
      if (command === "task.assign_staff") return "task.assign_staff";
      if (command === "task.wait_for_completion") return "task.wait_for_completion";
      if (command === "task.escalate_overdue") return "task.escalate_overdue";
      if (command === "livecom.send_message") return "livecom.send_message";
      if (command === "livecom.wait_for_reply") return "livecom.wait_for_reply";
      if (command === "email.add_to_sequence") return "email.add_to_sequence";
      if (command === "email.wait_for_open") return "email.wait_for_open";
      if (command === "email.mark_failed") return "email.mark_failed";
      if (command === "logic.segment_condition") return "logic.segment_condition";
      if (command === "logic.donation_amount_condition") return "logic.donation_amount_condition";
      if (command === "logic.communication_preference_condition") return "logic.communication_preference_condition";
      if (command === "logic.email_engagement_condition") return "logic.email_engagement_condition";
      if (command === "logic.retention_risk_condition") return "logic.retention_risk_condition";
      if (command === "safety.notify_staff") return "safety.notify_staff";
      if (command === "safety.stop_enrollment") return "safety.stop_enrollment";
      return "safety.require_human_approval";
    }
    case "BRANCH_PLACEHOLDER":
    default:
      return "logic.if_else";
  }
}

/** Looks up one friendly label from the palette catalog. */
function labelFromKind(kind: string): string {
  return PALETTE_ITEMS.find((item) => item.kind === kind)?.label ?? kind;
}

/** Maps one branch field back to the closest logic block kind. */
function branchKindFromField(field: string): string {
  if (field === "segmentMembership") return "logic.segment_condition";
  if (field === "lastGiftAmount" || field === "totalLifetimeGiving") return "logic.donation_amount_condition";
  if (field === "doNotEmail" || field === "emailOptOut" || field === "doNotMail" || field === "doNotCall" || field === "doNotContact") {
    return "logic.communication_preference_condition";
  }
  if (field === "retentionRiskScore") return "logic.retention_risk_condition";
  if (field === "engagementScore") return "logic.email_engagement_condition";
  return "logic.if_else";
}

/** Normalizes one branch condition value into text stored by builder forms. */
function toConditionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** Returns one safe config object from a backend step row. */
function stepConfig(step: BackendStewardPathTemplateResponse["steps"][number]): Record<string, unknown> {
  if (step.configJson && typeof step.configJson === "object" && !Array.isArray(step.configJson)) {
    return step.configJson as Record<string, unknown>;
  }
  return {};
}

/** Reads optional builder-only metadata embedded in branch placeholder config. */
function stepBuilderMeta(step: BackendStewardPathTemplateResponse["steps"][number]): Record<string, unknown> | null {
  const config = stepConfig(step);
  const meta = config.builderMeta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return null;
}

/** Splits names emitted as `Branch title - Lane label` by the export compiler. */
function parseBranchLaneName(name: string): { branchTitle: string; laneLabel: string } | null {
  const splitAt = name.lastIndexOf(" - ");
  if (splitAt <= 0 || splitAt >= name.length - 3) {
    return null;
  }
  const branchTitle = name.slice(0, splitAt).trim();
  const laneLabel = name.slice(splitAt + 3).trim();
  if (!branchTitle || !laneLabel) return null;
  return { branchTitle, laneLabel };
}

/** Converts one backend `condition` object into a builder lane condition group. */
function conditionToGroup(
  condition: Record<string, unknown> | null,
  idFactory: () => string,
): WorkflowBranchConditionGroup {
  if (!condition) {
    return { id: idFactory(), operator: "eq", value: "" };
  }

  const rawOperator = typeof condition.operator === "string" ? condition.operator : "eq";
  if (rawOperator === "between") {
    return {
      id: idFactory(),
      operator: "between",
      value: toConditionText(condition.value),
      valueTo: toConditionText(condition.valueTo ?? condition.value),
    };
  }

  if (rawOperator === "in" || rawOperator === "not_in") {
    const rawValues = Array.isArray(condition.value)
      ? condition.value
      : condition.value === undefined || condition.value === null
        ? []
        : [condition.value];

    return {
      id: idFactory(),
      operator: rawOperator,
      value: rawValues.map((value) => toConditionText(value)).filter(Boolean).join(", "),
    };
  }

  return {
    id: idFactory(),
    operator: rawOperator as WorkflowBranchConditionGroup["operator"],
    value: toConditionText(condition.value),
  };
}

/** Rebuilds one multi-lane branch node from contiguous branch placeholder rows. */
function mergedBranchNodeFromSteps(
  steps: Array<BackendStewardPathTemplateResponse["steps"][number]>,
  idFactory: () => string,
): WorkflowBranchNode {
  const first = steps[0];
  const firstMeta = stepBuilderMeta(first) ?? {};
  const parsedFirst = parseBranchLaneName(first.name || "");

  const title = readString(firstMeta, "title", parsedFirst?.branchTitle || first.name || "Conditional Branch");
  const fallbackLabel = readString(firstMeta, "fallbackLabel", "Otherwise");

  let field = "lastGiftAmount";
  const lanes = steps.map((step, index) => {
    const config = stepConfig(step);
    const meta = stepBuilderMeta(step) ?? {};
    const condition = config.condition && typeof config.condition === "object" && !Array.isArray(config.condition)
      ? (config.condition as Record<string, unknown>)
      : null;

    if (condition && typeof condition.field === "string" && condition.field.trim()) {
      field = condition.field.trim();
    }

    const parsed = parseBranchLaneName(step.name || "");
    const laneLabel = readString(meta, "laneLabel", parsed?.laneLabel || `Path ${index + 1}`);

    return {
      ...createBranchLane(idFactory, laneLabel, { includeDefaultCondition: false }),
      conditionGroups: [conditionToGroup(condition, idFactory)],
    };
  });

  lanes.push(createBranchLane(idFactory, fallbackLabel, { isFallback: true, includeDefaultCondition: false }));

  return {
    id: first.id,
    nodeType: "branch",
    kind: branchKindFromField(field),
    title,
    note: first.description ?? undefined,
    statusLabel: "Draft",
    config: { field },
    lanes,
  };
}

/** Builds a branch node shape from one backend BRANCH_PLACEHOLDER step. */
function branchNodeFromStep(
  step: BackendStewardPathTemplateResponse["steps"][number],
  idFactory: () => string,
): WorkflowBranchNode {
  const config = stepConfig(step);
  const meta = stepBuilderMeta(step) ?? {};
  const condition = config.condition && typeof config.condition === "object" && !Array.isArray(config.condition)
    ? (config.condition as Record<string, unknown>)
    : null;
  const parsed = parseBranchLaneName(step.name || "");

  const field = condition && typeof condition.field === "string" && condition.field.trim()
    ? condition.field.trim()
    : (typeof config.field === "string" && config.field.trim() ? config.field.trim() : "lastGiftAmount");
  const branchKind = branchKindFromField(field);

  const trueLabel = readString(meta, "laneLabel", parsed?.laneLabel || "True");
  const falseLabel = readString(meta, "fallbackLabel", "False");
  const title = readString(meta, "title", parsed?.branchTitle || step.name || labelFromKind(branchKind));

  return {
    id: step.id,
    nodeType: "branch",
    kind: branchKind,
    title,
    note: step.description ?? undefined,
    statusLabel: "Draft",
    config: {
      field,
    },
    lanes: [
      {
        ...createBranchLane(idFactory, trueLabel, { includeDefaultCondition: false }),
        conditionGroups: [conditionToGroup(condition, idFactory)],
      },
      createBranchLane(idFactory, falseLabel, { includeDefaultCondition: false, isFallback: true }),
    ],
  };
}

/** Converts one API template payload into the visual builder document shape. */
export function fromBackendTemplate(
  template: BackendStewardPathTemplateResponse,
  idFactory: () => string,
): WorkflowDocument {
  const doc = createWorkflowDocument(idFactory);
  const rootNodeIds: string[] = [];
  const nodesById: Record<string, WorkflowNode> = {};

  const triggerKind = fromBackendTriggerType(template.triggerType || "MANUAL");
  const triggerNodeId = idFactory();
  rootNodeIds.push(triggerNodeId);
  nodesById[triggerNodeId] = {
    id: triggerNodeId,
    nodeType: "action",
    kind: triggerKind,
    title: labelFromKind(triggerKind),
    config: template.triggerConfig && typeof template.triggerConfig === "object" ? template.triggerConfig : {},
    statusLabel: "Draft",
  };

  const orderedSteps = [...template.steps]
    .filter((step) => step.isActive !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (let stepIndex = 0; stepIndex < orderedSteps.length; stepIndex += 1) {
    const step = orderedSteps[stepIndex];
    const kind = kindFromBackendStep(step);
    if (step.stepType === "BRANCH_PLACEHOLDER") {
      const firstMeta = stepBuilderMeta(step) ?? {};
      const groupKey = readString(firstMeta, "groupKey");
      const parsedFirst = parseBranchLaneName(step.name || "");

      const groupedSteps = [step];
      let cursor = stepIndex + 1;
      while (cursor < orderedSteps.length) {
        const candidate = orderedSteps[cursor];
        if (candidate.stepType !== "BRANCH_PLACEHOLDER") break;

        const candidateMeta = stepBuilderMeta(candidate) ?? {};
        const candidateGroupKey = readString(candidateMeta, "groupKey");
        if (groupKey && candidateGroupKey === groupKey) {
          groupedSteps.push(candidate);
          cursor += 1;
          continue;
        }

        if (!groupKey && parsedFirst) {
          const parsedCandidate = parseBranchLaneName(candidate.name || "");
          if (parsedCandidate && parsedCandidate.branchTitle === parsedFirst.branchTitle) {
            groupedSteps.push(candidate);
            cursor += 1;
            continue;
          }
        }

        break;
      }

      if (groupedSteps.length > 1) {
        const mergedBranch = mergedBranchNodeFromSteps(groupedSteps, idFactory);
        nodesById[mergedBranch.id] = mergedBranch;
        rootNodeIds.push(mergedBranch.id);
        stepIndex = cursor - 1;
        continue;
      }

      const branchNode = branchNodeFromStep(step, idFactory);
      nodesById[branchNode.id] = branchNode;
      rootNodeIds.push(branchNode.id);
      continue;
    }

    nodesById[step.id] = {
      id: step.id,
      nodeType: "action",
      kind,
      title: step.name || labelFromKind(kind),
      note: step.description ?? undefined,
      statusLabel: "Draft",
      config: step.configJson && typeof step.configJson === "object" ? step.configJson : {},
    };
    rootNodeIds.push(step.id);
  }

  return {
    ...doc,
    id: template.id,
    pathName: template.name,
    status: fromBackendTemplateStatus(template.status),
    rootNodeIds,
    nodesById,
    persistence: {
      mode: "api",
      templateId: template.id,
      lastSavedAt: null,
    },
  };
}
