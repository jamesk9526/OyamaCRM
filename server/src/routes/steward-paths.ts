/**
 * Steward Paths engagement sequence API.
 * Manages path templates, ordered steps, enrollments, timeline, drafts, and due-step processing.
 */
import { Prisma, type StewardPathCrmScope, type StewardPathEmailDraftStatus, type StewardPathEnrollmentStatus, type StewardPathStatus, type StewardPathStepType, type StewardPathTarget, type StewardPathTimelineEventType } from "@prisma/client";
import { Router, type Request } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { completeCurrentManualStep, createTimelineEvent, processDueStewardPathEnrollments } from "../services/steward-paths-sequence-engine.js";

const router = Router();

const PATH_STATUS_VALUES: StewardPathStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];
const CRM_SCOPE_VALUES: StewardPathCrmScope[] = ["DONOR", "COMPASSION", "EVENTS", "HRM", "GLOBAL"];
const TARGET_VALUES: StewardPathTarget[] = ["CONSTITUENT", "DONOR", "CLIENT", "EVENT_ATTENDEE", "SPONSOR", "GRANT", "STAFF", "CUSTOM"];
const STEP_TYPE_VALUES: StewardPathStepType[] = [
  "DELAY",
  "CREATE_TASK",
  "DRAFT_EMAIL",
  "SEND_EMAIL",
  "MANUAL_ACTION",
  "INTERNAL_NOTE",
  "STATUS_CHANGE",
  "BRANCH_PLACEHOLDER",
];
const ENROLLMENT_STATUS_VALUES: StewardPathEnrollmentStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"];
const EMAIL_DRAFT_STATUS_VALUES: StewardPathEmailDraftStatus[] = ["DRAFT_CREATED", "EDITED", "APPROVED", "SENT", "SKIPPED", "FAILED"];

router.use(requireAuth);

/** Validates that the request has an organization context. */
async function requireOrganizationId(req: Request): Promise<string | null> {
  const organizationId = await resolveOrganizationId({ req });
  return organizationId || null;
}

/** Normalizes Express route id params into one string value. */
function getRouteParam(req: Request, key: string): string {
  const raw = req.params?.[key];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/** Returns the normalized id route param value. */
function getRouteId(req: Request): string {
  return getRouteParam(req, "id");
}

/** Parses and validates an enum-like request string. */
function parseEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

/** Returns a positive integer from query/body with bounds. */
function parsePositiveInt(value: unknown, fallback: number, min = 1, max = 500): number {
  const num = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

/** Converts unknown JSON payload to a plain object for Prisma JSON fields. */
function asJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Prisma.InputJsonValue;
}

/** Returns true when a timeline event type corresponds to pause/resume semantics. */
function eventForEnrollmentStatus(status: StewardPathEnrollmentStatus): StewardPathTimelineEventType {
  if (status === "PAUSED") return "PATH_PAUSED";
  if (status === "ACTIVE") return "PATH_RESUMED";
  if (status === "CANCELLED") return "PATH_FAILED";
  if (status === "FAILED") return "PATH_FAILED";
  return "PATH_COMPLETED";
}

/** GET /api/steward-paths/templates — list sequence templates for the org. */
router.get("/templates", requirePermission("steward_paths.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context available." } });
    return;
  }

  const statusFilter = parseEnumValue(req.query.status, PATH_STATUS_VALUES);
  const crmScopeFilter = parseEnumValue(req.query.crmScope, CRM_SCOPE_VALUES);
  const targetFilter = parseEnumValue(req.query.targetType, TARGET_VALUES);

  const items = await prisma.stewardPath.findMany({
    where: {
      organizationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(crmScopeFilter ? { crmScope: crmScopeFilter } : {}),
      ...(targetFilter ? { targetType: targetFilter } : {}),
    },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json(items);
});

/** GET /api/steward-paths/templates/:id — load one template with full step detail. */
router.get("/templates/:id", requirePermission("steward_paths.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context available." } });
    return;
  }

  const path = await prisma.stewardPath.findFirst({
    where: { id: getRouteId(req), organizationId },
    include: {
      steps: { orderBy: { orderIndex: "asc" } },
      enrollments: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { startedAt: "desc" },
        take: 15,
      },
    },
  });

  if (!path) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  res.json(path);
});

