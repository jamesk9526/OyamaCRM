// Service layer for EventSTUDIO seat operations.
import { prisma } from "../lib/prisma.js";

export async function assignGuestToSeat(input: { eventId: string; seatId: string; guestId: string }) {
  const seat = await prisma.eventTableSeat.findFirst({ where: { id: input.seatId, eventId: input.eventId } });
  if (!seat) throw new Error("Seat not found for event.");

  const guest = await prisma.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId } });
  if (!guest) throw new Error("Guest not found for event.");

  await prisma.$transaction([
    prisma.eventGuest.update({
      where: { id: guest.id },
      data: { tableId: seat.tableId, seatId: seat.id, seatNumber: seat.seatNumber },
    }),
    prisma.eventTableSeat.update({ where: { id: seat.id }, data: { status: "RESERVED" } }),
  ]);

  return prisma.eventTableSeat.findUnique({ where: { id: seat.id }, include: { guest: true } });
}

export async function clearSeat(input: { eventId: string; seatId: string }) {
  const seat = await prisma.eventTableSeat.findFirst({ where: { id: input.seatId, eventId: input.eventId }, include: { guest: true } });
  if (!seat) throw new Error("Seat not found for event.");

  await prisma.$transaction(async (tx) => {
    if (seat.guest?.id) {
      await tx.eventGuest.update({ where: { id: seat.guest.id }, data: { seatId: null, seatNumber: null } });
    }
    await tx.eventTableSeat.update({ where: { id: seat.id }, data: { status: "EMPTY" } });
  });

  return prisma.eventTableSeat.findUnique({ where: { id: seat.id }, include: { guest: true } });
}

export async function moveGuestToSeat(input: { eventId: string; guestId: string; toSeatId: string }) {
  const toSeat = await prisma.eventTableSeat.findFirst({ where: { id: input.toSeatId, eventId: input.eventId } });
  if (!toSeat) throw new Error("Destination seat not found.");

  const guest = await prisma.eventGuest.findFirst({ where: { id: input.guestId, eventId: input.eventId } });
  if (!guest) throw new Error("Guest not found.");

  await prisma.$transaction(async (tx) => {
    if (guest.seatId) {
      await tx.eventTableSeat.update({ where: { id: guest.seatId }, data: { status: "EMPTY" } });
    }
    await tx.eventGuest.update({
      where: { id: guest.id },
      data: { tableId: toSeat.tableId, seatId: toSeat.id, seatNumber: toSeat.seatNumber },
    });
    await tx.eventTableSeat.update({ where: { id: toSeat.id }, data: { status: "RESERVED" } });
  });

  return prisma.eventGuest.findUnique({ where: { id: guest.id }, include: { table: true, seat: true } });
}
