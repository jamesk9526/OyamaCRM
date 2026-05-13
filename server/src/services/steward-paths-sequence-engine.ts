/**
 * Steward Paths engagement sequence engine.
 * Processes due enrollments step-by-step with auditable timeline events.
 */
import {
  type Prisma,
  type StewardPathEnrollment,
  type StewardPathEnrollmentStatus,
  type StewardPathStep,
  type StewardPathStepRun,
  type StewardPathStepRunStatus,
  type StewardPathStepType,
  type StewardPathTimelineEventType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { generateLetterFromTemplate } from "./letters-execution.js";

/**
 * Local mirror of the BranchOperator type from `app/lib/engagement-orchestration.ts`.
 *
 * The shared module lives outside the server tsconfig rootDir, so we cannot
 * import directly. The semantics MUST stay in sync with the shared helpers
 * (the same operators are evaluated by `evaluateBranchRule` below). When
 * adding a new operator, update both files together.
 */
type BranchOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in";

/**
 * Local mirror of `evaluateBranchRule` from `app/lib/engagement-orchestration.ts`.
 * Same algorithm, kept in sync deliberately. Both modules are unit tested.
 */
function evaluateBranchRule(
  input: number | string | null | undefined,
  rule: { operator: BranchOperator; value: number | string | Array<number | string> },
): boolean {
  if (rule.operator === "in" || rule.operator === "not_in") {
    if (!Array.isArray(rule.value)) return false;
    const list = rule.value.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
    const target = typeof input === "string" ? input.toLowerCase() : input;
    const hit = target == null ? false : list.includes(target);
    return rule.operator === "in" ? hit : !hit;
  }
  if (rule.operator === "eq" || rule.operator === "neq") {
    const a = typeof input === "string" ? input.toLowerCase() : input;
    const b = typeof rule.value === "string" ? rule.value.toLowerCase() : rule.value;
    const equal = a === b;
    return rule.operator === "eq" ? equal : !equal;
  }
  if (typeof input !== "number" || typeof rule.value !== "number") return false;
  switch (rule.operator) {
    case "gt": return input > rule.value;
    case "gte": return input >= rule.value;
    case "lt": return input < rule.value;
    case "lte": return input <= rule.value;
    default: return false;
  }
}

interface ProcessDueOptions {
  organizationId?: string;
  limit?: number;
  userId?: string;
  source?: string;
}

interface ProcessDueResult {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}

interface DelayStepConfig {
  amount?: number;
  unit?: "minutes" | "hours" | "days" | "weeks" | "months";
}

interface CreateTaskStepConfig {
  titleTemplate?: string;
  descriptionTemplate?: string;
  dueOffsetAmount?: number;
  dueOffsetUnit?: "hours" | "days" | "weeks";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  taskType?: "CALL" | "EMAIL" | "MAIL" | "MEETING" | "THANK_YOU" | "FOLLOW_UP" | "OTHER" | string;
  completionMode?: "continue_immediately_after_task_created" | "wait_until_task_completed";
}

interface GenerateLetterStepConfig {
  templateId?: string;
  year?: number;
  taskMode?: "none" | "create_and_continue" | "create_and_wait_for_completion";
  taskTitleTemplate?: string;
  taskDescriptionTemplate?: string;
  dueOffsetAmount?: number;
  dueOffsetUnit?: "hours" | "days" | "weeks";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  taskType?: "CALL" | "EMAIL" | "MAIL" | "MEETING" | "THANK_YOU" | "FOLLOW_UP" | "OTHER" | string;
}

interface DraftEmailStepConfig {
  subjectTemplate?: string;
  bodyTemplate?: string;
  fromMode?: string;
  replyToMode?: string;
  requireApprovalBeforeSend?: boolean;
  allowUserEdits?: boolean;
  assignedReviewerMode?: "path_owner" | "record_owner" | "specific_user" | "hrm_person";
  assignedReviewerId?: string;
  waitForReview?: boolean;
}

interface ManualActionStepConfig {
  instruction?: string;
}

interface EnrollmentContext {
  enrollment: StewardPathEnrollment & {
    path: {
      id: string;
      name: string;
      status: string;
      organizationId: string;
      defaultOwnerId: string | null;
    };
    currentStep: StewardPathStep | null;
    constituent: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      totalLifetimeGiving: unknown;
      lastGiftAmount: unknown;
      lastGiftDate: Date | null;
      donorStatus: "NEW" | "ACTIVE" | "LAPSED" | "MAJOR_DONOR" | "DECEASED";
      engagementScore: number;
      doNotEmail: boolean;
      emailOptOut: boolean;
      doNotMail: boolean;
      doNotCall: boolean;
      doNotContact: boolean;
    } | null;
  };
  run: StewardPathStepRun;
}