/** POST /api/steward-paths/templates — create a new template shell. */
router.post("/templates", requirePermission("steward_paths.create"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: { code: "NAME_REQUIRED", message: "Path name is required." } });
    return;
  }

  const targetType = parseEnumValue(req.body?.targetType, TARGET_VALUES);
  if (!targetType) {
    res.status(400).json({ error: { code: "INVALID_TARGET_TYPE", message: "Invalid targetType value." } });
    return;
  }

  const crmScope = parseEnumValue(req.body?.crmScope, CRM_SCOPE_VALUES) ?? "DONOR";
  const status = parseEnumValue(req.body?.status, PATH_STATUS_VALUES) ?? "DRAFT";

  const path = await prisma.stewardPath.create({
    data: {
      organizationId,
      name,
      description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
      crmScope,
      targetType,
      triggerType: typeof req.body?.triggerType === "string" ? req.body.triggerType.trim().toUpperCase() : "MANUAL",
      triggerConfig: asJsonObject(req.body?.triggerConfig),
      status,
      defaultOwnerId: typeof req.body?.defaultOwnerId === "string" ? req.body.defaultOwnerId : null,
      createdByUserId: userId,
      lastEditedByUserId: userId,
    },
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });

  await logAudit({
    action: "STEWARD_PATH_TEMPLATE_CREATED",
    entity: "StewardPath",
    entityId: path.id,
    userId,
    organizationId,
    metadata: {
      name: path.name,
      targetType: path.targetType,
      crmScope: path.crmScope,
      status: path.status,
    },
  });

  res.status(201).json(path);
});

/** PATCH /api/steward-paths/templates/:id — update path metadata/status. */
router.patch("/templates/:id", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const existing = await prisma.stewardPath.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  const updateData: Prisma.StewardPathUpdateInput = {
    lastEditedBy: { connect: { id: userId } },
  };

  if (typeof req.body?.name === "string") {
    const trimmed = req.body.name.trim();
    if (!trimmed) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Path name cannot be empty." } });
      return;
    }
    updateData.name = trimmed;
  }
  if (typeof req.body?.description === "string") {
    updateData.description = req.body.description.trim() || null;
  }
  const targetType = parseEnumValue(req.body?.targetType, TARGET_VALUES);
  if (req.body?.targetType !== undefined && !targetType) {
    res.status(400).json({ error: { code: "INVALID_TARGET_TYPE", message: "Invalid targetType value." } });
    return;
  }
  if (targetType) updateData.targetType = targetType;

  const crmScope = parseEnumValue(req.body?.crmScope, CRM_SCOPE_VALUES);
  if (req.body?.crmScope !== undefined && !crmScope) {
    res.status(400).json({ error: { code: "INVALID_CRM_SCOPE", message: "Invalid crmScope value." } });
    return;
  }
  if (crmScope) updateData.crmScope = crmScope;

  const status = parseEnumValue(req.body?.status, PATH_STATUS_VALUES);
  if (req.body?.status !== undefined && !status) {
    res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid status value." } });
    return;
  }
  if (status) updateData.status = status;

  if (typeof req.body?.triggerType === "string") updateData.triggerType = req.body.triggerType.trim().toUpperCase();
  if (req.body?.triggerConfig !== undefined) updateData.triggerConfig = asJsonObject(req.body?.triggerConfig) ?? Prisma.JsonNull;
  if (req.body?.defaultOwnerId !== undefined) {
    updateData.defaultOwner = typeof req.body.defaultOwnerId === "string" && req.body.defaultOwnerId
      ? { connect: { id: req.body.defaultOwnerId } }
      : { disconnect: true };
  }

  const updated = await prisma.stewardPath.update({
    where: { id: existing.id },
    data: updateData,
    include: { steps: { orderBy: { orderIndex: "asc" } } },
  });

  await logAudit({
    action: "STEWARD_PATH_TEMPLATE_UPDATED",
    entity: "StewardPath",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      previousStatus: existing.status,
      newStatus: updated.status,
      previousName: existing.name,
      newName: updated.name,
    },
  });

  res.json(updated);
});

/** DELETE /api/steward-paths/templates/:id — archive one template (soft-delete policy). */
router.delete("/templates/:id", requirePermission("steward_paths.archive"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const existing = await prisma.stewardPath.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  const archived = await prisma.stewardPath.update({
    where: { id: existing.id },
    data: {
      status: "ARCHIVED",
      lastEditedByUserId: userId,
    },
  });

  await logAudit({
    action: "STEWARD_PATH_TEMPLATE_ARCHIVED",
    entity: "StewardPath",
    entityId: archived.id,
    userId,
    organizationId,
    metadata: { previousStatus: existing.status },
  });

  res.status(204).send();
});

