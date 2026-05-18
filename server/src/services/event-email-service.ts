// Service layer for event email logging and status updates.
import type { EventEmailLogStatus, EventEmailLogType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function createEventEmailLog(input: {
  eventId: string;
  tableId?: string;
  guestId?: string;
  inviteId?: string;
  type: EventEmailLogType;
  recipientEmail: string;
  subject?: string;
}) {
  return prisma.eventEmailLog.create({
    data: {
      eventId: input.eventId,
      tableId: input.tableId,
      guestId: input.guestId,
      inviteId: input.inviteId,
      type: input.type,
      recipientEmail: input.recipientEmail.toLowerCase(),
      subject: input.subject,
      status: "QUEUED",
      queuedAt: new Date(),
    },
  });
}

export async function setEventEmailLogStatus(logId: string, status: EventEmailLogStatus, errorMessage?: string) {
  return prisma.eventEmailLog.update({
    where: { id: logId },
    data: {
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
      openedAt: status === "OPENED" ? new Date() : undefined,
      errorMessage: errorMessage ?? undefined,
    },
  });
}

export async function listEventEmailLogs(eventId: string) {
  return prisma.eventEmailLog.findMany({
    where: { eventId },
    include: {
      table: { select: { id: true, name: true, tableUid: true, publicCode: true } },
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      invite: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
