/** Notification helpers for durable, user-scoped work engine alerts. */
import type { NotificationSeverity, NotificationStatus, Prisma } from "@prisma/client";
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
}

export async function createNotification(input: CreateNotificationInput) {
  const duplicateWindowStart = new Date(Date.now() - 5 * 60 * 1000);

  const existing = await prisma.notification.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      title: input.title,
      status: { in: ["UNREAD", "READ"] as NotificationStatus[] },
      createdAt: { gte: duplicateWindowStart },
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.notification.create({
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
      metadata: input.metadata,
      snoozedUntil: input.snoozedUntil ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true },
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
  const dueLabel = args.dueDate ? `Due ${args.dueDate.toLocaleDateString()}` : "No due date";
  const byLabel = args.assignedByName ? `Assigned by ${args.assignedByName}` : "New task assignment";

  await createNotification({
    organizationId: args.organizationId,
    userId: args.assigneeId,
    module: "donor",
    sourceType: "task-assigned",
    sourceId: args.taskId,
    title: `Task assigned: ${args.taskTitle}`,
    message: `${byLabel} · ${dueLabel}`,
    href: `/tasks?taskId=${args.taskId}&focus=my`,
    severity: "HIGH",
    actionLabel: "Open task",
  });
}

export async function createTaskOverdueNotification(args: {
  organizationId: string;
  assigneeId: string;
  taskId: string;
  taskTitle: string;
}) {
  await createNotification({
    organizationId: args.organizationId,
    userId: args.assigneeId,
    module: "donor",
    sourceType: "task-overdue",
    sourceId: args.taskId,
    title: `Task overdue: ${args.taskTitle}`,
    message: "This task is now overdue and needs attention.",
    href: `/tasks?taskId=${args.taskId}&focus=overdue`,
    severity: "HIGH",
    actionLabel: "Review overdue",
  });
}