/** Finds due active enrollments and processes one step for each. */
export async function processDueStewardPathEnrollments(options: ProcessDueOptions = {}): Promise<ProcessDueResult> {
  const now = new Date();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);

  const enrollments = await prisma.stewardPathEnrollment.findMany({
    where: {
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      status: "ACTIVE",
      currentStepId: { not: null },
      nextStepDueAt: { not: null, lte: now },
    },
    include: {
      path: { select: { id: true, name: true, status: true, organizationId: true, defaultOwnerId: true } },
      currentStep: true,
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          totalLifetimeGiving: true,
          lastGiftAmount: true,
          lastGiftDate: true,
          donorStatus: true,
          engagementScore: true,
          doNotEmail: true,
          emailOptOut: true,
          doNotMail: true,
          doNotCall: true,
          doNotContact: true,
        },
      },
    },
    orderBy: { nextStepDueAt: "asc" },
    take: limit,
  });

  const result: ProcessDueResult = { processed: 0, completed: 0, failed: 0, skipped: 0 };

  for (const enrollment of enrollments) {
    result.processed += 1;

    if (enrollment.path.status !== "ACTIVE" || !enrollment.currentStep) {
      result.skipped += 1;
      continue;
    }

    const run = await prisma.stewardPathStepRun.upsert({
      where: {
        enrollmentId_stepId: {
          enrollmentId: enrollment.id,
          stepId: enrollment.currentStep.id,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        stepId: enrollment.currentStep.id,
        status: "PENDING",
      },
      update: {},
    });

    try {
      await processEnrollmentStep(
        {
          enrollment,
          run,
        },
        now,
        options.userId,
      );
      result.completed += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error ? error.message : "Step processing failed";
      await markEnrollmentFailed(enrollment.id, enrollment.currentStep.id, run.id, message, options.userId);
    }
  }

  return result;
}

/** Manually completes the current step when it is waiting for human action. */
export async function completeCurrentManualStep(enrollmentId: string, userId?: string, note?: string): Promise<boolean> {
  const enrollment = await prisma.stewardPathEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      path: { select: { id: true, name: true, status: true, organizationId: true, defaultOwnerId: true } },
      currentStep: true,
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          totalLifetimeGiving: true,
          lastGiftAmount: true,
          lastGiftDate: true,
          donorStatus: true,
          engagementScore: true,
          doNotEmail: true,
          emailOptOut: true,
          doNotMail: true,
          doNotCall: true,
          doNotContact: true,
        },
      },
    },
  });

  if (!enrollment || enrollment.status !== "ACTIVE" || !enrollment.currentStep) return false;

  const run = await prisma.stewardPathStepRun.upsert({
    where: {
      enrollmentId_stepId: {
        enrollmentId: enrollment.id,
        stepId: enrollment.currentStep.id,
      },
    },
    create: {
      enrollmentId: enrollment.id,
      stepId: enrollment.currentStep.id,
      status: "RUNNING",
      startedAt: new Date(),
      resultJson: note ? { completionNote: note } : undefined,
    },
    update: {
      status: "RUNNING",
      startedAt: new Date(),
      ...(note ? { resultJson: { completionNote: note } } : {}),
    },
  });

  if (enrollment.currentStep.stepType !== "MANUAL_ACTION") return false;

  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultJson: (note ? { completionNote: note } : toRecord(run.resultJson)) as Prisma.InputJsonValue,
    },
  });

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: enrollment.currentStep.id,
    eventType: "STEP_COMPLETED",
    message: note?.trim()
      ? `Manual action completed: ${note.trim()}`
      : `Manual action completed: ${enrollment.currentStep.name}`,
    createdByUserId: userId,
  });

  await advanceEnrollment(enrollment.id, enrollment.path.id, enrollment.currentStep.id, userId);
  return true;
}

/** Completes or fails one due step for an enrollment. */
async function processEnrollmentStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep;
  if (!step) return;

  switch (step.stepType) {
    case "DELAY":
      await processDelayStep(ctx, now, userId);
      break;
    case "CREATE_TASK":
      await processCreateTaskStep(ctx, now, userId);
      break;
    case "GENERATE_LETTER":
      await processGenerateLetterStep(ctx, now, userId);
      break;
    case "DRAFT_EMAIL":
      await processDraftEmailStep(ctx, now, userId);
      break;
    case "SEND_EMAIL":
      await processSendEmailStep(ctx, now, userId);
      break;
    case "MANUAL_ACTION":
      await processManualActionStep(ctx, now, userId);
      break;
    case "INTERNAL_NOTE":
      await processInternalNoteStep(ctx, now, userId);
      break;
    case "STATUS_CHANGE":
      await processStatusChangeStep(ctx, now, userId);
      break;
    case "BRANCH_PLACEHOLDER":
      await processBranchStep(ctx, now, userId);
      break;
    default:
      await prisma.stewardPathStepRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: `Unsupported step type: ${step.stepType}`,
        },
      });
      throw new Error(`Unsupported step type: ${step.stepType}`);
  }
}

