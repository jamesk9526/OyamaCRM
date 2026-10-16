// Service layer for EventSTUDIO guest lifecycle and event-scoped search.
import type { EventGuestSource, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { EventSeatServiceError } from "./event-seat-service.js";

async function generateCheckinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: code } });
    if (!existing) return code;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

export async function createEventGuest(input: {
  eventId: string;
  tableId?: string;
  seatId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: EventGuestSource;
  rsvpStatus?: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLIST";
  mealPreference?: string;
  dietaryRestrictions?: string;
  specialNeeds?: string;
  notes?: string;
}) {
  const checkinCode = await generateCheckinCode();
  return prisma.$transaction(async (tx) => {
    let seat = input.seatId
      ? await tx.eventTableSeat.findFirst({
          where: { id: input.seatId, eventId: input.eventId, ...(input.tableId ? { tableId: input.tableId } : {}) },
          include: { guest: { select: { id: true } } },
        })
      : null;
    if (input.seatId && !seat) throw new EventSeatServiceError("SEAT_NOT_FOUND", "Seat not found for this event and table.");
    if (seat?.guest) throw new EventSeatServiceError("SEAT_OCCUPIED", "That seat is already assigned to another guest.");

    const tableId = seat?.tableId ?? input.tableId;
    if (tableId) {
      const table = await tx.eventTable.findFirst({ where: { id: tableId, eventId: input.eventId } });
      if (!table) throw new EventSeatServiceError("TABLE_NOT_FOUND", "Table not found for this event.");
      const occupied = await tx.eventGuest.count({ where: { eventId: input.eventId, tableId: table.id, seatId: { not: null } } });
      if (occupied >= table.capacity || (seat && seat.seatNumber > table.capacity)) {
        throw new EventSeatServiceError("TABLE_FULL", `${table.name} is full. Choose another table.`);
      }
      if (!seat) {
        const seats = await tx.eventTableSeat.findMany({ where: { tableId: table.id }, select: { seatNumber: true } });
        const existingNumbers = new Set(seats.map((entry) => entry.seatNumber));
        const missing = Array.from({ length: table.capacity }, (_, index) => index + 1).filter((number) => !existingNumbers.has(number));
        if (missing.length) {
          await tx.eventTableSeat.createMany({
            data: missing.map((seatNumber) => ({ eventId: input.eventId, tableId: table.id, seatNumber })),
            skipDuplicates: true,
          });
        }
        seat = await tx.eventTableSeat.findFirst({
          where: { eventId: input.eventId, tableId: table.id, seatNumber: { lte: table.capacity }, guest: null },
          orderBy: { seatNumber: "asc" },
          include: { guest: { select: { id: true } } },
        });
        if (!seat) throw new EventSeatServiceError("TABLE_FULL", `${table.name} has no open seats. Choose another table.`);
      }
    }

    const guest = await tx.eventGuest.create({
      data: {
        eventId: input.eventId,
        tableId: seat?.tableId ?? input.tableId,
        seatId: seat?.id,
        seatNumber: seat?.seatNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: input.source ?? "ADMIN",
        rsvpStatus: input.rsvpStatus ?? "PENDING",
        mealPreference: input.mealPreference,
        dietaryRestrictions: input.dietaryRestrictions,
        specialNeeds: input.specialNeeds,
        notes: input.notes,
        checkinCode,
      },
    });

    if (seat?.id) {
      await tx.eventTableSeat.update({ where: { id: seat.id }, data: { status: input.rsvpStatus === "CONFIRMED" ? "CONFIRMED" : "RESERVED" } });
    }

    return guest;
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error) {
      const target = "meta" in error ? JSON.stringify(error.meta) : "";
      if (error.code === "P2002" && target.includes("seatId")) {
        throw new EventSeatServiceError("SEAT_OCCUPIED", "That seat was just assigned to another guest. Choose another seat or table.");
      }
    }
    throw error;
  });
}

export async function updateEventGuest(guestId: string, data: Prisma.EventGuestUpdateInput) {
  return prisma.eventGuest.update({ where: { id: guestId }, data });
}

export async function createWalkInGuest(input: {
  eventId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tableId?: string;
  seatId?: string;
  notes?: string;
}) {
  return createEventGuest({
    eventId: input.eventId,
    tableId: input.tableId,
    seatId: input.seatId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    source: "WALK_IN",
    rsvpStatus: "CONFIRMED",
    notes: input.notes,
  });
}

export async function listEventGuests(eventId: string, search?: string) {
  const normalizedSearch = search?.trim();
  return prisma.eventGuest.findMany({
    where: {
      eventId,
      ...(normalizedSearch
        ? {
            OR: [
              { firstName: { contains: normalizedSearch } },
              { lastName: { contains: normalizedSearch } },
              { email: { contains: normalizedSearch } },
              { phone: { contains: normalizedSearch } },
              { checkinCode: { contains: normalizedSearch.toUpperCase() } },
              { table: { name: { contains: normalizedSearch } } },
            ],
          }
        : {}),
    },
    include: {
      table: { select: { id: true, name: true, tableUid: true, publicCode: true } },
      seat: { select: { id: true, seatNumber: true, status: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
