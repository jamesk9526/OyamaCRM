import { prisma } from "../lib/prisma.js";

interface EnrollmentServiceInput {
  organizationId: string;
  constituentId: string;
  pathId: string;
  actorUserId?: string;
  source: string;
  replaceExisting?: boolean;
}

interface TriggerEnrollmentInput {
  organizationId: string;
  constituentId: string;
  triggerTypes: string[];
  actorUserId?: string;
  source: string;
}

/** Starts one active Path enrollment and records a durable constituent-facing audit trail. */
export async function enrollConstituentInStewardPath(input: EnrollmentServiceInput) {
  const path = await prisma.stewardPath.findFirst({
    where: { id: input.pathId, organizationId: input.organizationId, status: "ACTIVE" },
    include: { steps: { where: { isActive: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!path) throw new Error("Active Steward Path not found.");
  if (path.steps.length === 0) throw new Error("A Steward Path needs at least one active step before enrollment.");

  const constituent = await prisma.constituent.findFirst({
    where: { id: input.constituentId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!constituent) throw new Error("Constituent not found in this organization.");

  const existing = await prisma.stewardPathEnrollment.findFirst({
    where: {
      organizationId: input.organizationId,
      pathId: path.id,
      constituentId: constituent.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    include: { currentStep: { select: { id: true, name: true, orderIndex: true } } },
  });
  if (existing) return { enrollment: existing, reused: true, replacedCount: 0 };

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    let replacedCount = 0;
    if (input.replaceExisting) {
      const replaced = await tx.stewardPathEnrollment.updateMany({
        where: {
          organizationId: input.organizationId,
          constituentId: constituent.id,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        data: {
          status: "CANCELLED",
          currentStepId: null,
          nextStepDueAt: null,
          completedAt: now,
        },
      });
      replacedCount = replaced.count;
    }

    const enrollment = await tx.stewardPathEnrollment.create({
      data: {
        organizationId: input.organizationId,
        pathId: path.id,
        targetType: path.targetType,
        targetId: constituent.id,
        constituentId: constituent.id,
        ownerUserId: path.defaultOwnerId ?? input.actorUserId ?? null,
        currentStepId: path.steps[0].id,
        nextStepDueAt: now,
        status: "ACTIVE",
      },
      include: { currentStep: { select: { id: true, name: true, orderIndex: true } } },
    });

    await tx.stewardPathTimelineEvent.create({
      data: {
        enrollmentId: enrollment.id,
        stepId: enrollment.currentStepId,
        eventType: "PATH_STARTED",
        message: `Enrollment started for ${path.name}.`,
        createdByUserId: input.actorUserId,
        metadataJson: { source: input.source, replacedCount },
      },
    });
    await tx.activity.create({
      data: {
        constituentId: constituent.id,
        userId: input.actorUserId,
        type: "NOTE",
        description: `Enrolled in Steward Path: ${path.name}`,
        metadata: { source: input.source, pathId: path.id, enrollmentId: enrollment.id, replacedCount },
      },
    });

    return { enrollment, reused: false, replacedCount };
  });

  return result;
}

/** Enrolls a new constituent into every matching modern active Path exactly once. */
export async function enrollConstituentInTriggeredStewardPaths(input: TriggerEnrollmentInput) {
  const triggerTypes = Array.from(new Set(input.triggerTypes.map((trigger) => trigger.trim().toUpperCase()).filter(Boolean)));
  if (triggerTypes.length === 0) return { enrolledCount: 0, reusedCount: 0, enrollmentIds: [] as string[] };

  const paths = await prisma.stewardPath.findMany({
    where: { organizationId: input.organizationId, status: "ACTIVE", triggerType: { in: triggerTypes } },
    select: { id: true },
  });

  const results = await Promise.all(paths.map((path) => enrollConstituentInStewardPath({
    organizationId: input.organizationId,
    constituentId: input.constituentId,
    pathId: path.id,
    actorUserId: input.actorUserId,
    source: input.source,
  })));

  return {
    enrolledCount: results.filter((result) => !result.reused).length,
    reusedCount: results.filter((result) => result.reused).length,
    enrollmentIds: results.map((result) => result.enrollment.id),
  };
}