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
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// All task routes require authentication.
router.use(requireAuth);

/** GET /api/tasks — Paginated task list. Filterable by assigneeId, status, and constituentId. */
router.get("/", async (req, res) => {
  const { assigneeId, status, constituentId, page = "1", limit = "25" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    ...(assigneeId && { assigneeId }),
    ...(status && { status: status as never }),
    ...(constituentId && { constituentId }),
  };

  // Fetch page and total count in parallel
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { dueDate: "asc" },
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

/** POST /api/tasks — Create a new task. Body is passed directly to Prisma; include constituentId and assigneeId. */
router.post("/", async (req, res) => {
  const task = await prisma.task.create({
    data: req.body,
    include: { constituent: true, assignee: true },
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
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: req.body,
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

/** DELETE /api/tasks/:id — Delete a task permanently. Admin-only. */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id as string;
  await prisma.task.delete({ where: { id } });
  res.status(204).send();
});

export default router;
