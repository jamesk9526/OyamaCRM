import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class TableMergeError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

/** Move existing records, keeping their IDs and financial links, atomically. */
export async function mergeEventTables(input: { organizationId: string; sourceId: string; targetId: string }) {
  if (input.sourceId === input.targetId) throw new TableMergeError(400, "Choose a different table to keep.");
  return prisma.$transaction(async (tx) => {
    const tables = await tx.eventTable.findMany({
      where: { id: { in: [input.sourceId, input.targetId] }, event: { organizationId: input.organizationId } },
      include: { seats: { orderBy: { seatNumber: "asc" } }, triviaTeam: true },
    });
    const source = tables.find((table) => table.id === input.sourceId);
    const target = tables.find((table) => table.id === input.targetId);
    if (!source || !target) throw new TableMergeError(404, "One of these tables is no longer available.");
    if (source.eventId !== target.eventId) throw new TableMergeError(400, "Tables must belong to the same event.");
    const offset = Math.max(target.capacity, ...target.seats.map((seat) => seat.seatNumber));
    const sourceSize = Math.max(source.capacity, ...source.seats.map((seat) => seat.seatNumber));
    const capacity = offset + sourceSize;
    if (capacity > 500) throw new TableMergeError(400, "The merged table would exceed the 500-seat limit.");
    await tx.auditLog.create({ data: {
      action: "EVENT_TABLE_MERGED", entity: "EventTable", entityId: target.id,
      organizationId: input.organizationId,
      metadata: JSON.parse(JSON.stringify({ source, keptTableId: target.id, keptTableNumber: target.tableNumber })),
    } });

    // Appending seat numbers preserves every seat and avoids unique-key collisions.
    for (const seat of source.seats) {
      const seatNumber = offset + seat.seatNumber;
      await tx.eventTableSeat.update({ where: { id: seat.id }, data: { tableId: target.id, seatNumber } });
      await tx.eventGuest.updateMany({ where: { seatId: seat.id, eventId: source.eventId }, data: { tableId: target.id, seatNumber } });
    }
    await tx.eventGuest.updateMany({ where: { tableId: source.id }, data: { tableId: target.id } });
    await tx.eventGuestInvite.updateMany({ where: { tableId: source.id }, data: { tableId: target.id } });
    await tx.eventCheckInRecord.updateMany({ where: { tableId: source.id }, data: { tableId: target.id } });
    await tx.eventCheckInException.updateMany({ where: { tableId: source.id }, data: { tableId: target.id } });
    await tx.eventEmailLog.updateMany({ where: { tableId: source.id }, data: { tableId: target.id } });
    // Preserve access history without granting the former host access to the kept table.
    await tx.eventTableAccessToken.updateMany({ where: { tableId: source.id }, data: { tableId: target.id, status: "REVOKED" } });

    // A seating merge never combines or deletes an existing game's scores.
    if (source.triviaTeam) {
      const raw = source.triviaTeam.payload;
      const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
      delete payload.eventsTableId;
      await tx.triviaTeam.update({ where: { id: source.triviaTeam.id }, data: {
        eventTableId: null,
        payload: { ...payload, eventsTableMergedIntoId: target.id },
      } });
    }
    const sourceNotes = [
      `Merged from Table ${source.tableNumber ?? ""}: ${source.name}`,
      source.hostName ? `Former host: ${source.hostName}` : null,
      source.hostEmail ? `Former host email: ${source.hostEmail}` : null,
      source.hostPhone ? `Former host phone: ${source.hostPhone}` : null,
      source.sponsorName ? `Former sponsor: ${source.sponsorName}` : null,
      source.notes,
    ].filter(Boolean).join("\n");
    const kept = await tx.eventTable.update({ where: { id: target.id }, data: {
      capacity, notes: [target.notes, sourceNotes].filter(Boolean).join("\n\n"),
    } });
    await tx.eventTable.delete({ where: { id: source.id } });
    return { table: kept, removedTableId: source.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}