/** Generates a letter/printable and optionally creates a linked follow-up task. */
async function processGenerateLetterStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const config = (step.configJson ?? {}) as GenerateLetterStepConfig;
  const taskMode = config.taskMode ?? "none";
  const actorUserId = userId ?? enrollment.ownerUserId ?? enrollment.path.defaultOwnerId ?? undefined;

  if (!actorUserId) {
    throw new Error("GENERATE_LETTER step requires actor user context");
  }

  if (run.status === "PENDING") {
    if (!config.templateId) {
      throw new Error("GENERATE_LETTER step requires config.templateId");
    }

    const generatedResult = await generateLetterFromTemplate({
      organizationId: enrollment.organizationId,
      templateId: config.templateId,
      actorUserId,
      constituentId: enrollment.constituentId ?? undefined,
      year: Number.isFinite(config.year) ? Number(config.year) : undefined,
      stewardPathEnrollmentId: enrollment.id,
      stewardPathStepRunId: run.id,
    });
    if (!generatedResult) {
      throw new Error("Template for GENERATE_LETTER step not found");
    }

    let taskId: string | null = null;
    if (taskMode !== "none") {
      const title = renderTemplate(config.taskTitleTemplate ?? `Follow up: ${generatedResult.template.name}`, enrollment);
      const description = renderTemplate(
        config.taskDescriptionTemplate ?? "Review and complete generated letter workflow tasks.",
        enrollment,
      ) || undefined;
      const dueDate = config.dueOffsetAmount && config.dueOffsetUnit
        ? addDuration(now, config.dueOffsetAmount, config.dueOffsetUnit)
        : null;

      const task = await prisma.task.create({
        data: {
          constituentId: enrollment.constituentId ?? undefined,
          createdById: actorUserId,
          assigneeId: enrollment.ownerUserId ?? enrollment.path.defaultOwnerId ?? undefined,
          title,
          description,
          type: normalizeTaskType(config.taskType),
          priority: normalizeTaskPriority(config.priority),
          dueDate,
          generatedLetterId: generatedResult.generated.id,
          stewardPathEnrollmentId: enrollment.id,
          stewardPathStepRunId: run.id,
        },
      });
      taskId = task.id;

      await prisma.generatedLetter.update({
        where: { id: generatedResult.generated.id },
        data: { sourceTaskId: task.id },
      });

      await createTimelineEvent({
        enrollmentId: enrollment.id,
        stepId: step.id,
        eventType: "TASK_CREATED",
        message: `Task created from generated letter: ${task.title}`,
        createdByUserId: actorUserId,
        metadataJson: { taskId: task.id, letterId: generatedResult.generated.id },
      });
    }

    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_STARTED",
      message: `Generated letter from template ${generatedResult.template.name}.`,
      createdByUserId: actorUserId,
      metadataJson: {
        letterId: generatedResult.generated.id,
        taskId,
        taskMode,
      },
    });

    if (taskMode === "create_and_wait_for_completion" && taskId) {
      const nextPoll = addDuration(now, 30, "minutes");
      await prisma.stewardPathStepRun.update({
        where: { id: run.id },
        data: {
          status: "RUNNING",
          startedAt: now,
          scheduledFor: nextPoll,
          resultJson: {
            letterId: generatedResult.generated.id,
            taskId,
            taskMode,
          },
        },
      });
      await prisma.stewardPathEnrollment.update({
        where: { id: enrollment.id },
        data: { nextStepDueAt: nextPoll },
      });
      return;
    }

    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        startedAt: now,
        completedAt: now,
        resultJson: {
          letterId: generatedResult.generated.id,
          taskId,
          taskMode,
        },
      },
    });
    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
    return;
  }

  if (run.status !== "RUNNING") return;

  const resultJson = toRecord(run.resultJson);
  const taskId = typeof resultJson.taskId === "string" ? resultJson.taskId : null;
  if (!taskId) {
    throw new Error("GENERATE_LETTER waiting mode is missing taskId");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task) {
    throw new Error("Linked task for GENERATE_LETTER step no longer exists");
  }

  if (task.status === "COMPLETED") {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_COMPLETED",
      message: `${step.name} completed after linked task completion.`,
      createdByUserId: actorUserId,
      metadataJson: { taskId },
    });
    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
    return;
  }

  const nextPoll = addDuration(now, 30, "minutes");
  await prisma.stewardPathEnrollment.update({
    where: { id: enrollment.id },
    data: { nextStepDueAt: nextPoll },
  });
  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: { scheduledFor: nextPoll },
  });
}

/** Handles a delay step by scheduling then completing once due. */
async function processDelayStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const config = (step.configJson ?? {}) as DelayStepConfig;

  if (run.status === "PENDING") {
    const scheduledFor = addDuration(now, Math.max(config.amount ?? 1, 1), config.unit ?? "days");
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "SCHEDULED",
        scheduledFor,
        startedAt: now,
      },
    });
    await prisma.stewardPathEnrollment.update({
      where: { id: enrollment.id },
      data: {
        nextStepDueAt: scheduledFor,
      },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_SCHEDULED",
      message: `${step.name} scheduled for ${scheduledFor.toISOString()}.`,
      createdByUserId: userId,
      metadataJson: { amount: config.amount ?? 1, unit: config.unit ?? "days" },
    });
    return;
  }

  if (run.status === "SCHEDULED" && run.scheduledFor && run.scheduledFor > now) {
    return;
  }

  if (run.status === "SCHEDULED" || run.status === "RUNNING") {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completedAt: now },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_COMPLETED",
      message: `${step.name} delay completed.`,
      createdByUserId: userId,
    });
    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
  }
}

