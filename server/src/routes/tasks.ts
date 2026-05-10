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
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

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
      { constituent: { organizationId } },
      { assignee: { organizationId } },
      { createdBy: { organizationId } },
      { meeting: { organizationId } },
    ],
  };
}

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
    scope = "personal",
    page = "1",
    limit = "25",
  } = req.query as Record<string, string>;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
  const skip = (parsedPage - 1) * parsedLimit;
  const personalScope = !(scope === "all" && role === "admin");

  const where = {
    ...taskOrganizationWhere(organizationId),
    ...(assigneeId && { assigneeId }),
    ...(status && { status: status as never }),
    ...(constituentId && { constituentId }),
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
      title: String(title).trim(),
      description: description ? String(description) : null,
      type: (type as never) || "FOLLOW_UP",
      status: (status as never) || "PENDING",
      priority: (priority as never) || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
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
