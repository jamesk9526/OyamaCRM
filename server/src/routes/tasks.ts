/**
 * Task management routes for OyamaCRM.
 * Tasks represent follow-up actions assigned to staff members for constituent stewardship
 * (e.g., thank-you calls, major gift solicitations, impact updates).
 * Supports filtering by assignee, status, and constituent, with pagination.
 *
 * Routes:
 *   GET    /api/tasks      â€” paginated task list with optional filters
 *   POST   /api/tasks      â€” create a new task
 *   PATCH  /api/tasks/:id  â€” update a task (status, due date, notes, etc.)
 *   DELETE /api/tasks/:id  â€” delete a task
 *
 * @module routes/tasks
 */
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createTaskAssignmentNotification,
  createTaskOverdueNotification,
  resolveTaskNotifications,
} from "../services/notifications.js";

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
    description:
      "Thank the donor personally, confirm designation intent, and capture any follow-up commitments.",
    dueInDays: 0,
  },
  {
    id: "impact-follow-up",
    name: "30-day impact follow-up",
    title: "Share 30-day impact update with donor",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    description:
      "Send a concise impact note highlighting outcomes and invite continued engagement.",
    dueInDays: 30,
  },
  {
    id: "major-donor-stewardship",
    name: "Major donor stewardship check-in",
    title: "Schedule stewardship check-in with major donor",
    type: "MEETING",
    priority: "URGENT",
    description:
      "Coordinate a personal stewardship meeting with leadership and prepare tailored talking points.",
    dueInDays: 7,
  },
  {
    id: "lapsed-reactivation",
    name: "Lapsed donor reactivation",
    title: "Email lapsed donor with re-engagement message",
    type: "EMAIL",
    priority: "MEDIUM",
    description:
      "Acknowledge past support and share one concrete reason to re-engage this quarter.",
    dueInDays: 3,
  },
];

import {
  TaskValidationError,
  activeTaskStatuses,
  canAccessTask,
  canManageTeamTasks,
  taskOrganizationWhere,
  validateTaskInput,
} from "../services/task-policy.js";