/** Handles task step creation and optional wait-until-completed mode. */
async function processCreateTaskStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const config = (step.configJson ?? {}) as CreateTaskStepConfig;
  const completionMode = config.completionMode ?? "wait_until_task_completed";

  if (run.status === "PENDING") {
    const title = renderTemplate(config.titleTemplate ?? "Steward follow-up task", enrollment);
    const description = renderTemplate(config.descriptionTemplate ?? "", enrollment) || undefined;
    const dueDate = config.dueOffsetAmount && config.dueOffsetUnit
      ? addDuration(now, config.dueOffsetAmount, config.dueOffsetUnit)
      : null;

    const task = await prisma.task.create({
      data: {
        constituentId: enrollment.constituentId ?? undefined,
        createdById: userId,
        assigneeId: enrollment.ownerUserId ?? enrollment.path.defaultOwnerId ?? undefined,
        title,
        description,
        type: normalizeTaskType(config.taskType),
        priority: normalizeTaskPriority(config.priority),
        dueDate,
      },
    });

    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "TASK_CREATED",
      message: `Task created: ${task.title}`,
      createdByUserId: userId,
      metadataJson: { taskId: task.id, completionMode },
    });

    if (completionMode === "continue_immediately_after_task_created") {
      await prisma.stewardPathStepRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          startedAt: now,
          completedAt: now,
          resultJson: { taskId: task.id, completionMode },
        },
      });
      await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
      return;
    }

    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "RUNNING",
        startedAt: now,
        scheduledFor: addDuration(now, 30, "minutes"),
        resultJson: { taskId: task.id, completionMode },
      },
    });
    await prisma.stewardPathEnrollment.update({
      where: { id: enrollment.id },
      data: { nextStepDueAt: addDuration(now, 30, "minutes") },
    });
    return;
  }

  if (run.status !== "RUNNING") return;

  const resultJson = toRecord(run.resultJson);
  const taskId = typeof resultJson.taskId === "string" ? resultJson.taskId : null;
  if (!taskId) {
    throw new Error("Task step run is missing taskId");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task) {
    throw new Error("Task created by path step no longer exists");
  }

  if (task.status === "COMPLETED") {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_COMPLETED",
      message: `${step.name} completed after task completion.`,
      createdByUserId: userId,
      metadataJson: { taskId },
    });
    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
    return;
  }

  const nextPoll = addDuration(now, 30, "minutes");
  await prisma.stewardPathEnrollment.update({
    where: { id: enrollment.id },
    data: { nextStepDueAt: nextPoll },
  });
  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: { scheduledFor: nextPoll },
  });
}

/** Creates an email draft and optionally waits for review/sending. */
async function processDraftEmailStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const config = (step.configJson ?? {}) as DraftEmailStepConfig;

  if (run.status === "PENDING") {
    const subject = renderTemplate(config.subjectTemplate ?? "Follow-up from {{organizationName}}", enrollment);
    const body = renderTemplate(config.bodyTemplate ?? "Hello {{firstName}},", enrollment);
    const draft = await prisma.stewardPathEmailDraft.create({
      data: {
        enrollmentId: enrollment.id,
        stepId: step.id,
        constituentId: enrollment.constituentId ?? undefined,
        reviewerUserId: resolveReviewerId(config, enrollment),
        status: "DRAFT_CREATED",
        subject,
        body,
        fromMode: config.fromMode ?? "organization",
        replyToMode: config.replyToMode,
        requireApproval: config.requireApprovalBeforeSend ?? true,
        allowUserEdits: config.allowUserEdits ?? true,
      },
    });

    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "EMAIL_DRAFT_CREATED",
      message: `Draft email created for review: ${subject}`,
      createdByUserId: userId,
      metadataJson: { draftId: draft.id },
    });

    const waitForReview = config.waitForReview ?? (config.requireApprovalBeforeSend ?? true);
    if (!waitForReview) {
      await prisma.stewardPathStepRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          startedAt: now,
          completedAt: now,
          resultJson: { draftId: draft.id },
        },
      });
      await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
      return;
    }

    const nextPoll = addDuration(now, 30, "minutes");
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "RUNNING",
        startedAt: now,
        scheduledFor: nextPoll,
        resultJson: { draftId: draft.id },
      },
    });
    await prisma.stewardPathEnrollment.update({
      where: { id: enrollment.id },
      data: { nextStepDueAt: nextPoll },
    });
    return;
  }

  if (run.status !== "RUNNING") return;

  const draftId = typeof toRecord(run.resultJson).draftId === "string"
    ? String(toRecord(run.resultJson).draftId)
    : null;
  if (!draftId) {
    throw new Error("Draft email step run is missing draftId");
  }

  const draft = await prisma.stewardPathEmailDraft.findUnique({ where: { id: draftId } });
  if (!draft) {
    throw new Error("Draft email created by path step no longer exists");
  }

  if (draft.status === "SENT" || draft.status === "APPROVED" || draft.status === "SKIPPED") {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: { status: draft.status === "SKIPPED" ? "SKIPPED" : "COMPLETED", completedAt: now },
    });

    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: draft.status === "SKIPPED" ? "STEP_SKIPPED" : "STEP_COMPLETED",
      message: draft.status === "SKIPPED"
        ? `${step.name} was skipped during draft review.`
        : `${step.name} completed after draft review.`,
      createdByUserId: userId,
      metadataJson: { draftId: draft.id, draftStatus: draft.status },
    });

    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
    return;
  }

  if (draft.status === "FAILED") {
    throw new Error(draft.failureReason || "Draft email failed");
  }

  const nextPoll = addDuration(now, 30, "minutes");
  await prisma.stewardPathEnrollment.update({
    where: { id: enrollment.id },
    data: { nextStepDueAt: nextPoll },
  });
  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: { scheduledFor: nextPoll },
  });
}

