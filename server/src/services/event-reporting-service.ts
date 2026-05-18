// Service layer for EventSTUDIO reporting snapshots.
import { prisma } from "../lib/prisma.js";

export async function getEventReportingSnapshot(eventId: string) {
  const [
    expectedGuests,
    confirmedGuests,
    checkedInGuests,
    noShowGuests,
    walkIns,
    replacements,
    openExceptions,
    resolvedExceptions,
    queuedEmails,
    sentEmails,
    failedEmails,
  ] = await Promise.all([
    prisma.eventGuest.count({ where: { eventId } }),
    prisma.eventGuest.count({ where: { eventId, rsvpStatus: "CONFIRMED" } }),
    prisma.eventGuest.count({ where: { eventId, checkedIn: true } }),
    prisma.eventGuest.count({ where: { eventId, checkedIn: false, rsvpStatus: "CONFIRMED" } }),
    prisma.eventGuest.count({ where: { eventId, source: "WALK_IN" } }),
    prisma.eventGuest.count({ where: { eventId, source: "REPLACEMENT" } }),
    prisma.eventCheckInException.count({ where: { eventId, status: "OPEN" } }),
    prisma.eventCheckInException.count({ where: { eventId, status: "RESOLVED" } }),
    prisma.eventEmailLog.count({ where: { eventId, status: "QUEUED" } }),
    prisma.eventEmailLog.count({ where: { eventId, status: "SENT" } }),
    prisma.eventEmailLog.count({ where: { eventId, status: "FAILED" } }),
  ]);

  const tableStats = await prisma.eventTable.findMany({
    where: { eventId },
    include: {
      _count: { select: { guests: true, seats: true } },
      seats: { select: { status: true } },
    },
  });

  const tableCompletion = tableStats.map((table) => {
    const capacity = table.capacity;
    const confirmed = table.seats.filter((seat) => ["CONFIRMED", "CHECKED_IN"].includes(seat.status)).length;
    return {
      tableId: table.id,
      tableName: table.name,
      tableUid: table.tableUid,
      publicCode: table.publicCode,
      capacity,
      confirmed,
      completionRate: capacity > 0 ? Math.round((confirmed / capacity) * 1000) / 10 : 0,
    };
  });

  return {
    expectedGuests,
    confirmedGuests,
    checkedInGuests,
    noShowGuests,
    walkIns,
    replacements,
    openExceptions,
    resolvedExceptions,
    email: {
      queued: queuedEmails,
      sent: sentEmails,
      failed: failedEmails,
    },
    tableCompletion,
    attendanceRate: expectedGuests > 0 ? Math.round((checkedInGuests / expectedGuests) * 1000) / 10 : 0,
  };
}
