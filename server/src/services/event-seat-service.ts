// Service layer for EventSTUDIO seat operations.
import { prisma } from "../lib/prisma.js";

export type EventSeatServiceErrorCode =
  | "SEAT_NOT_FOUND"
  | "GUEST_NOT_FOUND"
  | "TABLE_NOT_FOUND"
  | "SEAT_OCCUPIED"
  | "TABLE_FULL";

export class EventSeatServiceError extends Error {
  constructor(
    public readonly code: EventSeatServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EventSeatServiceError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function seatStatusForGuest(guest: { checkedIn: boolean; rsvpStatus: string }) {
  if (guest.checkedIn) return "CHECKED_IN" as const;
  if (guest.rsvpStatus === "CONFIRMED") return "CONFIRMED" as const;
  return "RESERVED" as const;
}

async function placeGuestInSeat(input: { eventId: string; seatId: string; guestId: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const seat = await tx.eventTableSeat.findFirst({
        where: { id: input.seatId, eventId: input.eventId },
        include: { guest: { select: { id: true } } },
      });
      if (!seat) throw new EventSeatServiceError("SEAT_NOT_FOUND", "Seat not found for this event.");

      const guest = await tx.eventGuest.findFirst({
        where: { id: input.guestId, eventId: input.eventId },
      });
      if (!guest) throw new EventSeatServiceError("GUEST_NOT_FOUND", "Guest not found for this event.");

      if (seat.guest && seat.guest.id !== guest.id) {
        throw new EventSeatServiceError("SEAT_OCCUPIED", `Seat ${seat.seatNumber} is already assigned to another guest.`);
      }

      if (guest.seatId && guest.seatId !== seat.id) {
        await tx.eventTableSeat.updateMany({
          where: { id: guest.seatId, eventId: input.eventId },
          data: { status: "EMPTY" },
        });
      }

      await tx.eventGuest.update({
        where: { id: guest.id },
        data: { tableId: seat.tableId, seatId: seat.id, seatNumber: seat.seatNumber },
      });
      await tx.eventTableSeat.update({
        where: { id: seat.id },
        data: { status: seatStatusForGuest(guest) },
      });

      return { seatId: seat.id, guestId: guest.id };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EventSeatServiceError("SEAT_OCCUPIED", "That seat was assigned to another guest. Refresh the table and choose another seat.");
    }
    throw error;
  }
}

export async function assignGuestToSeat(input: { eventId: string; seatId: string; guestId: string }) {
  const assignment = await placeGuestInSeat(input);
  return prisma.eventTableSeat.findUnique({
    where: { id: assignment.seatId },
    include: { guest: true },
  });
}

export async function assignGuestToOpenTableSeat(input: { eventId: string; tableId: string; guestId: string }) {
  let assignment: { seatId: string; guestId: string };
  try {
    assignment = await prisma.$transaction(async (tx) => {
      const table = await tx.eventTable.findFirst({
        where: { id: input.tableId, eventId: input.eventId },
        include: {
          seats: {
            include: { guest: { select: { id: true } } },
            orderBy: { seatNumber: "asc" },
          },
        },
      });
      if (!table) throw new EventSeatServiceError("TABLE_NOT_FOUND", "Table not found for this event.");

      const guest = await tx.eventGuest.findFirst({
        where: { id: input.guestId, eventId: input.eventId },
      });
      if (!guest) throw new EventSeatServiceError("GUEST_NOT_FOUND", "Guest not found for this event.");

      const currentSeat = guest.seatId
        ? table.seats.find((seat) => seat.id === guest.seatId && seat.guest?.id === guest.id)
        : undefined;
      if (currentSeat) {
        await tx.eventTableSeat.update({
          where: { id: currentSeat.id },
          data: { status: seatStatusForGuest(guest) },
        });
        return { seatId: currentSeat.id, guestId: guest.id };
      }

      const otherGuestsAtTable = await tx.eventGuest.count({
        where: { tableId: table.id, id: { not: guest.id } },
      });
      if (otherGuestsAtTable >= table.capacity) {
        throw new EventSeatServiceError("TABLE_FULL", `${table.name} is full. Increase its capacity or choose another table.`);
      }

      const seatNumbers = new Set(table.seats.map((seat) => seat.seatNumber));
      const missingSeatNumbers = Array.from({ length: table.capacity }, (_unused, index) => index + 1)
        .filter((seatNumber) => !seatNumbers.has(seatNumber));
      if (missingSeatNumbers.length > 0) {
        await tx.eventTableSeat.createMany({
          data: missingSeatNumbers.map((seatNumber) => ({
            eventId: table.eventId,
            tableId: table.id,
            seatNumber,
            status: "EMPTY" as const,
          })),
        });
      }

      const seats = missingSeatNumbers.length > 0
        ? await tx.eventTableSeat.findMany({
            where: { tableId: table.id },
            include: { guest: { select: { id: true } } },
            orderBy: { seatNumber: "asc" },
          })
        : table.seats;
      const openSeat = seats.find((seat) => !seat.guest && seat.seatNumber <= table.capacity);
      if (!openSeat) {
        throw new EventSeatServiceError("TABLE_FULL", `${table.name} has no available seats. Sync its seats or choose another table.`);
      }

      if (guest.seatId) {
        await tx.eventTableSeat.updateMany({
          where: { id: guest.seatId, eventId: input.eventId },
          data: { status: "EMPTY" },
        });
      }

      await tx.eventGuest.update({
        where: { id: guest.id },
        data: { tableId: table.id, seatId: openSeat.id, seatNumber: openSeat.seatNumber },
      });
      await tx.eventTableSeat.update({
        where: { id: openSeat.id },
        data: { status: seatStatusForGuest(guest) },
      });

      return { seatId: openSeat.id, guestId: guest.id };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EventSeatServiceError("SEAT_OCCUPIED", "The last open seat was just assigned. Refresh the table and try again.");
    }
    throw error;
  }

  return prisma.eventGuest.findUnique({
    where: { id: assignment.guestId },
    include: { table: true, seat: true },
  });
}

export async function unassignGuestFromTable(input: { eventId: string; guestId: string }) {
  return prisma.$transaction(async (tx) => {
    const guest = await tx.eventGuest.findFirst({
      where: { id: input.guestId, eventId: input.eventId },
    });
    if (!guest) throw new EventSeatServiceError("GUEST_NOT_FOUND", "Guest not found for this event.");

    if (guest.seatId) {
      await tx.eventTableSeat.updateMany({
        where: { id: guest.seatId, eventId: input.eventId },
        data: { status: "EMPTY" },
      });
    }

    return tx.eventGuest.update({
      where: { id: guest.id },
      data: { tableId: null, seatId: null, seatNumber: null },
      include: { table: true, seat: true },
    });
  });
}

export async function clearSeat(input: { eventId: string; seatId: string }) {
  const clearedSeatId = await prisma.$transaction(async (tx) => {
    const seat = await tx.eventTableSeat.findFirst({
      where: { id: input.seatId, eventId: input.eventId },
      include: { guest: true },
    });
    if (!seat) throw new EventSeatServiceError("SEAT_NOT_FOUND", "Seat not found for this event.");

    if (seat.guest?.id) {
      await tx.eventGuest.update({
        where: { id: seat.guest.id },
        data: { seatId: null, seatNumber: null },
      });
    }
    await tx.eventTableSeat.update({ where: { id: seat.id }, data: { status: "EMPTY" } });
    return seat.id;
  });

  return prisma.eventTableSeat.findUnique({ where: { id: clearedSeatId }, include: { guest: true } });
}

export async function moveGuestToSeat(input: { eventId: string; guestId: string; toSeatId: string }) {
  const assignment = await placeGuestInSeat({
    eventId: input.eventId,
    guestId: input.guestId,
    seatId: input.toSeatId,
  });
  return prisma.eventGuest.findUnique({
    where: { id: assignment.guestId },
    include: { table: true, seat: true },
  });
}