router.use(requireAuth);
router.use((req, res, next) =>
  requirePermission(req.method === "GET" ? "view:tasks" : "edit:tasks")(
    req,
    res,
    next,
  ),
);
const related = {
  constituent: { select: { id: true, firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;
const route =
  (work: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await work(req, res);
    } catch (error) {
      if (error instanceof TaskValidationError) {
        res
          .status(400)
          .json({
            error: { code: "VALIDATION_ERROR", message: error.message },
          });
        return;
      }
      next(error);
    }
  };
function organization(req: Request): string {
  if (!req.user?.orgId)
    throw new TaskValidationError(
      "Your account needs an organization before managing tasks.",
    );
  return req.user.orgId;
}
async function accessibleTask(req: Request, res: Response) {
  const task = await prisma.task.findFirst({
    where: {
      id: String(req.params.id),
      ...taskOrganizationWhere(organization(req)),
    },
    include: related,
  });
  if (!task) {
    res
      .status(404)
      .json({
        error: {
          code: "NOT_FOUND",
          message: "Task not found in your organization.",
        },
      });
    return null;
  }
  if (!canAccessTask(task, req.user!.sub, req.user!.role)) {
    res
      .status(403)
      .json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this task.",
        },
      });
    return null;
  }
  return task;
}
async function validateRelations(
  values: Record<string, unknown>,
  organizationId: string,
) {
  for (const field of ["assigneeId", "constituentId", "meetingId"] as const) {
    const id = values[field];
    if (!id) continue;
    const where = { id: String(id), organizationId };
    const row =
      field === "assigneeId"
        ? await prisma.user.findFirst({
            where: { ...where, active: true, role: { not: "compassion_user" } },
            select: { id: true },
          })
        : field === "constituentId"
          ? await prisma.constituent.findFirst({ where, select: { id: true } })
          : await prisma.meeting.findFirst({ where, select: { id: true } });
    if (!row)
      throw new TaskValidationError(
        `Choose an active ${field === "assigneeId" ? "staff account" : field === "constituentId" ? "constituent" : "meeting"} in your organization.`,
      );
  }
}
interface NoticeTask {
  id: string;
  assigneeId: string | null;
  title: string;
  dueDate: Date | null;
  reminderAt: Date | null;
  status: string;
  archivedAt: Date | null;
  snoozedUntil: Date | null;
}
async function notifyTask(
  task: NoticeTask,
  organizationId: string,
  previous?: NoticeTask | null,
) {
  try {
    const active =
      activeTaskStatuses.includes(task.status as never) && !task.archivedAt;
    const reassigned = task.assigneeId !== previous?.assigneeId;
    const reopened = Boolean(
      previous &&
        !activeTaskStatuses.includes(previous.status as never) &&
        active,
    );
    const rescheduled =
      task.dueDate?.getTime() !== previous?.dueDate?.getTime();
    const reminderChanged =
      task.reminderAt?.getTime() !== previous?.reminderAt?.getTime();
    if (!active || reassigned || reopened || !task.assigneeId)
      await resolveTaskNotifications({ organizationId, taskId: task.id });
    else {
      const sourceTypes: Array<"task-overdue" | "task-reminder"> = [];
      if (rescheduled) sourceTypes.push("task-overdue");
      if (reminderChanged) sourceTypes.push("task-reminder");
      if (sourceTypes.length)
        await resolveTaskNotifications({
          organizationId,
          taskId: task.id,
          sourceTypes,
        });
    }
    if (active && task.assigneeId) {
      if (reassigned || reopened || !previous)
        await createTaskAssignmentNotification({
          organizationId,
          assigneeId: task.assigneeId,
          taskId: task.id,
          taskTitle: task.title,
          dueDate: task.dueDate,
        });
      if (
        (rescheduled || reassigned || reopened || !previous) &&
        task.dueDate &&
        task.dueDate < new Date() &&
        (!task.snoozedUntil || task.snoozedUntil <= new Date())
      )
        await createTaskOverdueNotification({
          organizationId,
          assigneeId: task.assigneeId,
          taskId: task.id,
          taskTitle: task.title,
          dueDate: task.dueDate,
        });
    }
    return undefined;
  } catch {
    console.error(
      "[tasks] Notification delivery failed after saved task",
      task.id,
    );
    return "Task saved. Its notification could not be refreshed; check Notifications before assigning it again.";
  }
}
router.get("/templates", (_req, res) => res.json(STEWARDSHIP_TASK_TEMPLATES));
router.get(
  "/assignees",
  route(async (req, res) => {
    const items = await prisma.user.findMany({
      where: {
        organizationId: organization(req),
        active: true,
        role: { not: "compassion_user" },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    });
    res.json({ items });
  }),
);
router.get(
  "/",
  route(async (req, res) => {
    const userId = req.user!.sub;
    const organizationId = organization(req);
    if (!organizationId) {
      res.json({ items: [], total: 0, page: 1, limit: 25, totalPages: 1 });
      return;
    }
    const q = req.query as Record<string, string>;
    const page = Math.max(1, Math.min(100000, parseInt(q.page) || 1));
    const limit = Math.max(1, Math.min(100, parseInt(q.limit) || 25));
    if (q.status) validateTaskInput({ status: q.status });
    if (q.type) validateTaskInput({ type: q.type });
    if (q.priority) validateTaskInput({ priority: q.priority });
    const queues = [
      "all",
      "my-today",
      "overdue",
      "completed",
      "assigned-by-me",
      "assigned-to-me",
      "team",
      "followups",
    ];
    if (q.queue && !queues.includes(q.queue))
      throw new TaskValidationError("Choose a valid task queue.");
    const personal = !(q.scope === "all" && canManageTeamTasks(req.user!.role));
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const queueWhere: Prisma.TaskWhereInput =
      q.queue === "my-today"
        ? {
            assigneeId: userId,
            status: { in: activeTaskStatuses },
            dueDate: { lte: todayEnd },
          }
        : q.queue === "overdue"
          ? {
              ...(personal ? { assigneeId: userId } : {}),
              status: { in: activeTaskStatuses },
              dueDate: { lt: now },
            }
          : q.queue === "completed"
            ? { status: "COMPLETED" }
            : q.queue === "assigned-by-me"
              ? { createdById: userId }
              : q.queue === "assigned-to-me"
                ? { assigneeId: userId }
                : q.queue === "followups"
                  ? {
                      type: { in: ["FOLLOW_UP", "THANK_YOU", "CALL", "EMAIL"] },
                    }
                  : {};
    const where: Prisma.TaskWhereInput = {
      AND: [
        taskOrganizationWhere(organizationId),
        ...(personal
          ? [{ OR: [{ createdById: userId }, { assigneeId: userId }] }]
          : []),
        ...(q.activeOnly === "true" ? [{ status: { in: activeTaskStatuses } }] : []),
        ...(q.enrollmentId ? [{ stewardPathEnrollmentId: q.enrollmentId }] : []),
        ...(q.status ? [{ status: q.status as never }] : []),
        ...(q.type ? [{ type: q.type as never }] : []),
        ...(q.priority ? [{ priority: q.priority as never }] : []),
        ...(q.search?.trim()
          ? [
              {
                OR: [
                  { title: { contains: q.search.trim().slice(0, 500) } },
                  { description: { contains: q.search.trim().slice(0, 500) } },
                  { constituent: { firstName: { contains: q.search.trim() } } },
                  { constituent: { lastName: { contains: q.search.trim() } } },
                ],
              },
            ]
          : []),
      ],
      ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
      ...(q.constituentId ? { constituentId: q.constituentId } : {}),
      ...(q.includeArchived !== "true" ? { archivedAt: null } : {}),
      ...queueWhere,
    };
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        include: related,
      }),
      prisma.task.count({ where }),
    ]);
    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);
