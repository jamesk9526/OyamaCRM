/** Compatibility adapters for visual workflow and legacy automation conversion. */
import type { AutomationTrigger, AutomationActionType } from "@prisma/client";

import type { BackendStewardPathStepInput, BackendStewardPathTemplateInput } from "./workflow-transformers";

interface LegacyAutomationRecord {
  name: string;
  description?: string | null;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown> | null;
  actions: Array<{
    type: AutomationActionType;
    order: number;
    config?: Record<string, unknown> | null;
  }>;
}

/** Converts legacy automation trigger value to steward-path triggerType string. */
export function mapLegacyTriggerToStewardTrigger(trigger: AutomationTrigger): string {
  if (trigger === "DONATION_RECEIVED") return "DONATION_RECEIVED";
  if (trigger === "CONSTITUENT_CREATED") return "CONSTITUENT_CREATED";
  if (trigger === "TASK_DUE") return "TASK_DUE";
  if (trigger === "PLEDGE_CREATED") return "PLEDGE_CREATED";
  if (trigger === "EMAIL_OPENED") return "EMAIL_OPENED";
  if (trigger === "EVENT_REGISTERED") return "EVENT_REGISTERED";
  return "MANUAL";
}

/** Converts one legacy action to steward-path step shape. */
export function mapLegacyActionToStep(action: LegacyAutomationRecord["actions"][number]): BackendStewardPathStepInput {
  if (action.type === "SEND_EMAIL") {
    return {
      name: "Create review-required email",
      description: "Migrated from legacy automation",
      stepType: "DRAFT_EMAIL",
      configJson: action.config ?? {},
      orderIndex: action.order,
      isRequired: true,
      isActive: true,
    };
  }
  if (action.type === "CREATE_TASK") {
    return {
      name: "Create task",
      description: "Migrated from legacy automation",
      stepType: "CREATE_TASK",
      configJson: action.config ?? {},
      orderIndex: action.order,
      isRequired: true,
      isActive: true,
    };
  }
  if (action.type === "UPDATE_FIELD") {
    return {
      name: "Update donor field",
      description: "Migrated from legacy automation",
      stepType: "STATUS_CHANGE",
      configJson: action.config ?? {},
      orderIndex: action.order,
      isRequired: true,
      isActive: true,
    };
  }
  if (action.type === "ADD_TAG" || action.type === "REMOVE_TAG") {
    return {
      name: action.type === "ADD_TAG" ? "Add donor tag" : "Remove donor tag",
      description: "Migrated from legacy automation",
      stepType: "STATUS_CHANGE",
      configJson: {
        targetField: action.type === "ADD_TAG" ? "addTag" : "removeTag",
        ...(action.config ?? {}),
      },
      orderIndex: action.order,
      isRequired: true,
      isActive: true,
    };
  }

  return {
    name: "Manual follow-up",
    description: "Migrated with compatibility fallback",
    stepType: "MANUAL_ACTION",
    configJson: {
      migrationWarning: "Legacy action did not map directly and was preserved as manual action.",
      legacyActionType: action.type,
      ...(action.config ?? {}),
    },
    orderIndex: action.order,
    isRequired: true,
    isActive: true,
  };
}

/** Converts one legacy automation to steward-path template+step payloads. */
export function mapLegacyAutomationToStewardTemplate(automation: LegacyAutomationRecord): {
  template: BackendStewardPathTemplateInput;
  steps: BackendStewardPathStepInput[];
} {
  return {
    template: {
      name: automation.name,
      description: automation.description ?? null,
      targetType: "CONSTITUENT",
      crmScope: "DONOR",
      status: "DRAFT",
      triggerType: mapLegacyTriggerToStewardTrigger(automation.trigger),
      triggerConfig: {
        ...(automation.triggerConfig ?? {}),
        _migration: {
          source: "legacy-automation",
          migratedAt: new Date().toISOString(),
        },
      },
    },
    steps: automation.actions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((action, index) => ({ ...mapLegacyActionToStep(action), orderIndex: index })),
  };
}
