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
  return prisma.$transaction(async (tx) => {
    const guest = await tx.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId } });
    if (!guest) throw new Error("Guest not found for event.");

    // The conditional write locks this guest through commit. Concurrent desks
    // cannot both create an active attendance record, and record failures roll
    // back the guest and seat changes together.
    const claimed = await tx.eventGuest.updateMany({
      where: { id: guest.id, eventId: input.eventId, checkedIn: false },
      data: { checkedIn: true, checkedInAt: new Date(), rsvpStatus: "CONFIRMED" },
    });
    const record = await tx.eventCheckInRecord.create({
      data: {
        eventId: input.eventId,
        guestId: guest.id,
        tableId: guest.tableId,
        seatId: guest.seatId,
        method: input.method,
        status: claimed.count === 0 ? "DUPLICATE_ATTEMPT" : "CHECKED_IN",
        checkedInByUserId: input.checkedInByUserId,
        checkInDeviceId: input.checkInDeviceId,
        notes: input.notes,
      },
    });
    if (claimed.count > 0 && guest.seatId) {
      await tx.eventTableSeat.updateMany({
        where: { id: guest.seatId, eventId: input.eventId, guest: { id: guest.id } },
        data: { status: "CHECKED_IN" },
      });
    }
    return record;
  });
}

export async function reverseCheckIn(input: {
  eventId: string;
  guestId: string;
  reversedByUserId?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const guest = await tx.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId } });
    if (!guest) return null;
    const claimed = await tx.eventGuest.updateMany({
      where: { id: guest.id, eventId: input.eventId, checkedIn: true },
      data: { checkedIn: false, checkedInAt: null },
    });
    if (claimed.count === 0) return null;

    const where = { eventId: input.eventId, guestId: guest.id, status: "CHECKED_IN" as const, reversedAt: null };
    const activeRecord = await tx.eventCheckInRecord.findFirst({ where, orderBy: { checkedInAt: "desc" } });
    const reversal = {
      status: "REVERSED" as const,
      reversedAt: new Date(),
      reversedByUserId: input.reversedByUserId,
      notes: input.notes ?? activeRecord?.notes,
    };
    await tx.eventCheckInRecord.updateMany({ where, data: reversal });
    if (guest.seatId) {
      await tx.eventTableSeat.updateMany({
        where: { id: guest.seatId, eventId: input.eventId, guest: { id: guest.id } },
        data: { status: "CONFIRMED" },
      });
    }
    if (activeRecord) return { ...activeRecord, ...reversal };

    // Imports and older guest editors can set checkedIn without creating a
    // record. Preserve that attendance history while still allowing reversal.
    return tx.eventCheckInRecord.create({
      data: {
        eventId: input.eventId,
        guestId: guest.id,
        tableId: guest.tableId,
        seatId: guest.seatId,
        method: "MANUAL",
        checkedInAt: guest.checkedInAt ?? new Date(),
        ...reversal,
      },
    });
  });
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
