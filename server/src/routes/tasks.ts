/**
 * Task management routes for OyamaCRM.
 * Tasks represent follow-up actions assigned to staff members for constituent stewardship
 * (e.g., thank-you calls, major gift solicitations, impact updates).
 * Supports filtering by assignee, status, and constituent, with pagination.
 *
 * Routes:
 *   GET    /api/tasks      — paginated task list with optional filters
 *   POST   /api/tasks      — create a new task
 *   PATCH  /api/tasks/:id  — update a task (status, due date, notes, etc.)
 *   DELETE /api/tasks/:id  — delete a task
 *
 * @module routes/tasks
 */
import { Router } from "express";
import type { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { createTaskAssignmentNotification, createTaskOverdueNotification } from "../services/notifications.js";

const router = Router();

interface StewardshipTaskTemplate {
  id: string;
  name: string;
  title: string;
  type: string;
  priority: string;
  description: string;
  dueInDays: number;
}

const STEWARDSHIP_TASK_TEMPLATES: StewardshipTaskTemplate[] = [
  {
    id: "same-day-thank-you-call",
    name: "Same-day thank-you call",
    title: "Call donor to thank them for their recent gift",
    type: "CALL",
    priority: "HIGH",
    description: "Thank the donor personally, confirm designation intent, and capture any follow-up commitments.",
    dueInDays: 1,
  },
  {
    id: "impact-follow-up",
    name: "30-day impact follow-up",
    title: "Share 30-day impact update with donor",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    description: "Send a concise impact note highlighting outcomes and invite continued engagement.",
    dueInDays: 30,
  },
  {
    id: "major-donor-stewardship",
    name: "Major donor stewardship check-in",
    title: "Schedule stewardship check-in with major donor",
    type: "MEETING",
    priority: "URGENT",
    description: "Coordinate a personal stewardship meeting with leadership and prepare tailored talking points.",
    dueInDays: 7,
  },
  {
    id: "lapsed-reactivation",
    name: "Lapsed donor reactivation",
    title: "Email lapsed donor with re-engagement message",
    type: "EMAIL",
    priority: "MEDIUM",
    description: "Acknowledge past support and share one concrete reason to re-engage this quarter.",
    dueInDays: 3,
  },
];

// All task routes require authentication.
router.use(requireAuth);

// Task endpoints use view/edit fine-grained permissions.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:tasks")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:tasks")(req, res, next);
  }
  return next();
});

/** True when a task should be visible/editable to the current user. */
function canAccessTask(task: { createdById: string | null; assigneeId: string | null }, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  return task.createdById === userId || task.assigneeId === userId;
}

/** OR-scoped task visibility for records linked to the authenticated organization. */
function taskOrganizationWhere(organizationId: string) {
  return {
    OR: [
      { organizationId },
      { constituent: { organizationId } },
      { assignee: { organizationId } },
      { createdBy: { organizationId } },
      { meeting: { organizationId } },
    ],
  };
}

/** GET /api/tasks/templates — Return built-in stewardship task templates for task creation workflows. */
router.get("/templates", async (_req, res) => {
  res.json(STEWARDSHIP_TASK_TEMPLATES);
});

/** GET /api/tasks — Paginated task list. Filterable by assigneeId, status, and constituentId. */
router.get("/", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }
  if (!organizationId) {
    res.json({ items: [], total: 0, page: 1, limit: 25 });
    return;
  }

  const {
    assigneeId,
    status,
    constituentId,
    queue = "all",
    includeArchived = "false",
    scope = "personal",
    page = "1",
    limit = "25",
  } = req.query as Record<string, string>;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
  const skip = (parsedPage - 1) * parsedLimit;
  const personalScope = !(scope === "all" && role === "admin");
  const now = new Date();
  const activeTaskStatuses: TaskStatus[] = ["PENDING", "IN_PROGRESS"];

  const queueWhere: Prisma.TaskWhereInput =
    queue === "my-today"
      ? {
          assigneeId: userId,
          status: { in: activeTaskStatuses },
          dueDate: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) },
        }
      : queue === "overdue"
        ? {
            assigneeId: userId,
            status: { in: activeTaskStatuses },
            dueDate: { lt: now },
          }
        : queue === "completed"
          ? { status: "COMPLETED" as const }
          : queue === "assigned-by-me"
            ? { createdById: userId }
            : queue === "assigned-to-me"
              ? { assigneeId: userId }
              : queue === "team"
                ? { status: { in: activeTaskStatuses } }
                : {};

  const where: Prisma.TaskWhereInput = {
    ...taskOrganizationWhere(organizationId),
    ...(assigneeId && { assigneeId }),
    ...(status && { status: status as never }),
    ...(constituentId && { constituentId }),
    ...(includeArchived !== "true" && { archivedAt: null }),
    ...queueWhere,
    ...(personalScope
      ? {
          OR: [{ createdById: userId }, { assigneeId: userId }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ items, total, page: parsedPage, limit: parsedLimit });
});