router.get(
  "/:id",
  route(async (req, res) => {
    const task = await accessibleTask(req, res);
    if (task) res.json(task);
  }),
);
router.post(
  "/",
  route(async (req, res) => {
    const organizationId = organization(req),
      userId = req.user!.sub;
    const values = validateTaskInput(req.body, true);
    if (!("assigneeId" in values)) values.assigneeId = userId;
    await validateRelations(values, organizationId);
    if (
      values.archivedAt &&
      !["COMPLETED", "CANCELLED"].includes(String(values.status))
    )
      throw new TaskValidationError(
        "Only completed or cancelled tasks can be archived.",
      );
    const task = await prisma.$transaction(async (tx) => {
      const saved = await tx.task.create({
        data: {
          ...values,
          organizationId,
          createdById: userId,
          sourceModule: values.sourceModule || "donor",
          sourceType: values.sourceType || "manual",
          ...(values.status === "COMPLETED"
            ? { completedAt: new Date(), completedById: userId }
            : {}),
        } as Prisma.TaskUncheckedCreateInput,
        include: related,
      });
      if (saved.constituentId)
        await tx.activity.create({
          data: {
            constituentId: saved.constituentId,
            taskId: saved.id,
            userId,
            type: "NOTE",
            description: `Task created: ${saved.title}`,
            metadata: { source: "api/tasks:create" },
          },
        });
      return saved;
    });
    res
      .status(201)
      .json({
        ...task,
        notificationWarning: await notifyTask(task, organizationId, null),
      });
  }),
);
router.patch(
  "/:id",
  route(async (req, res) => {
    const existing = await accessibleTask(req, res);
    if (!existing) return;
    const organizationId = organization(req),
      userId = req.user!.sub;
    const values = validateTaskInput(req.body);
    if (existing.sourceType === "donation-follow-up" && "constituentId" in values && values.constituentId !== existing.constituentId) throw new TaskValidationError("A donation follow-up must stay linked to the gift's donor.");
    await validateRelations(values, organizationId);
    const nextStatus = String(values.status ?? existing.status);
    if (values.archivedAt && !["COMPLETED", "CANCELLED"].includes(nextStatus))
      throw new TaskValidationError(
        "Only completed or cancelled tasks can be archived.",
      );
    if (values.status !== undefined) {
      if (nextStatus === "COMPLETED") {
        values.completedAt = existing.completedAt ?? new Date();
        values.completedById = existing.completedById ?? userId;
        values.snoozedUntil = null;
      } else {
        values.completedAt = null;
        values.completedById = null;
        values.outcome = null;
        if (activeTaskStatuses.includes(nextStatus as never))
          values.archivedAt = null;
      }
    }
    const task = await prisma.$transaction(async (tx) => {
      const saved = await tx.task.update({
        where: { id: existing.id },
        data: values as Prisma.TaskUncheckedUpdateInput,
        include: related,
      });
      if (saved.constituentId)
        await tx.activity.create({
          data: {
            constituentId: saved.constituentId,
            taskId: saved.id,
            userId,
            type:
              saved.status === "COMPLETED" && existing.status !== "COMPLETED"
                ? "TASK_COMPLETED"
                : "NOTE",
            description: `Task ${saved.status === "COMPLETED" ? "completed" : "updated"}: ${saved.title}`,
            metadata: { source: "api/tasks:update", status: saved.status },
          },
        });
      return saved;
    });
    res.json({
      ...task,
      notificationWarning: await notifyTask(task, organizationId, existing),
    });
  }),
);
// Transition commands apply the same validation and server-owned completion metadata.
for (const action of [
  "start",
  "complete",
  "reopen",
  "snooze",
  "archive",
] as const) {
  router.post(
    `/:id/${action}`,
    route(async (req, res) => {
      const existing = await accessibleTask(req, res);
      if (!existing) return;
      if (
        action === "snooze" &&
        (!activeTaskStatuses.includes(existing.status) || existing.archivedAt)
      )
        throw new TaskValidationError("Only active tasks can be snoozed.");
      if (
        action === "archive" &&
        !["COMPLETED", "CANCELLED"].includes(existing.status)
      )
        throw new TaskValidationError(
          "Only completed or cancelled tasks can be archived.",
        );
      let values: Record<string, unknown> =
        action === "start"
          ? { status: "IN_PROGRESS", snoozedUntil: null }
          : action === "complete"
            ? { status: "COMPLETED", outcome: req.body?.outcome ?? null }
            : action === "reopen"
              ? { status: "PENDING", snoozedUntil: null }
              : action === "archive"
                ? { archivedAt: new Date().toISOString() }
                : {
                    status: "PENDING",
                    snoozedUntil:
                      req.body?.until ??
                      new Date(Date.now() + 3600000).toISOString(),
                  };
      values = validateTaskInput(values);
      if (action === "snooze" && (values.snoozedUntil as Date) <= new Date())
        throw new TaskValidationError("Choose a future snooze time.");
      if (values.status === "COMPLETED") {
        values.completedAt = existing.completedAt ?? new Date();
        values.completedById = existing.completedById ?? req.user!.sub;
        values.snoozedUntil = null;
      } else if (values.status) {
        values.completedAt = null;
        values.completedById = null;
        values.outcome = null;
        values.archivedAt = null;
      }
      const task = await prisma.$transaction(async (tx) => {
        const saved = await tx.task.update({
          where: { id: existing.id },
          data: values as Prisma.TaskUncheckedUpdateInput,
          include: related,
        });
        if (
          saved.constituentId &&
          action === "complete" &&
          existing.status !== "COMPLETED"
        )
          await tx.activity.create({
            data: {
              constituentId: saved.constituentId,
              taskId: saved.id,
              userId: req.user!.sub,
              type: "TASK_COMPLETED",
              description: `Task completed: ${saved.title}`,
              metadata: {
                source: "api/tasks:complete",
                outcome: saved.outcome,
              },
            },
          });
        return saved;
      });
      res.json({
        ...task,
        notificationWarning: await notifyTask(
          task,
          organization(req),
          existing,
        ),
      });
    }),
  );
}
router.post(
  "/bulk-assign",
  route(async (req, res) => {
    const organizationId = organization(req),
      userId = req.user!.sub;
    const assigneeId = req.body?.assigneeId;
    const taskIds = Array.isArray(req.body?.taskIds)
      ? Array.from(new Set(req.body.taskIds))
      : [];
    if (
      typeof assigneeId !== "string" ||
      !assigneeId ||
      !taskIds.length ||
      taskIds.length > 100 ||
      taskIds.some((id) => typeof id !== "string" || !id)
    )
      throw new TaskValidationError("Select an assignee and 1–100 task IDs.");
    await validateRelations({ assigneeId }, organizationId);
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds as string[] },
        ...taskOrganizationWhere(organizationId),
      },
    });
    if (tasks.length !== taskIds.length) {
      res
        .status(404)
        .json({
          error: {
            code: "NOT_FOUND",
            message:
              "One or more tasks were not found in your organization. No tasks were changed.",
          },
        });
      return;
    }
    if (tasks.some((task) => !canAccessTask(task, userId, req.user!.role))) {
      res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "One or more tasks are outside your access scope.",
          },
        });
      return;
    }
    if (
      tasks.some(
        (task) => !activeTaskStatuses.includes(task.status) || task.archivedAt,
      )
    )
      throw new TaskValidationError("Reassign only active, unarchived tasks.");
    await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: { in: taskIds as string[] }, status: { in: activeTaskStatuses }, archivedAt: null },
        data: { assigneeId, snoozedUntil: null },
      });
      if (updated.count !== tasks.length) throw new TaskValidationError("Selected tasks changed during reassignment. Refresh the queue and review the selection again.");
      const activity = tasks
        .filter((task) => task.constituentId)
        .map((task) => ({
          constituentId: task.constituentId!,
          taskId: task.id,
          userId,
          type: "NOTE" as const,
          description: `Task reassigned: ${task.title}`,
          metadata: { assigneeId, source: "api/tasks:bulk-assign" },
        }));
      if (activity.length) await tx.activity.createMany({ data: activity });
    });
    const notices = await Promise.all(
      tasks.map((task) =>
        notifyTask({ ...task, assigneeId }, organizationId, task),
      ),
    );
    res.json({
      updatedCount: tasks.length,
      notificationWarning: notices.find(Boolean),
    });
  }),
);
router.delete(
  "/:id",
  route(async (req, res) => {
    const task = await accessibleTask(req, res);
    if (!task) return;
    await prisma.task.delete({ where: { id: task.id } });
    try {
      await resolveTaskNotifications({
        organizationId: organization(req),
        taskId: task.id,
      });
    } catch {
      console.error(
        "[tasks] Notification cleanup failed after deleted task",
        task.id,
      );
    }
    res.status(204).send();
  }),
);
export default router;
