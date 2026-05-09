/**
 * Steward Paths execution engine.
 * Runs enabled automations for a trigger and executes supported action steps.
 */
import { randomUUID } from "crypto";
import type { AutomationActionType, AutomationTrigger, TaskPriority, TaskType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";

/** Trigger payload used to execute Steward Paths for a single business event. */
export interface StewardPathTriggerInput {
  organizationId: string;
  trigger: AutomationTrigger;
  constituentId?: string;
  donationId?: string;
  taskId?: string;
  userId?: string;
  source?: string;
}

interface ActionExecutionResult {
  actionId: string;
  type: AutomationActionType;
  success: boolean;
  message: string;
}

interface DonationTriggerContext {
  amount: number;
  constituentId: string;
  isFirstDonation: boolean;
}

interface TriggerEvaluationContext {
  donation?: DonationTriggerContext;
}

/**
 * Executes every enabled automation for a trigger in the given organization.
 * Returns counts and per-action execution messages for diagnostics.
 */
export async function executeStewardPathsForTrigger(input: StewardPathTriggerInput): Promise<{
  automationsMatched: number;
  actionsAttempted: number;
  actionsSucceeded: number;
  results: ActionExecutionResult[];
}> {
  const context = await buildTriggerEvaluationContext(input);

  const automations = await prisma.automation.findMany({
    where: {
      organizationId: input.organizationId,
      trigger: input.trigger,
      enabled: true,
    },
    include: {
      actions: { orderBy: { order: "asc" } },
    },
  });

  if (automations.length === 0) {
    return { automationsMatched: 0, actionsAttempted: 0, actionsSucceeded: 0, results: [] };
  }

  const results: ActionExecutionResult[] = [];
  let actionsAttempted = 0;
  let actionsSucceeded = 0;

  for (const automation of automations) {
    if (!passesTriggerGuardrails(automation.triggerConfig as Record<string, unknown> | null, input, context)) {
      continue;
    }

    const runId = randomUUID();
    const actionStartIndex = results.length;
    for (const action of automation.actions) {
      actionsAttempted += 1;
      const result = await executeActionStep({
        actionId: action.id,
        actionType: action.type,
        config: action.config as Record<string, unknown> | null,
        input,
      });
      if (result.success) actionsSucceeded += 1;
      results.push(result);

      await logAudit({
        action: "STEWARD_PATH_ACTION",
        entity: "AutomationAction",
        entityId: action.id,
        userId: input.userId,
        organizationId: input.organizationId,
        metadata: {
          runId,
          automationId: automation.id,
          trigger: input.trigger,
          success: result.success,
          message: result.message,
          actionType: result.type,
          source: input.source ?? "unknown",
          constituentId: input.constituentId,
          donationId: input.donationId,
          taskId: input.taskId,
        },
      });
    }

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
      },
    });

    await logAudit({
      action: "STEWARD_PATH_RUN",
      entity: "Automation",
      entityId: automation.id,
      userId: input.userId,
      organizationId: input.organizationId,
      metadata: {
        runId,
        automationName: automation.name,
        trigger: input.trigger,
        source: input.source ?? "unknown",
        constituentId: input.constituentId,
        donationId: input.donationId,
        taskId: input.taskId,
        actionsAttempted: automation.actions.length,
        actionsSucceeded: results.slice(actionStartIndex).filter((r) => r.success).length,
        results: results.slice(actionStartIndex),
      },
    });
  }

  return {
    automationsMatched: automations.length,
    actionsAttempted,
    actionsSucceeded,
    results,
  };
}

/** Builds trigger-specific context used by guardrail evaluation. */
async function buildTriggerEvaluationContext(input: StewardPathTriggerInput): Promise<TriggerEvaluationContext> {
  if (input.trigger !== "DONATION_RECEIVED" || !input.donationId) {
    return {};
  }

  const donation = await prisma.donation.findUnique({
    where: { id: input.donationId },
    select: { id: true, amount: true, constituentId: true },
  });

  if (!donation?.constituentId) {
    return {};
  }

  const completedGiftCount = await prisma.donation.count({
    where: {
      constituentId: donation.constituentId,
      status: "COMPLETED",
    },
  });

  return {
    donation: {
      amount: Number(donation.amount),
      constituentId: donation.constituentId,
      isFirstDonation: completedGiftCount <= 1,
    },
  };
}

