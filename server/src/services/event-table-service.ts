// Service layer for EventSTUDIO table operations, including TableLink identifiers.
import { randomUUID } from "crypto";
import type { EventTableStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function generateTableUid(): string {
  return `tbl_${randomUUID().replace(/-/g, "")}`;
}

function generatePublicCode(): string {
  const fragment = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 8);
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 6);
  return `TBL-${fragment}-${suffix}`;
}

async function ensureUniquePublicCode(eventId: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generatePublicCode();
    const existing = await prisma.eventTable.findFirst({ where: { eventId, publicCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  return `TBL-${Date.now().toString(36).toUpperCase()}`;
}

export async function listEventTables(eventId: string) {
  return prisma.eventTable.findMany({
    where: { eventId },
    include: {
      seats: { orderBy: { seatNumber: "asc" } },
      guests: true,
      _count: { select: { seats: true, guests: true } },
    },
    orderBy: [{ tableNumber: "asc" }, { name: "asc" }],
  });
}

export async function createEventTable(input: {
  eventId: string;
  name: string;
  capacity?: number;
  notes?: string | null;
  tableNumber?: number | null;
  isSponsored?: boolean;
  sponsorName?: string | null;
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
  shape?: string;
  xPosition?: number;
  yPosition?: number;
}) {
  const publicCode = await ensureUniquePublicCode(input.eventId);
  const table = await prisma.eventTable.create({
    data: {
      eventId: input.eventId,
      tableUid: generateTableUid(),
      publicCode,
      name: input.name,
      capacity: input.capacity ?? 10,
      notes: input.notes ?? undefined,
      tableNumber: input.tableNumber ?? undefined,
      isSponsored: input.isSponsored ?? false,
      sponsorName: input.sponsorName ?? undefined,
      hostName: input.hostName ?? undefined,
      hostEmail: input.hostEmail ?? undefined,
      hostPhone: input.hostPhone ?? undefined,
      shape: input.shape ?? "round",
      xPosition: input.xPosition ?? 0,
      yPosition: input.yPosition ?? 0,
      status: "DRAFT",
    },
  });

  if ((input.capacity ?? 10) > 0) {
    const seats = Array.from({ length: input.capacity ?? 10 }, (_v, i) => ({
      eventId: input.eventId,
      tableId: table.id,
      seatNumber: i + 1,
      status: "EMPTY" as const,
    }));
    await prisma.eventTableSeat.createMany({ data: seats });
  }

  return prisma.eventTable.findUnique({
    where: { id: table.id },
    include: { seats: { orderBy: { seatNumber: "asc" } }, guests: true },
  });
}

export async function updateEventTable(tableId: string, data: Prisma.EventTableUpdateInput) {
  return prisma.eventTable.update({ where: { id: tableId }, data });
}

export async function setEventTableStatus(tableId: string, status: EventTableStatus) {
  return prisma.eventTable.update({ where: { id: tableId }, data: { status } });
}

export async function syncEventTableSeats(tableId: string) {
  const table = await prisma.eventTable.findUnique({
    where: { id: tableId },
    include: { seats: { include: { guest: { select: { id: true } } }, orderBy: { seatNumber: "asc" } } },
  });
  if (!table) return null;

  const target = Math.max(0, table.capacity);
  const current = table.seats.length;

  if (target > current) {
    await prisma.eventTableSeat.createMany({
      data: Array.from({ length: target - current }, (_v, idx) => ({
        eventId: table.eventId,
        tableId: table.id,
        seatNumber: current + idx + 1,
        status: "EMPTY" as const,
      })),
    });
  } else if (target < current) {
    const removable = table.seats
      .slice(target)
      .filter((seat) => !seat.guest)
      .map((seat) => seat.id);

    if (removable.length > 0) {
      await prisma.eventTableSeat.deleteMany({ where: { id: { in: removable } } });
    }
  }

  return prisma.eventTable.findUnique({
    where: { id: tableId },
    include: { seats: { orderBy: { seatNumber: "asc" } }, guests: true },
  });
}