/** POST /api/steward-paths/templates/:id/steps — append or insert one step. */
router.post("/templates/:id/steps", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const path = await prisma.stewardPath.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!path) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const stepType = parseEnumValue(req.body?.stepType, STEP_TYPE_VALUES);
  if (!name || !stepType) {
    res.status(400).json({ error: { code: "INVALID_STEP", message: "Step name and valid stepType are required." } });
    return;
  }

  const steps = await prisma.stewardPathStep.findMany({
    where: { pathId: path.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, orderIndex: true },
  });
  const requestedOrder = parsePositiveInt(req.body?.orderIndex, steps.length, 0, steps.length);

  const created = await prisma.$transaction(async (tx) => {
    for (const step of steps.filter((item) => item.orderIndex >= requestedOrder)) {
      await tx.stewardPathStep.update({
        where: { id: step.id },
        data: { orderIndex: step.orderIndex + 1 },
      });
    }

    return tx.stewardPathStep.create({
      data: {
        pathId: path.id,
        orderIndex: requestedOrder,
        name,
        description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
        stepType,
        configJson: asJsonObject(req.body?.configJson),
        isRequired: req.body?.isRequired !== false,
        isActive: req.body?.isActive !== false,
      },
    });
  });

  await prisma.stewardPath.update({ where: { id: path.id }, data: { lastEditedByUserId: userId } });

  await logAudit({
    action: "STEWARD_PATH_STEP_CREATED",
    entity: "StewardPathStep",
    entityId: created.id,
    userId,
    organizationId,
    metadata: {
      pathId: path.id,
      stepType: created.stepType,
      orderIndex: created.orderIndex,
    },
  });

  res.status(201).json(created);
});

/** PATCH /api/steward-paths/templates/:id/steps/:stepId — update one step. */
router.patch("/templates/:id/steps/:stepId", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const path = await prisma.stewardPath.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!path) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  const step = await prisma.stewardPathStep.findFirst({ where: { id: getRouteParam(req, "stepId"), pathId: path.id } });
  if (!step) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path step not found." } });
    return;
  }

  const updateData: Prisma.StewardPathStepUpdateInput = {};

  if (typeof req.body?.name === "string") {
    const trimmed = req.body.name.trim();
    if (!trimmed) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Step name cannot be empty." } });
      return;
    }
    updateData.name = trimmed;
  }
  if (typeof req.body?.description === "string") updateData.description = req.body.description.trim() || null;

  const stepType = parseEnumValue(req.body?.stepType, STEP_TYPE_VALUES);
  if (req.body?.stepType !== undefined && !stepType) {
    res.status(400).json({ error: { code: "INVALID_STEP_TYPE", message: "Invalid stepType value." } });
    return;
  }
  if (stepType) updateData.stepType = stepType;

  if (req.body?.configJson !== undefined) updateData.configJson = asJsonObject(req.body.configJson) ?? Prisma.JsonNull;
  if (typeof req.body?.isRequired === "boolean") updateData.isRequired = req.body.isRequired;
  if (typeof req.body?.isActive === "boolean") updateData.isActive = req.body.isActive;

  const updated = await prisma.stewardPathStep.update({
    where: { id: step.id },
    data: updateData,
  });

  await prisma.stewardPath.update({ where: { id: path.id }, data: { lastEditedByUserId: userId } });

  await logAudit({
    action: "STEWARD_PATH_STEP_UPDATED",
    entity: "StewardPathStep",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      pathId: path.id,
      previousStepType: step.stepType,
      newStepType: updated.stepType,
      previousName: step.name,
      newName: updated.name,
    },
  });

  res.json(updated);
});

