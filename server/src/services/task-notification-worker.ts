/** Produces durable in-app task reminders. This worker never sends email, SMS, or push. */
import { prisma } from "../lib/prisma.js";
import { createTaskAssignmentNotification, createTaskOverdueNotification, createTaskReminderNotification } from "./notifications.js";

const POLL_MS = 30_000;
const BATCH_SIZE = 100;
let timer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;
let cursor: string | null = null;
let cleanupCursor: string | null = null;
const state = {
  running: false, processing: false, lastRunAt: null as string | null,
  lastSuccessAt: null as string | null, lastError: null as string | null,
  candidates: 0,
};

/** Other workflows also complete/reassign tasks; repair their stale alerts in bounded batches. */
async function resolveStaleTaskNotifications(now: Date): Promise<void> {
  const notices = await prisma.notification.findMany({
    where: { archivedAt: null, sourceType: { in: ["task-assigned", "task-reminder", "task-overdue"] }, sourceId: { not: null } },
    select: { id: true, sourceId: true, sourceType: true, organizationId: true, userId: true, metadata: true },
    orderBy: { id: "asc" }, take: BATCH_SIZE,
    ...(cleanupCursor ? { cursor: { id: cleanupCursor }, skip: 1 } : {}),
  });
  cleanupCursor = notices.length === BATCH_SIZE ? notices[notices.length - 1].id : null;
  if (!notices.length) return;
  const tasks = await prisma.task.findMany({
    where: { id: { in: [...new Set(notices.map((notice) => notice.sourceId!))] } },
    select: {
      id: true, organizationId: true, assigneeId: true, status: true, archivedAt: true, dueDate: true, reminderAt: true,
      assignee: { select: { organizationId: true, active: true } }, constituent: { select: { organizationId: true } },
    },
  });
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const stale = notices.filter((notice) => {
    const task = byId.get(notice.sourceId!);
    if (!task || task.archivedAt || !["PENDING", "IN_PROGRESS"].includes(task.status)
      || task.assigneeId !== notice.userId || !task.assignee?.active) return true;
    const organizationId = task.organizationId ?? task.constituent?.organizationId ?? task.assignee.organizationId;
    if (organizationId !== notice.organizationId || task.assignee.organizationId !== organizationId
      || (task.constituent && task.constituent.organizationId !== organizationId)) return true;
    const eventAt = notice.metadata && typeof notice.metadata === "object" && !Array.isArray(notice.metadata)
      ? notice.metadata.eventAt : undefined;
    const scheduled = notice.sourceType === "task-reminder" ? task.reminderAt : task.dueDate;
    if (notice.sourceType === "task-assigned") return false;
    return !scheduled || scheduled > now || (typeof eventAt === "string" && eventAt !== scheduled.toISOString());
  });
  if (stale.length) await prisma.notification.updateMany({
    where: { id: { in: stale.map((notice) => notice.id) }, archivedAt: null },
    data: { archivedAt: now, status: "ARCHIVED" },
  });
}

/** One bounded pass. Persisted source/event dedup preserves read, dismissed, and snoozed alerts. */
export async function processTaskNotificationPass(now = new Date()): Promise<void> {
  if (inFlight) return inFlight;
  state.processing = true; state.lastRunAt = now.toISOString(); state.lastError = null;
  const work = async () => {
    try {
      await resolveStaleTaskNotifications(now);
      const tasks = await prisma.task.findMany({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] }, archivedAt: null,
          assignee: { is: { active: true } },
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
        },
        select: {
          id: true, title: true, organizationId: true, dueDate: true, reminderAt: true, sourceType: true,
          assignee: { select: { id: true, organizationId: true, active: true, role: true } },
          constituent: { select: { organizationId: true } },
        },
        orderBy: { id: "asc" }, take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      state.candidates = tasks.length;
      // Advance through the entire candidate set instead of re-reading the same
      // oldest 100 forever. A later pass restarts after the final batch.
      cursor = tasks.length === BATCH_SIZE ? tasks[tasks.length - 1].id : null;
      let failures = 0;
      for (const task of tasks) {
        const assignee = task.assignee;
        if (!assignee?.active || assignee.role === "compassion_user") continue;
        const organizationId = task.organizationId ?? task.constituent?.organizationId ?? assignee.organizationId;
        if (!organizationId || assignee.organizationId !== organizationId
          || (task.constituent && task.constituent.organizationId !== organizationId)) continue;
        try {
          // Automation and integration producers do not all pass through the
          // manual task API. Catch up every active assignment once, including
          // undated tasks, using durable lifecycle dedup in the shared service.
          if (task.sourceType !== "steward-path-notification") await createTaskAssignmentNotification({
            organizationId, assigneeId: assignee.id, taskId: task.id, taskTitle: task.title, dueDate: task.dueDate,
          });
          if (task.reminderAt && task.reminderAt <= now) await createTaskReminderNotification({
            organizationId, assigneeId: assignee.id, taskId: task.id, taskTitle: task.title,
            reminderAt: task.reminderAt, dueDate: task.dueDate,
          });
          if (task.dueDate && task.dueDate < now) await createTaskOverdueNotification({
            organizationId, assigneeId: assignee.id, taskId: task.id, taskTitle: task.title, dueDate: task.dueDate,
          });
        } catch {
          failures += 1;
        }
      }
      if (failures) throw new Error(`Unable to produce reminders for ${failures} task(s).`);
      state.lastSuccessAt = new Date().toISOString();
    } catch {
      // No task titles, donor details, tokens, or raw database diagnostics in health/logs.
      state.lastError = "Task notifications could not be refreshed. Check database availability and migrations.";
    } finally {
      state.processing = false;
    }
  };
  inFlight = work();
  try { await inFlight; } finally { inFlight = null; }
}

export function startTaskNotificationWorker(): void {
  if (timer) return;
  state.running = true;
  timer = setInterval(() => { void processTaskNotificationPass(); }, POLL_MS);
  timer.unref?.();
  void processTaskNotificationPass();
}

export async function stopTaskNotificationWorker(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null; state.running = false;
  if (inFlight) await inFlight;
}

export function getTaskNotificationWorkerStatus() {
  return {
    ...state, pollMs: POLL_MS, batchSize: BATCH_SIZE,
    status: !state.running ? "Stopped" : state.lastError ? "Unavailable" : "Running",
  };
}
