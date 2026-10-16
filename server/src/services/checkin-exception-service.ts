// Service layer for EventSTUDIO check-in exception queue.
import type { EventCheckInExceptionIssueType, EventCheckInExceptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { EventSeatServiceError } from "./event-seat-service.js";

export async function createCheckInException(input: {
  eventId: string;
  guestId?: string;
  tableId?: string;
  seatId?: string;
  guestName?: string;
  claimedTable?: string;
  claimedEmail?: string;
  claimedPhone?: string;
  issueType: EventCheckInExceptionIssueType;
  notes?: string;
  createdByUserId?: string;
}) {
  const [guest, table, seat] = await Promise.all([
    input.guestId ? prisma.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId }, select: { id: true } }) : null,
    input.tableId ? prisma.eventTable.findFirst({ where: { id: input.tableId, eventId: input.eventId }, select: { id: true } }) : null,
    input.seatId ? prisma.eventTableSeat.findFirst({
      where: { id: input.seatId, eventId: input.eventId, ...(input.tableId ? { tableId: input.tableId } : {}) },
      select: { id: true },
    }) : null,
  ]);
  if (input.guestId && !guest) throw new EventSeatServiceError("GUEST_NOT_FOUND", "Guest not found for this event.");
  if (input.tableId && !table) throw new EventSeatServiceError("TABLE_NOT_FOUND", "Table not found for this event.");
  if (input.seatId && !seat) throw new EventSeatServiceError("SEAT_NOT_FOUND", "Seat not found for this event and table.");

  return prisma.eventCheckInException.create({
    data: {
      eventId: input.eventId,
      guestId: input.guestId,
      tableId: input.tableId,
      seatId: input.seatId,
      guestName: input.guestName,
      claimedTable: input.claimedTable,
      claimedEmail: input.claimedEmail,
      claimedPhone: input.claimedPhone,
      issueType: input.issueType,
      notes: input.notes,
      createdByUserId: input.createdByUserId,
      status: "OPEN",
    },
  });
}

export async function listCheckInExceptions(eventId: string, status?: EventCheckInExceptionStatus) {
  return prisma.eventCheckInException.findMany({
    where: {
      eventId,
      ...(status ? { status } : {}),
    },
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      table: { select: { id: true, name: true, publicCode: true } },
      seat: { select: { id: true, seatNumber: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function resolveCheckInException(input: {
  exceptionId: string;
  eventId: string;
  organizationId: string;
  resolvedByUserId?: string;
  notes?: string;
}) {
  const existing = await prisma.eventCheckInException.findFirst({
    where: { id: input.exceptionId, eventId: input.eventId, event: { organizationId: input.organizationId } },
  });
  if (!existing) return null;

  return prisma.eventCheckInException.update({
    where: { id: input.exceptionId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: input.resolvedByUserId,
      notes: input.notes ?? existing.notes,
    },
  });
}

export async function dismissCheckInException(input: {
  exceptionId: string;
  eventId: string;
  organizationId: string;
  resolvedByUserId?: string;
  notes?: string;
}) {
  const existing = await prisma.eventCheckInException.findFirst({
    where: { id: input.exceptionId, eventId: input.eventId, event: { organizationId: input.organizationId } },
  });
  if (!existing) return null;

  return prisma.eventCheckInException.update({
    where: { id: input.exceptionId },
    data: {
      status: "DISMISSED",
      resolvedAt: new Date(),
      resolvedByUserId: input.resolvedByUserId,
      notes: input.notes ?? existing.notes,
    },
  });
}