/** Send-email steps are safety-first and currently route through draft creation. */
async function processSendEmailStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  await processDraftEmailStep(ctx, now, userId);
}

/** Manual action steps wait for human completion via endpoint. */
async function processManualActionStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const config = (step.configJson ?? {}) as ManualActionStepConfig;

  if (run.status === "PENDING") {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "RUNNING",
        startedAt: now,
        resultJson: { instruction: config.instruction ?? step.description ?? "Complete this manual action." },
      },
    });
    await prisma.stewardPathEnrollment.update({
      where: { id: enrollment.id },
      data: {
        nextStepDueAt: null,
      },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_STARTED",
      message: config.instruction?.trim()
        ? `Manual action started: ${config.instruction.trim()}`
        : `Manual action started: ${step.name}`,
      createdByUserId: userId,
    });
  }
}

/** Writes an internal note to timeline and constituent activity where applicable. */
async function processInternalNoteStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const cfg = toRecord(step.configJson);
  const noteTemplate = typeof cfg.noteTemplate === "string" ? cfg.noteTemplate : step.description || "Steward Path internal note";
  const note = renderTemplate(noteTemplate, enrollment);

  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      startedAt: now,
      completedAt: now,
      resultJson: { note },
    },
  });

  if (enrollment.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: enrollment.constituentId,
        type: "NOTE",
        userId,
        description: note,
        metadata: {
          source: "steward-paths",
          enrollmentId: enrollment.id,
          stepId: step.id,
          pathId: enrollment.path.id,
        },
      },
    });
  }

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: step.id,
    eventType: "STEP_COMPLETED",
    message: note,
    createdByUserId: userId,
  });

  await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
}

/**
 * Applies a status change to the enrolled constituent (Phase 5).
 *
 * Supported `configJson` fields:
 * - `targetField`: which constituent field to update.
 *   Allowed values: "donorStatus" | "engagementScore" | "doNotEmail"
 *   | "emailOptOut" | "doNotMail" | "doNotCall" | "doNotContact".
 * - `value`: new value for the field. For `donorStatus` must be one of the
 *   `DonorStatus` enum values (NEW, ACTIVE, LAPSED, MAJOR_DONOR, DECEASED).
 *   For `engagementScore` must be a number 0-100. For do-not-* / opt-out flags
 *   must be a boolean.
 *
 * The step is a no-op (logged + skipped) when the enrollment is not linked to
 * a constituent. Invalid configurations fail the step with a descriptive error
 * so the run history surfaces the problem instead of silently passing.
 */
async function processStatusChangeStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const cfg = toRecord(step.configJson);
  const targetField = typeof cfg.targetField === "string" ? cfg.targetField : "";
  const value = (cfg as Record<string, unknown>).value;

  if (!enrollment.constituentId) {
    await prisma.stewardPathStepRun.update({
      where: { id: run.id },
      data: {
        status: "SKIPPED",
        startedAt: now,
        completedAt: now,
        resultJson: { skippedReason: "no_constituent_link" },
      },
    });
    await createTimelineEvent({
      enrollmentId: enrollment.id,
      stepId: step.id,
      eventType: "STEP_SKIPPED",
      message: `${step.name} skipped: enrollment is not linked to a constituent.`,
      createdByUserId: userId,
    });
    await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
    return;
  }

  const updateData = buildStatusChangeUpdate(targetField, value);

  await prisma.constituent.update({
    where: { id: enrollment.constituentId },
    data: updateData,
  });

  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      startedAt: now,
      completedAt: now,
      resultJson: { targetField, value: value as Prisma.InputJsonValue ?? null },
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: enrollment.constituentId,
      type: "NOTE",
      userId,
      description: `Steward Path "${enrollment.path.name}" updated ${targetField} to ${String(value)}.`,
      metadata: {
        source: "steward-paths",
        kind: "status_change",
        enrollmentId: enrollment.id,
        stepId: step.id,
        pathId: enrollment.path.id,
        targetField,
        value: value as Prisma.InputJsonValue ?? null,
      },
    },
  });

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: step.id,
    eventType: "STEP_COMPLETED",
    message: `Updated ${targetField} → ${String(value)} on linked constituent.`,
    createdByUserId: userId,
    metadataJson: { targetField, value: value as Prisma.InputJsonValue ?? null },
  });

  await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
}