/** POST /api/steward-paths/templates/:id/steps/reorder — reorder steps by provided array. */
router.post("/templates/:id/steps/reorder", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const path = await prisma.stewardPath.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!path) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found." } });
    return;
  }

  const stepIds = Array.isArray(req.body?.stepIds)
    ? req.body.stepIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (stepIds.length === 0) {
    res.status(400).json({ error: { code: "INVALID_STEPS", message: "stepIds[] is required." } });
    return;
  }

  const existing = await prisma.stewardPathStep.findMany({
    where: { pathId: path.id },
    select: { id: true },
    orderBy: { orderIndex: "asc" },
  });

  const existingIds = new Set(existing.map((s) => s.id));
  const orderedUnique = Array.from(new Set<string>(stepIds));
  if (orderedUnique.some((id) => !existingIds.has(id)) || orderedUnique.length !== existing.length) {
    res.status(400).json({ error: { code: "INVALID_STEPS", message: "stepIds must include every step exactly once." } });
    return;
  }

  await prisma.$transaction(
    orderedUnique.map((id, idx) =>
      prisma.stewardPathStep.update({
        where: { id },
        data: { orderIndex: idx },
      }),
    ),
  );

  await prisma.stewardPath.update({ where: { id: path.id }, data: { lastEditedByUserId: userId } });

  const steps = await prisma.stewardPathStep.findMany({ where: { pathId: path.id }, orderBy: { orderIndex: "asc" } });

  await logAudit({
    action: "STEWARD_PATH_STEPS_REORDERED",
    entity: "StewardPath",
    entityId: path.id,
    userId,
    organizationId,
    metadata: { stepIds: orderedUnique },
  });

  res.json({ steps });
});

/** DELETE /api/steward-paths/templates/:id/steps/:stepId — soft-delete one step. */
router.delete("/templates/:id/steps/:stepId", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const step = await prisma.stewardPathStep.findFirst({
    where: {
      id: getRouteParam(req, "stepId"),
      pathId: getRouteId(req),
      path: { organizationId },
    },
  });

  if (!step) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path step not found." } });
    return;
  }

  await prisma.stewardPathStep.update({
    where: { id: step.id },
    data: { isActive: false },
  });

  await prisma.stewardPath.update({ where: { id: getRouteId(req) }, data: { lastEditedByUserId: userId } });

  await logAudit({
    action: "STEWARD_PATH_STEP_ARCHIVED",
    entity: "StewardPathStep",
    entityId: step.id,
    userId,
    organizationId,
    metadata: { pathId: getRouteId(req) },
  });

  res.status(204).send();
});

/** GET /api/steward-paths/enrollments — list enrollments with path and current step context. */
router.get("/enrollments", requirePermission("steward_paths.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context available." } });
    return;
  }

  const status = parseEnumValue(req.query.status, ENROLLMENT_STATUS_VALUES);
  const limit = parsePositiveInt(req.query.limit, 100, 1, 300);
  const items = await prisma.stewardPathEnrollment.findMany({
    where: {
      organizationId,
      ...(typeof req.query.pathId === "string" ? { pathId: req.query.pathId } : {}),
      ...(status ? { status } : {}),
      ...(typeof req.query.constituentId === "string" ? { constituentId: req.query.constituentId } : {}),
    },
    include: {
      path: { select: { id: true, name: true, status: true, crmScope: true } },
      currentStep: { select: { id: true, name: true, stepType: true, orderIndex: true } },
      ownerUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  res.json(items);
});

/** POST /api/steward-paths/templates/:id/enrollments — manually enroll a target into a path. */
router.post("/templates/:id/enrollments", requirePermission("steward_paths.enroll"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const path = await prisma.stewardPath.findFirst({
    where: {
      id: getRouteId(req),
      organizationId,
      status: { in: ["ACTIVE", "DRAFT", "PAUSED"] },
    },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!path) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Steward Path template not found or not eligible for enrollments." } });
    return;
  }

  if (path.steps.length === 0) {
    res.status(400).json({ error: { code: "NO_STEPS", message: "Cannot enroll into a path without active steps." } });
    return;
  }

  const targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
  if (!targetId) {
    res.status(400).json({ error: { code: "TARGET_REQUIRED", message: "targetId is required." } });
    return;
  }

  const targetType = parseEnumValue(req.body?.targetType, TARGET_VALUES) ?? path.targetType;
  const ownerUserId = typeof req.body?.ownerUserId === "string" ? req.body.ownerUserId : path.defaultOwnerId;

  const enrollment = await prisma.stewardPathEnrollment.create({
    data: {
      organizationId,
      pathId: path.id,
      targetType,
      targetId,
      constituentId: typeof req.body?.constituentId === "string" ? req.body.constituentId : null,
      ownerUserId: ownerUserId ?? null,
      currentStepId: path.steps[0]?.id ?? null,
      nextStepDueAt: req.body?.startAt
        ? new Date(String(req.body.startAt))
        : new Date(),
      status: "ACTIVE",
    },
    include: {
      path: { select: { id: true, name: true, status: true } },
      currentStep: { select: { id: true, name: true, stepType: true, orderIndex: true } },
    },
  });

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: enrollment.currentStepId ?? undefined,
    eventType: "PATH_STARTED",
    message: `Enrollment started for path: ${path.name}`,
    createdByUserId: userId,
    metadataJson: {
      targetType,
      targetId,
      source: "manual-enrollment",
    },
  });

  await logAudit({
    action: "STEWARD_PATH_ENROLLMENT_CREATED",
    entity: "StewardPathEnrollment",
    entityId: enrollment.id,
    userId,
    organizationId,
    metadata: {
      pathId: path.id,
      targetType,
      targetId,
      currentStepId: enrollment.currentStepId,
    },
  });

  res.status(201).json(enrollment);
});