/** POST /api/tasks — Create a new task. Body is passed directly to Prisma; include constituentId and assigneeId. */
router.post("/", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const {
    title,
    description,
    type,
    status,
    priority,
    dueDate,
    reminderAt,
    sourceModule,
    sourceType,
    sourceId,
    checklistJson,
    metadata,
    constituentId,
    assigneeId,
    meetingId,
  } = req.body as Record<string, string>;

  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, organizationId },
      select: { id: true },
    });
    if (!assignee) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid assigneeId for your organization" } });
      return;
    }
  }

  if (!title || !String(title).trim()) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "title is required" } });
    return;
  }

  if (constituentId) {
    const constituent = await prisma.constituent.findFirst({
      where: { id: constituentId, organizationId },
      select: { id: true },
    });
    if (!constituent) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid constituentId for your organization" } });
      return;
    }
  }

  const task = await prisma.task.create({
    data: {
      organizationId,
      title: String(title).trim(),
      description: description ? String(description) : null,
      type: (type as never) || "FOLLOW_UP",
      status: (status as never) || "PENDING",
      priority: (priority as never) || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      sourceModule: sourceModule ? String(sourceModule) : "donor",
      sourceType: sourceType ? String(sourceType) : "manual",
      sourceId: sourceId ? String(sourceId) : null,
      checklistJson: checklistJson ?? null,
      metadata: metadata ?? null,
      constituentId: constituentId || null,
      meetingId: meetingId || null,
      createdById: userId,
      assigneeId: assigneeId || userId,
    },
    include: {
      constituent: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (task.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: task.constituentId,
        taskId: task.id,
        userId: task.createdById ?? undefined,
        type: "NOTE",
        description: `Task created: ${task.title}`,
        metadata: { source: "api/tasks:create", status: task.status, priority: task.priority },
      },
    });
  }

  if (task.assigneeId && task.assigneeId !== userId) {
    const assignedBy = task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim() : null;
    await createTaskAssignmentNotification({
      organizationId,
      assigneeId: task.assigneeId,
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.dueDate,
      assignedByName: assignedBy,
    });
  }

  if (task.assigneeId && task.dueDate && task.dueDate < new Date()) {
    await createTaskOverdueNotification({
      organizationId,
      assigneeId: task.assigneeId,
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  res.status(201).json(task);
});

/** PATCH /api/tasks/:id — Partially update a task (e.g., mark complete, change assignee, update due date). */
router.patch("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ...taskOrganizationWhere(organizationId) },
    select: { id: true, createdById: true, assigneeId: true, constituentId: true, title: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(existing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...req.body,
      ...(req.body?.dueDate !== undefined && {
        dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : null,
      }),
      ...(req.body?.reminderAt !== undefined && {
        reminderAt: req.body?.reminderAt ? new Date(req.body.reminderAt) : null,
      }),
      ...(req.body?.snoozedUntil !== undefined && {
        snoozedUntil: req.body?.snoozedUntil ? new Date(req.body.snoozedUntil) : null,
      }),
      ...(req.body?.archivedAt !== undefined && {
        archivedAt: req.body?.archivedAt ? new Date(req.body.archivedAt) : null,
      }),
      ...(req.body?.status === "COMPLETED"
        ? {
            completedAt: new Date(),
            completedById: userId,
          }
        : {}),
    },
  });

  if (task.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: task.constituentId,
        taskId: task.id,
        userId: task.assigneeId ?? undefined,
        type: task.status === "COMPLETED" ? "TASK_COMPLETED" : "NOTE",
        description: task.status === "COMPLETED" ? `Task completed: ${task.title}` : `Task updated: ${task.title}`,
        metadata: { source: "api/tasks:update", status: task.status },
      },
    });
  }

  res.json(task);
});

/** POST /api/tasks/:id/start — Mark task as in progress. */
router.post("/:id/start", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ...taskOrganizationWhere(organizationId), archivedAt: null },
    select: { id: true, createdById: true, assigneeId: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(existing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status: "IN_PROGRESS",
      snoozedUntil: null,
    },
  });

  res.json(task);
});