/**
 * Allowed targetField values for STATUS_CHANGE step. Listed explicitly so we
 * never write to an arbitrary column from configJson.
 */
const STATUS_CHANGE_ALLOWED_FIELDS = new Set([
  "donorStatus",
  "engagementScore",
  "doNotEmail",
  "emailOptOut",
  "doNotMail",
  "doNotCall",
  "doNotContact",
]);

const DONOR_STATUS_VALUES = new Set(["NEW", "ACTIVE", "LAPSED", "MAJOR_DONOR", "DECEASED"]);

/**
 * Builds a Prisma update payload for a STATUS_CHANGE step.
 *
 * Throws `Error` when the field is not in the allow-list or the value is the
 * wrong shape so the step run is recorded as FAILED with a useful message.
 */
export function buildStatusChangeUpdate(targetField: string, value: unknown): Prisma.ConstituentUpdateInput {
  if (!STATUS_CHANGE_ALLOWED_FIELDS.has(targetField)) {
    throw new Error(`STATUS_CHANGE step targetField "${targetField}" is not allowed.`);
  }

  if (targetField === "donorStatus") {
    if (typeof value !== "string" || !DONOR_STATUS_VALUES.has(value)) {
      throw new Error(`STATUS_CHANGE donorStatus value must be one of NEW/ACTIVE/LAPSED/MAJOR_DONOR/DECEASED (got ${String(value)}).`);
    }
    return { donorStatus: value as "NEW" | "ACTIVE" | "LAPSED" | "MAJOR_DONOR" | "DECEASED" };
  }

  if (targetField === "engagementScore") {
    let numeric: number;
    if (typeof value === "number") {
      numeric = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      numeric = Number(value);
    } else {
      throw new Error(`STATUS_CHANGE engagementScore must be a number 0-100 (got ${String(value)}).`);
    }
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      throw new Error(`STATUS_CHANGE engagementScore must be a number 0-100 (got ${String(value)}).`);
    }
    return { engagementScore: Math.round(numeric) };
  }

  // Boolean preference flags share the same shape.
  if (typeof value !== "boolean") {
    throw new Error(`STATUS_CHANGE ${targetField} must be a boolean (got ${String(value)}).`);
  }
  return { [targetField]: value } as Prisma.ConstituentUpdateInput;
}

/**
 * Branch step (Phase 5).
 *
 * The schema has no per-step "branch out-edge" column, so branching is
 * expressed as a `skipUntilOrderIndex` in `configJson`. The branch step
 * evaluates a condition against the enrollment context and:
 *
 * - On match: skips ahead by setting the next current step to the configured
 *   `whenTrueAdvanceToOrderIndex` (or simply continues if not set).
 * - On non-match: skips ahead to `whenFalseAdvanceToOrderIndex`, or if not
 *   set, simply continues to the next sequential step.
 *
 * Supported config:
 * - `condition`: { field, operator, value }
 *   - `field`: "lastGiftAmount" | "totalLifetimeGiving" | "engagementScore"
 *     | "donorStatus" | "doNotEmail" | "emailOptOut" | "doNotMail"
 *     | "doNotCall" | "doNotContact"
 *   - `operator`: see BranchOperator (eq, neq, gt, gte, lt, lte, in, not_in)
 *   - `value`: comparable scalar or array
 * - `whenTrueAdvanceToOrderIndex`: number | undefined
 * - `whenFalseAdvanceToOrderIndex`: number | undefined
 *
 * If the condition is missing or invalid the step fails so the path author
 * gets feedback in the run history.
 */
async function processBranchStep(ctx: EnrollmentContext, now: Date, userId?: string): Promise<void> {
  const { enrollment, run } = ctx;
  const step = enrollment.currentStep!;
  const cfg = toRecord(step.configJson);
  const conditionRaw = cfg.condition;
  if (!conditionRaw || typeof conditionRaw !== "object" || Array.isArray(conditionRaw)) {
    throw new Error("BRANCH step requires config.condition { field, operator, value }.");
  }
  const condition = conditionRaw as Record<string, unknown>;
  const field = typeof condition.field === "string" ? condition.field : "";
  const operator = typeof condition.operator === "string" ? (condition.operator as BranchOperator) : "eq";
  const compareValue = condition.value as number | string | Array<number | string>;

  const observed = readBranchableField(enrollment, field);
  const matched = evaluateBranchRule(observed as number | string | null | undefined, { operator, value: compareValue });

  await prisma.stewardPathStepRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      startedAt: now,
      completedAt: now,
      resultJson: { field, operator, compareValue: compareValue as Prisma.InputJsonValue, matched, observed: observed as Prisma.InputJsonValue ?? null },
    },
  });

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: step.id,
    eventType: "STEP_COMPLETED",
    message: matched
      ? `Branch matched on ${field} ${operator}. Following matched path.`
      : `Branch did not match on ${field} ${operator}. Following non-matched path.`,
    createdByUserId: userId,
    metadataJson: { matched, field, operator },
  });

  const targetOrderIndex = matched
    ? coerceOrderIndex(cfg.whenTrueAdvanceToOrderIndex)
    : coerceOrderIndex(cfg.whenFalseAdvanceToOrderIndex);

  await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId, targetOrderIndex);
}