/** PATCH /api/steward-paths/enrollments/:id/status — pause/resume/cancel an enrollment. */
router.patch("/enrollments/:id/status", requirePermission("steward_paths.pause"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const enrollment = await prisma.stewardPathEnrollment.findFirst({
    where: { id: getRouteId(req), organizationId },
    include: { path: { select: { id: true, name: true } } },
  });

  if (!enrollment) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Enrollment not found." } });
    return;
  }

  const status = parseEnumValue(req.body?.status, ENROLLMENT_STATUS_VALUES);
  if (!status) {
    res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid enrollment status." } });
    return;
  }

  const now = new Date();
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;

  const updated = await prisma.stewardPathEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status,
      pausedAt: status === "PAUSED" ? now : null,
      pausedReason: status === "PAUSED" ? reason ?? null : null,
      nextStepDueAt: status === "ACTIVE"
        ? (enrollment.currentStepId ? now : null)
        : status === "PAUSED"
          ? null
          : enrollment.nextStepDueAt,
      completedAt: status === "COMPLETED" || status === "CANCELLED" ? now : enrollment.completedAt,
      currentStepId: status === "CANCELLED" ? null : enrollment.currentStepId,
    },
  });

  await createTimelineEvent({
    enrollmentId: enrollment.id,
    stepId: enrollment.currentStepId ?? undefined,
    eventType: eventForEnrollmentStatus(status),
    message: reason
      ? `Enrollment status changed to ${status}: ${reason}`
      : `Enrollment status changed to ${status}`,
    createdByUserId: userId,
    metadataJson: { previousStatus: enrollment.status, newStatus: status, reason },
  });

  await logAudit({
    action: "STEWARD_PATH_ENROLLMENT_STATUS_CHANGED",
    entity: "StewardPathEnrollment",
    entityId: enrollment.id,
    userId,
    organizationId,
    metadata: {
      pathId: enrollment.pathId,
      previousStatus: enrollment.status,
      newStatus: status,
      reason,
    },
  });

  res.json(updated);
});

/** POST /api/steward-paths/enrollments/:id/complete-current-step — manually complete current manual-action step. */
router.post("/enrollments/:id/complete-current-step", requirePermission("steward_paths.enroll"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const enrollment = await prisma.stewardPathEnrollment.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!enrollment) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Enrollment not found." } });
    return;
  }

  const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
  const completed = await completeCurrentManualStep(enrollment.id, userId, note);
  if (!completed) {
    res.status(400).json({ error: { code: "NOT_MANUAL_ACTION", message: "Current step is not a manual action step." } });
    return;
  }

  await logAudit({
    action: "STEWARD_PATH_MANUAL_STEP_COMPLETED",
    entity: "StewardPathEnrollment",
    entityId: enrollment.id,
    userId,
    organizationId,
    metadata: { note },
  });

  const refreshed = await prisma.stewardPathEnrollment.findUnique({
    where: { id: enrollment.id },
    include: {
      currentStep: { select: { id: true, name: true, stepType: true, orderIndex: true } },
      path: { select: { id: true, name: true } },
    },
  });

  res.json(refreshed);
});