/** POST /api/tasks/:id/complete — Complete a task with optional outcome. */
router.post("/:id/complete", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ...taskOrganizationWhere(organizationId) },
    select: { id: true, title: true, createdById: true, assigneeId: true, constituentId: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(existing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }

  const outcome = typeof req.body?.outcome === "string" ? req.body.outcome.trim() : "";
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: userId,
      snoozedUntil: null,
      archivedAt: null,
      outcome: outcome || null,
    },
  });

  if (existing.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: existing.constituentId,
        taskId: existing.id,
        userId,
        type: "TASK_COMPLETED",
        description: `Task completed: ${existing.title}`,
        metadata: { source: "api/tasks:complete", outcome: outcome || null },
      },
    });
  }

  res.json(task);
});

/** POST /api/tasks/:id/snooze — Snooze a task by date and set status back to pending. */
router.post("/:id/snooze", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ...taskOrganizationWhere(organizationId), archivedAt: null },
    select: { id: true, createdById: true, assigneeId: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(existing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }

  const untilRaw = req.body?.until;
  const until = typeof untilRaw === "string" || untilRaw instanceof Date
    ? new Date(untilRaw)
    : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(until.getTime())) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid snooze date" } });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status: "PENDING",
      snoozedUntil: until,
    },
  });

  res.json(task);
});

/** POST /api/tasks/:id/archive — Archive a completed/canceled task for historical views. */
router.post("/:id/archive", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, ...taskOrganizationWhere(organizationId) },
    select: { id: true, createdById: true, assigneeId: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(existing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }
  if (existing.status !== "COMPLETED" && existing.status !== "CANCELLED") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Only completed or canceled tasks can be archived" } });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() },
  });

  res.json(task);
});

/**
 * POST /api/tasks/bulk-assign
 * Reassigns many tasks to one assignee in one action and writes timeline notes for linked constituents.
 */
router.post("/bulk-assign", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const assigneeId = typeof req.body?.assigneeId === "string" ? req.body.assigneeId : "";
  const taskIdsRaw: unknown[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds : [];
  const taskIds = Array.from(new Set(taskIdsRaw.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));

  if (!assigneeId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "assigneeId is required" } });
    return;
  }
  if (taskIds.length === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "taskIds must contain at least one task id" } });
    return;
  }

  const assignee = await prisma.user.findFirst({ where: { id: assigneeId, organizationId }, select: { id: true, firstName: true, lastName: true } });
  if (!assignee) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid assigneeId for your organization" } });
    return;
  }

  const tasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      ...taskOrganizationWhere(organizationId),
    },
    select: {
      id: true,
      title: true,
      createdById: true,
      assigneeId: true,
      constituentId: true,
    },
  });

  if (tasks.length === 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No matching tasks found" } });
    return;
  }

  const unauthorized = tasks.filter((task) => !canAccessTask(task, userId, role));
  if (unauthorized.length > 0) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "One or more tasks are outside your access scope",
      },
    });
    return;
  }

  const idsToUpdate = tasks.map((task) => task.id);
  const reassignedByName = `user:${userId}`;
  const assigneeName = `${assignee.firstName} ${assignee.lastName}`.trim();

  await prisma.task.updateMany({
    where: { id: { in: idsToUpdate } },
    data: {
      assigneeId: assignee.id,
      snoozedUntil: null,
    },
  });

  const activityRows = tasks
    .filter((task) => Boolean(task.constituentId))
    .map((task) => ({
      constituentId: task.constituentId as string,
      taskId: task.id,
      userId,
      type: "NOTE" as const,
      description: `Task reassigned: ${task.title} -> ${assigneeName}`,
      metadata: {
        source: "api/tasks:bulk-assign",
        reassignedBy: reassignedByName,
        assigneeId: assignee.id,
        assigneeName,
      },
    }));

  if (activityRows.length > 0) {
    await prisma.activity.createMany({ data: activityRows });
  }

  await Promise.all(
    tasks.map((task) =>
      createTaskAssignmentNotification({
        organizationId,
        assigneeId: assignee.id,
        taskId: task.id,
        taskTitle: task.title,
        assignedByName: reassignedByName,
      })
    )
  );

  res.json({
    updatedCount: idsToUpdate.length,
    assignee: { id: assignee.id, name: assigneeName },
  });
});

/** DELETE /api/tasks/:id — Delete a task permanently (owner/assignee/admin). */
router.delete("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const id = req.params.id as string;
  const task = await prisma.task.findFirst({
    where: { id, ...taskOrganizationWhere(organizationId) },
    select: { id: true, createdById: true, assigneeId: true },
  });
  if (!task) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
    return;
  }
  if (!canAccessTask(task, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this task" } });
    return;
  }

  await prisma.task.delete({ where: { id } });
  res.status(204).send();
});

export default router;