/**
 * Reads a comparable scalar from the enrollment context for branching.
 *
 * Returns `null` when the field is not branchable in this context (no
 * constituent linked, unknown field name, or missing data). Callers must not
 * substitute a default — `evaluateBranchRule` handles `null`/`undefined`
 * inputs explicitly so missing data evaluates to "no match" rather than a
 * silent false positive.
 *
 * String fields (donorStatus) are compared case-insensitively by
 * `evaluateBranchRule` for the `eq`, `neq`, `in`, `not_in` operators.
 */
function readBranchableField(
  enrollment: EnrollmentContext["enrollment"],
  field: string,
): number | string | null {
  const c = enrollment.constituent;
  if (!c) return null;
  switch (field) {
    case "lastGiftAmount":
      return numberOrNull(c.lastGiftAmount);
    case "totalLifetimeGiving":
      return numberOrNull(c.totalLifetimeGiving);
    case "engagementScore":
      return typeof c.engagementScore === "number" ? c.engagementScore : null;
    case "donorStatus":
      return typeof c.donorStatus === "string" ? c.donorStatus : null;
    // Boolean preference flags are surfaced as the string "true"/"false" so
    // they work with the shared `evaluateBranchRule` operator set, which is
    // typed `number | string` (no native boolean operand). Authors who branch
    // on these fields write `value: "true"` or `value: "false"` in configJson.
    case "doNotEmail":
      return c.doNotEmail ? "true" : "false";
    case "emailOptOut":
      return c.emailOptOut ? "true" : "false";
    case "doNotMail":
      return c.doNotMail ? "true" : "false";
    case "doNotCall":
      return c.doNotCall ? "true" : "false";
    case "doNotContact":
      return c.doNotContact ? "true" : "false";
    default:
      return null;
  }
}

function coerceOrderIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return undefined;
}

/**
 * Coerces a value to a finite number or returns null.
 *
 * Handles the Prisma `Decimal` and `BigInt` types that may appear on monetary
 * fields like `lastGiftAmount` / `totalLifetimeGiving` — both expose a usable
 * `toString()`. Returns null for anything that does not yield a finite number.
 */
function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Moves enrollment to the next active step or marks enrollment completed.
 *
 * When `targetOrderIndex` is provided (used by branch steps), advancement
 * jumps to the first active step with an `orderIndex` >= the target, instead
 * of continuing strictly to the next sequential step. If the target is past
 * the end of the path, the enrollment is marked completed.
 */
async function advanceEnrollment(
  enrollmentId: string,
  pathId: string,
  currentStepId: string,
  userId?: string,
  targetOrderIndex?: number,
): Promise<void> {
  const now = new Date();
  const steps = await prisma.stewardPathStep.findMany({
    where: { pathId, isActive: true },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, orderIndex: true },
  });

  let nextStep: { id: string; name: string; orderIndex: number } | null = null;
  if (typeof targetOrderIndex === "number") {
    nextStep = steps.find((step) => step.orderIndex >= targetOrderIndex && step.id !== currentStepId) ?? null;
  } else {
    const currentIdx = steps.findIndex((step) => step.id === currentStepId);
    nextStep = currentIdx >= 0 ? steps[currentIdx + 1] ?? null : null;
  }

  if (!nextStep) {
    await prisma.stewardPathEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "COMPLETED",
        currentStepId: null,
        nextStepDueAt: null,
        lastStepCompletedAt: now,
        completedAt: now,
      },
    });
    await createTimelineEvent({
      enrollmentId,
      stepId: currentStepId,
      eventType: "PATH_COMPLETED",
      message: "Steward Path completed successfully.",
      createdByUserId: userId,
    });
    return;
  }

  await prisma.stewardPathEnrollment.update({
    where: { id: enrollmentId },
    data: {
      currentStepId: nextStep.id,
      nextStepDueAt: now,
      lastStepCompletedAt: now,
    },
  });

  await createTimelineEvent({
    enrollmentId,
    stepId: nextStep.id,
    eventType: "STEP_SCHEDULED",
    message: `Next step queued: ${nextStep.name}`,
    createdByUserId: userId,
  });
}

