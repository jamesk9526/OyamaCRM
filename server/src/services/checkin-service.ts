// Service layer for auditable EventSTUDIO check-in flows.
import type { EventCheckInMethod, EventCheckInStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function hasActiveCheckIn(eventId: string, guestId: string): Promise<boolean> {
  const existing = await prisma.eventCheckInRecord.findFirst({
    where: {
      eventId,
      guestId,
      status: "CHECKED_IN",
      reversedAt: null,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function createCheckInRecord(input: {
  eventId: string;
  guestId: string;
  method: EventCheckInMethod;
  checkedInByUserId?: string;
  checkInDeviceId?: string;
  notes?: string;
}) {
  const duplicate = await hasActiveCheckIn(input.eventId, input.guestId);
  if (duplicate) {
    return prisma.eventCheckInRecord.create({
      data: {
        eventId: input.eventId,
        guestId: input.guestId,
        method: input.method,
        status: "DUPLICATE_ATTEMPT",
        checkedInByUserId: input.checkedInByUserId,
        checkInDeviceId: input.checkInDeviceId,
        notes: input.notes,
      },
    });
  }

  const guest = await prisma.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId } });
  if (!guest) throw new Error("Guest not found for event.");

  const record = await prisma.eventCheckInRecord.create({
    data: {
      eventId: input.eventId,
      guestId: input.guestId,
      tableId: guest.tableId,
      seatId: guest.seatId,
      method: input.method,
      status: "CHECKED_IN",
      checkedInByUserId: input.checkedInByUserId,
      checkInDeviceId: input.checkInDeviceId,
      notes: input.notes,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.eventGuest.update({ where: { id: guest.id }, data: { checkedIn: true, checkedInAt: new Date(), rsvpStatus: "CONFIRMED" } });
    if (guest.seatId) {
      await tx.eventTableSeat.update({ where: { id: guest.seatId }, data: { status: "CHECKED_IN" } });
    }
  });

  return record;
}

export async function reverseCheckIn(input: {
  eventId: string;
  guestId: string;
  reversedByUserId?: string;
  notes?: string;
}) {
  const activeRecord = await prisma.eventCheckInRecord.findFirst({
    where: { eventId: input.eventId, guestId: input.guestId, status: "CHECKED_IN", reversedAt: null },
    orderBy: { checkedInAt: "desc" },
  });
  if (!activeRecord) return null;

  await prisma.$transaction(async (tx) => {
    await tx.eventCheckInRecord.update({
      where: { id: activeRecord.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedByUserId: input.reversedByUserId,
        notes: input.notes ?? activeRecord.notes,
      },
    });

    const guest = await tx.eventGuest.findUnique({ where: { id: input.guestId }, select: { id: true, seatId: true } });
    if (guest) {
      await tx.eventGuest.update({ where: { id: guest.id }, data: { checkedIn: false, checkedInAt: null } });
      if (guest.seatId) {
        await tx.eventTableSeat.update({ where: { id: guest.seatId }, data: { status: "CONFIRMED" } });
      }
    }
  });

  return prisma.eventCheckInRecord.findUnique({ where: { id: activeRecord.id } });
}

export async function getCheckInLiveCounts(eventId: string) {
  const [expected, checkedIn, walkIns, replacements, openExceptions] = await Promise.all([
    prisma.eventGuest.count({ where: { eventId } }),
    prisma.eventGuest.count({ where: { eventId, checkedIn: true } }),
    prisma.eventGuest.count({ where: { eventId, source: "WALK_IN" } }),
    prisma.eventGuest.count({ where: { eventId, source: "REPLACEMENT" } }),
    prisma.eventCheckInException.count({ where: { eventId, status: "OPEN" } }),
  ]);

  return {
    expected,
    checkedIn,
    walkIns,
    replacements,
    openExceptions,
    attendanceRate: expected > 0 ? Math.round((checkedIn / expected) * 1000) / 10 : 0,
  };
}

export async function listCheckInRecords(eventId: string, status?: EventCheckInStatus) {
  return prisma.eventCheckInRecord.findMany({
    where: {
      eventId,
      ...(status ? { status } : {}),
    },
    include: {
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      table: { select: { id: true, name: true, tableUid: true, publicCode: true } },
      seat: { select: { id: true, seatNumber: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });
}