/**
 * Evaluates optional triggerConfig guardrails before an automation is executed.
 * Donation guardrails currently supported:
 * - firstDonationOnly: boolean
 * - majorGiftMinAmount: number
 * - minDonationAmount: number
 * - maxDonationAmount: number
 */
function passesTriggerGuardrails(
  triggerConfig: Record<string, unknown> | null,
  input: StewardPathTriggerInput,
  context: TriggerEvaluationContext
): boolean {
  if (!triggerConfig) return true;
  if (input.trigger !== "DONATION_RECEIVED") return true;

  const donation = context.donation;
  if (!donation) {
    // If no donation context exists, keep behavior permissive for manual tests.
    return true;
  }

  const firstDonationOnly = asBoolean(triggerConfig.firstDonationOnly);
  if (firstDonationOnly && !donation.isFirstDonation) {
    return false;
  }

  const majorGiftMinAmount = asNumber(triggerConfig.majorGiftMinAmount);
  if (majorGiftMinAmount !== null && donation.amount < majorGiftMinAmount) {
    return false;
  }

  const minDonationAmount = asNumber(triggerConfig.minDonationAmount);
  if (minDonationAmount !== null && donation.amount < minDonationAmount) {
    return false;
  }

  const maxDonationAmount = asNumber(triggerConfig.maxDonationAmount);
  if (maxDonationAmount !== null && donation.amount > maxDonationAmount) {
    return false;
  }

  return true;
}

