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
    case "BRANCH_PLACEHOLDER":
      await prisma.stewardPathStepRun.update({
        where: { id: run.id },
        data: { status: "SKIPPED", completedAt: now },
      });
      await createTimelineEvent({
        enrollmentId: enrollment.id,
        stepId: step.id,
        eventType: "STEP_SKIPPED",
        message: `${step.name} is a placeholder and was skipped.`,
        createdByUserId: userId,
      });
      await advanceEnrollment(enrollment.id, enrollment.path.id, step.id, userId);
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

/** Moves enrollment to next active step or marks enrollment completed. */
async function advanceEnrollment(enrollmentId: string, pathId: string, currentStepId: string, userId?: string): Promise<void> {
  const now = new Date();
  const steps = await prisma.stewardPathStep.findMany({
    where: { pathId, isActive: true },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true },
  });

  const currentIdx = steps.findIndex((step) => step.id === currentStepId);
  const nextStep = currentIdx >= 0 ? steps[currentIdx + 1] : null;

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