/** Marks enrollment and current step run as failed with timeline entry. */
async function markEnrollmentFailed(
  enrollmentId: string,
  stepId: string,
  runId: string,
  message: string,
  userId?: string,
): Promise<void> {
  await prisma.stewardPathStepRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      errorMessage: message,
    },
  });

  await prisma.stewardPathEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "FAILED",
      nextStepDueAt: null,
    },
  });

  await createTimelineEvent({
    enrollmentId,
    stepId,
    eventType: "PATH_FAILED",
    message: `Step failed: ${message}`,
    createdByUserId: userId,
  });
}

/** Creates one timeline event row for enrollment auditability. */
export async function createTimelineEvent(args: {
  enrollmentId: string;
  stepId?: string;
  eventType: StewardPathTimelineEventType;
  message: string;
  createdByUserId?: string;
  metadataJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.stewardPathTimelineEvent.create({
    data: {
      enrollmentId: args.enrollmentId,
      stepId: args.stepId,
      eventType: args.eventType,
      message: args.message,
      createdByUserId: args.createdByUserId,
      metadataJson: args.metadataJson,
    },
  });
}

/** Adds duration to a date for schedule calculations. */
function addDuration(date: Date, amount: number, unit: "minutes" | "hours" | "days" | "weeks" | "months"): Date {
  const next = new Date(date);
  if (unit === "minutes") next.setMinutes(next.getMinutes() + amount);
  if (unit === "hours") next.setHours(next.getHours() + amount);
  if (unit === "days") next.setDate(next.getDate() + amount);
  if (unit === "weeks") next.setDate(next.getDate() + amount * 7);
  if (unit === "months") next.setMonth(next.getMonth() + amount);
  return next;
}

/** Renders lightweight merge fields using enrollment/constituent context. */
function renderTemplate(template: string, enrollment: EnrollmentContext["enrollment"]): string {
  const c = enrollment.constituent;
  const map: Record<string, string> = {
    firstName: c?.firstName ?? "Friend",
    lastName: c?.lastName ?? "",
    organizationName: "OyamaCRM",
    lastGiftAmount: numberString(c?.lastGiftAmount),
    lastGiftDate: c?.lastGiftDate ? c.lastGiftDate.toISOString().split("T")[0] : "",
    assignedStaffName: enrollment.ownerUserId ?? "",
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_full, key: string) => map[key] ?? "").trim();
}

/** Resolves reviewer assignment for draft email steps. */
function resolveReviewerId(config: DraftEmailStepConfig, enrollment: EnrollmentContext["enrollment"]): string | undefined {
  if (config.assignedReviewerMode === "specific_user" && config.assignedReviewerId) return config.assignedReviewerId;
  if (config.assignedReviewerMode === "record_owner") return enrollment.ownerUserId ?? undefined;
  if (config.assignedReviewerMode === "path_owner") return enrollment.path.defaultOwnerId ?? enrollment.ownerUserId ?? undefined;
  return enrollment.ownerUserId ?? enrollment.path.defaultOwnerId ?? undefined;
}

/** Normalizes task type to known enum value. */
function normalizeTaskType(value?: string): "CALL" | "EMAIL" | "MAIL" | "MEETING" | "THANK_YOU" | "FOLLOW_UP" | "OTHER" {
  const allowed = ["CALL", "EMAIL", "MAIL", "MEETING", "THANK_YOU", "FOLLOW_UP", "OTHER"] as const;
  const normalized = (value ?? "FOLLOW_UP").toUpperCase();
  return (allowed as readonly string[]).includes(normalized) ? (normalized as (typeof allowed)[number]) : "FOLLOW_UP";
}

/** Normalizes task priority to known enum value. */
function normalizeTaskPriority(value?: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const allowed = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const normalized = (value ?? "MEDIUM").toUpperCase();
  return (allowed as readonly string[]).includes(normalized) ? (normalized as (typeof allowed)[number]) : "MEDIUM";
}

/** Converts nullable Prisma JSON object to plain record. */
function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Converts decimal-like value to printable numeric string. */
function numberString(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  if (value && typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
    return String((value as { toString(): string }).toString());
  }
  return "";
}

/** Returns the next poll timestamp for waiting steps. */
export function nextStepPollAt(from: Date = new Date()): Date {
  return addDuration(from, 30, "minutes");
}

/** Utility for manual status actions. */
export function normalizeEnrollmentStatusInput(value: string): StewardPathEnrollmentStatus | null {
  const normalized = value.trim().toUpperCase();
  const allowed: StewardPathEnrollmentStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"];
  return allowed.includes(normalized as StewardPathEnrollmentStatus)
    ? (normalized as StewardPathEnrollmentStatus)
    : null;
}

/** Utility for manual step run status updates. */
export function normalizeStepRunStatusInput(value: string): StewardPathStepRunStatus | null {
  const normalized = value.trim().toUpperCase();
  const allowed: StewardPathStepRunStatus[] = ["PENDING", "SCHEDULED", "RUNNING", "COMPLETED", "SKIPPED", "FAILED"];
  return allowed.includes(normalized as StewardPathStepRunStatus)
    ? (normalized as StewardPathStepRunStatus)
    : null;
}
