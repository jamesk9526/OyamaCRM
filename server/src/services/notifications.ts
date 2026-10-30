/** Notification helpers for durable, user-scoped work engine alerts. */
import type { NotificationSeverity, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  module?: string;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  message: string;
  href: string;
  severity?: NotificationSeverity;
  actionLabel?: string | null;
  metadata?: Prisma.InputJsonValue;
  snoozedUntil?: Date | null;
  expiresAt?: Date | null;
  /** Task lifecycle alerts are deduplicated until resolved, including dismissed alerts. */
  taskEventAt?: Date | null;
  persistent?: boolean;
}

export async function createNotification(input: CreateNotificationInput) {
  if (!input.href.startsWith("/") || input.href.startsWith("//") || /[\\\x00-\x20]/.test(input.href)) throw new Error("Notification destination must be an application path.");
  const duplicateWindowStart = new Date(Date.now() - 5 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
  // Serialize each recipient's creation across API/worker processes. A read-then-
  // create check without this lock duplicates alerts when several workers poll.
  const recipients = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM User WHERE id = ${input.userId} AND organizationId = ${input.organizationId} AND active = TRUE FOR UPDATE`;
  if (!recipients.length) return null;
  const existing = await tx.notification.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      module: input.module ?? "donor",
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      archivedAt: null,
      ...(input.persistent ? {} : { title: input.title, createdAt: { gte: duplicateWindowStart } }),
      ...(input.taskEventAt ? { metadata: { path: "$.eventAt", equals: input.taskEventAt.toISOString() } } : {}),
    },
    select: { id: true },
  });

  if (existing) return existing;

  return tx.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      module: input.module ?? "donor",
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      title: input.title,
      message: input.message,
      href: input.href,
      severity: input.severity ?? "MEDIUM",
      actionLabel: input.actionLabel ?? null,
      metadata: input.taskEventAt ? { ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {}), eventAt: input.taskEventAt.toISOString() } : input.metadata,
      snoozedUntil: input.snoozedUntil ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true },
  });
  });
}

export async function createTaskAssignmentNotification(args: {
  organizationId: string;
  assigneeId: string;
  taskId: string;
  taskTitle: string;
  dueDate?: Date | null;
  assignedByName?: string | null;
}) {
  const dueLabel = args.dueDate ? `Due ${args.dueDate.toLocaleString("en-US", { timeZone: "UTC" })} UTC` : "No due date";
  const byLabel = args.assignedByName ? `Assigned by ${args.assignedByName}` : "New task assignment";

  await createNotification({
    organizationId: args.organizationId,
    userId: args.assigneeId,
    module: "donor",
    sourceType: "task-assigned",
    sourceId: args.taskId,
    title: `Task assigned: ${args.taskTitle}`,
    message: `${byLabel} · ${dueLabel}`,
    href: `/tasks?taskId=${encodeURIComponent(args.taskId)}&focus=my`,
    severity: "HIGH",
    actionLabel: "Open task",
    persistent: true,
  });
}

export async function createTaskOverdueNotification(args: {
  organizationId: string;
  assigneeId: string;
  taskId: string;
  taskTitle: string;
  dueDate?: Date | null;
}) {
  await createNotification({
    organizationId: args.organizationId,
    userId: args.assigneeId,
    module: "donor",
    sourceType: "task-overdue",
    sourceId: args.taskId,
    title: `Task overdue: ${args.taskTitle}`,
    message: "This task is now overdue and needs attention.",
    href: `/tasks?taskId=${encodeURIComponent(args.taskId)}&focus=overdue`,
    severity: "HIGH",
    actionLabel: "Review overdue",
    persistent: true,
    taskEventAt: args.dueDate,
  });
}

export async function createTaskReminderNotification(args: {
  organizationId: string; assigneeId: string; taskId: string; taskTitle: string; reminderAt: Date; dueDate?: Date | null;
}) {
  return createNotification({ organizationId: args.organizationId, userId: args.assigneeId, module: "donor", sourceType: "task-reminder", sourceId: args.taskId,
    title: `Task reminder: ${args.taskTitle}`, message: args.dueDate ? `Due ${args.dueDate.toLocaleString("en-US", { timeZone: "UTC" })} UTC. Open the task to review your next step.` : "Your scheduled task reminder is ready.",
    href: `/tasks?taskId=${encodeURIComponent(args.taskId)}`, severity: "MEDIUM", actionLabel: "Open task", persistent: true, taskEventAt: args.reminderAt });
}

/** Retain audit history while removing resolved work from every active inbox. */
export async function resolveTaskNotifications(args: { organizationId: string; taskId: string; assigneeId?: string; sourceTypes?: Array<"task-assigned" | "task-reminder" | "task-overdue"> }) {
  return prisma.notification.updateMany({ where: { organizationId: args.organizationId, sourceId: args.taskId,
    sourceType: { in: args.sourceTypes ?? ["task-assigned", "task-reminder", "task-overdue"] }, archivedAt: null, ...(args.assigneeId ? { userId: args.assigneeId } : {}) },
    data: { archivedAt: new Date(), status: "ARCHIVED" } });
}