/** Executes one automation action with conservative, non-destructive behavior. */
async function executeActionStep(args: {
  actionId: string;
  actionType: AutomationActionType;
  config: Record<string, unknown> | null;
  input: StewardPathTriggerInput;
}): Promise<ActionExecutionResult> {
  const { actionId, actionType, config, input } = args;

  try {
    switch (actionType) {
      case "SEND_EMAIL": {
        if (!input.constituentId) {
          return { actionId, type: actionType, success: false, message: "Missing constituent context for SEND_EMAIL" };
        }

        const template = asString(config?.template) ?? "general-stewardship";
        await prisma.activity.create({
          data: {
            constituentId: input.constituentId,
            donationId: input.donationId,
            taskId: input.taskId,
            userId: input.userId,
            type: "EMAIL_SENT",
            description: `Steward Path email queued (${template})`,
            metadata: {
              source: "steward-paths",
              template,
              trigger: input.trigger,
            },
          },
        });
        return { actionId, type: actionType, success: true, message: `Email activity logged (${template})` };
      }

      case "CREATE_TASK": {
        const title = asString(config?.title) ?? "Steward Path follow-up";
        const description = asString(config?.description) ?? null;
        const taskType = normalizeTaskType(asString(config?.taskType));
        const priority = normalizeTaskPriority(asString(config?.priority));
        const dueDate = buildDueDate(config?.daysAfter);

        await prisma.task.create({
          data: {
            constituentId: input.constituentId,
            createdById: input.userId,
            title,
            description,
            type: taskType,
            priority,
            dueDate,
          },
        });

        return { actionId, type: actionType, success: true, message: `Task created (${title})` };
      }

      case "ADD_TAG": {
        if (!input.constituentId) {
          return { actionId, type: actionType, success: false, message: "Missing constituent context for ADD_TAG" };
        }
        const tagName = asString(config?.tag);
        if (!tagName) {
          return { actionId, type: actionType, success: false, message: "ADD_TAG requires config.tag" };
        }

        let tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (!tag) {
          tag = await prisma.tag.create({ data: { name: tagName } });
        }

        await prisma.constituentTag.upsert({
          where: {
            constituentId_tagId: {
              constituentId: input.constituentId,
              tagId: tag.id,
            },
          },
          create: {
            constituentId: input.constituentId,
            tagId: tag.id,
          },
          update: {},
        });

        return { actionId, type: actionType, success: true, message: `Tag added (${tagName})` };
      }

      case "REMOVE_TAG": {
        if (!input.constituentId) {
          return { actionId, type: actionType, success: false, message: "Missing constituent context for REMOVE_TAG" };
        }
        const tagName = asString(config?.tag);
        if (!tagName) {
          return { actionId, type: actionType, success: false, message: "REMOVE_TAG requires config.tag" };
        }

        const tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (!tag) {
          return { actionId, type: actionType, success: true, message: `Tag not present (${tagName})` };
        }

        await prisma.constituentTag.deleteMany({
          where: {
            constituentId: input.constituentId,
            tagId: tag.id,
          },
        });

        return { actionId, type: actionType, success: true, message: `Tag removed (${tagName})` };
      }

      case "UPDATE_FIELD": {
        if (!input.constituentId) {
          return { actionId, type: actionType, success: false, message: "Missing constituent context for UPDATE_FIELD" };
        }
        const field = asString(config?.field);
        if (!field) {
          return { actionId, type: actionType, success: false, message: "UPDATE_FIELD requires config.field" };
        }

        // Keep updates explicit and safe to avoid accidental broad data mutation.
        if (field === "donorStatus") {
          const donorStatus = asString(config?.value);
          if (!donorStatus) {
            return { actionId, type: actionType, success: false, message: "UPDATE_FIELD donorStatus requires config.value" };
          }
          await prisma.constituent.update({
            where: { id: input.constituentId },
            data: { donorStatus: donorStatus as never },
          });
          return { actionId, type: actionType, success: true, message: `Constituent donorStatus updated (${donorStatus})` };
        }

        if (field === "notes") {
          const noteValue = asString(config?.value) ?? "";
          await prisma.constituent.update({
            where: { id: input.constituentId },
            data: { notes: noteValue },
          });
          return { actionId, type: actionType, success: true, message: "Constituent notes updated" };
        }

        return { actionId, type: actionType, success: false, message: `Unsupported UPDATE_FIELD target (${field})` };
      }

      case "ASSIGN_USER": {
        const assigneeId = asString(config?.assigneeId) ?? asString(config?.userId);
        if (!assigneeId) {
          return { actionId, type: actionType, success: false, message: "ASSIGN_USER requires config.assigneeId or config.userId" };
        }

        const existingTask = await prisma.task.findFirst({
          where: {
            constituentId: input.constituentId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingTask) {
          await prisma.task.update({
            where: { id: existingTask.id },
            data: { assigneeId },
          });
          return { actionId, type: actionType, success: true, message: `Assigned existing task (${existingTask.id})` };
        }

        await prisma.task.create({
          data: {
            constituentId: input.constituentId,
            assigneeId,
            createdById: input.userId,
            title: "Steward Path assignment",
            description: "Auto-generated assignment from Steward Path.",
            type: "FOLLOW_UP",
            priority: "MEDIUM",
          },
        });

        return { actionId, type: actionType, success: true, message: "Created and assigned follow-up task" };
      }

      default:
        return { actionId, type: actionType, success: false, message: `Unsupported action type (${actionType})` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action execution failed";
    return { actionId, type: actionType, success: false, message };
  }
}

/** Best-effort conversion to a nullable string. */
function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Best-effort conversion to nullable number. */
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Best-effort conversion to boolean. */
function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

/** Builds a due date by adding N days to now if daysAfter is numeric. */
function buildDueDate(daysAfter: unknown): Date | null {
  const parsed = typeof daysAfter === "number" ? daysAfter : Number.parseInt(String(daysAfter ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + parsed);
  return dueDate;
}

/** Normalize task type safely with a fallback understood by Prisma enum. */
function normalizeTaskType(value: string | null): TaskType {
  const allowed: TaskType[] = ["CALL", "EMAIL", "MAIL", "MEETING", "THANK_YOU", "FOLLOW_UP", "OTHER"];
  return allowed.includes(value as TaskType) ? (value as TaskType) : "FOLLOW_UP";
}

/** Normalize task priority safely with a fallback understood by Prisma enum. */
function normalizeTaskPriority(value: string | null): TaskPriority {
  const allowed: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  return allowed.includes(value as TaskPriority) ? (value as TaskPriority) : "MEDIUM";
}
