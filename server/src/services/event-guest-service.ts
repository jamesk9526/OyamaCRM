// Service layer for EventSTUDIO guest lifecycle and event-scoped search.
import type { EventGuestSource, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

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
  const seat = input.seatId
    ? await prisma.eventTableSeat.findFirst({ where: { id: input.seatId, eventId: input.eventId }, select: { id: true, seatNumber: true, tableId: true } })
    : null;

  const guest = await prisma.eventGuest.create({
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
      checkinCode: await generateCheckinCode(),
    },
  });

  if (seat?.id) {
    await prisma.eventTableSeat.update({ where: { id: seat.id }, data: { status: "RESERVED" } });
  }

  return guest;
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