/** GET /api/steward-paths/enrollments/:id/timeline — list timeline events oldest to newest. */
router.get("/enrollments/:id/timeline", requirePermission("steward_paths.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context available." } });
    return;
  }

  const enrollment = await prisma.stewardPathEnrollment.findFirst({ where: { id: getRouteId(req), organizationId }, select: { id: true } });
  if (!enrollment) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Enrollment not found." } });
    return;
  }

  const events = await prisma.stewardPathTimelineEvent.findMany({
    where: { enrollmentId: enrollment.id },
    include: {
      step: { select: { id: true, name: true, orderIndex: true, stepType: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(events);
});

/** GET /api/steward-paths/email-drafts — list pending/active drafts for review. */
router.get("/email-drafts", requirePermission("steward_paths.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context available." } });
    return;
  }

  const limit = parsePositiveInt(req.query.limit, 100, 1, 300);
  const status = parseEnumValue(req.query.status, EMAIL_DRAFT_STATUS_VALUES);
  const mineOnly = String(req.query.mine ?? "").toLowerCase() === "true";
  const userId = req.user?.sub;

  const drafts = await prisma.stewardPathEmailDraft.findMany({
    where: {
      enrollment: { organizationId },
      ...(status ? { status } : {}),
      ...(typeof req.query.enrollmentId === "string" ? { enrollmentId: req.query.enrollmentId } : {}),
      ...(mineOnly && userId ? { reviewerUserId: userId } : {}),
    },
    include: {
      enrollment: {
        select: {
          id: true,
          pathId: true,
          status: true,
          targetType: true,
          targetId: true,
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          path: { select: { id: true, name: true } },
        },
      },
      step: { select: { id: true, name: true, orderIndex: true, stepType: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  res.json(drafts);
});

/** PATCH /api/steward-paths/email-drafts/:id — edit draft and/or move status. */
router.patch("/email-drafts/:id", requirePermission("steward_paths.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const draft = await prisma.stewardPathEmailDraft.findFirst({
    where: {
      id: getRouteId(req),
      enrollment: { organizationId },
    },
    include: {
      enrollment: {
        select: { id: true, pathId: true, currentStepId: true },
      },
    },
  });

  if (!draft) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Email draft not found." } });
    return;
  }

  const updateData: Prisma.StewardPathEmailDraftUpdateInput = {};
  if (typeof req.body?.subject === "string") {
    const trimmed = req.body.subject.trim();
    if (!trimmed) {
      res.status(400).json({ error: { code: "INVALID_SUBJECT", message: "Subject cannot be empty." } });
      return;
    }
    updateData.subject = trimmed;
  }
  if (typeof req.body?.body === "string") {
    updateData.body = req.body.body;
  }

  const status = parseEnumValue(req.body?.status, EMAIL_DRAFT_STATUS_VALUES);
  if (req.body?.status !== undefined && !status) {
    res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid draft status." } });
    return;
  }

  const now = new Date();
  if (status) {
    updateData.status = status;
    if (status === "SENT") updateData.sentAt = now;
    if (status === "SKIPPED") updateData.skippedAt = now;
    if (status === "FAILED") {
      updateData.failedAt = now;
      updateData.failureReason = typeof req.body?.failureReason === "string" ? req.body.failureReason.trim() : "Marked failed manually";
    }
  }

  const updated = await prisma.stewardPathEmailDraft.update({
    where: { id: draft.id },
    data: updateData,
  });

  if (status === "SENT" || status === "SKIPPED" || status === "FAILED" || status === "APPROVED") {
    await prisma.stewardPathEnrollment.update({
      where: { id: draft.enrollmentId },
      data: { nextStepDueAt: new Date() },
    });
  }

  if (status) {
    await createTimelineEvent({
      enrollmentId: draft.enrollmentId,
      stepId: draft.stepId,
      eventType: status === "SENT" ? "EMAIL_SENT" : status === "SKIPPED" ? "STEP_SKIPPED" : "STEP_STARTED",
      message: `Email draft status changed to ${status}.`,
      createdByUserId: userId,
      metadataJson: { draftId: draft.id, status },
    });
  }

  await logAudit({
    action: "STEWARD_PATH_EMAIL_DRAFT_UPDATED",
    entity: "StewardPathEmailDraft",
    entityId: draft.id,
    userId,
    organizationId,
    metadata: {
      previousStatus: draft.status,
      newStatus: updated.status,
      enrollmentId: draft.enrollmentId,
      stepId: draft.stepId,
    },
  });

  res.json(updated);
});

/** POST /api/steward-paths/process-due — process one due-step batch on demand. */
router.post("/process-due", requirePermission("steward_paths.process_due_steps"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user context are required." } });
    return;
  }

  const limit = parsePositiveInt(req.body?.limit, 100, 1, 500);
  const result = await processDueStewardPathEnrollments({
    organizationId,
    limit,
    userId,
    source: "manual-api",
  });

  await logAudit({
    action: "STEWARD_PATH_PROCESS_DUE_RUN",
    entity: "StewardPath",
    userId,
    organizationId,
    metadata: { ...result },
  });

  res.json(result);
});

export default router;
