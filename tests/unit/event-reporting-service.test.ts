import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/src/lib/prisma";
import { getEventReportingSnapshot } from "@/server/src/services/event-reporting-service";

let organizationId = "";

beforeAll(async () => {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  organizationId = String(org?.id ?? "org_demo");
});

describe("event-reporting-service", () => {
  it("returns zeroed snapshot for an unknown event", async () => {
    const snapshot = await getEventReportingSnapshot(`missing-${randomUUID()}`);
    expect(snapshot.expectedGuests).toBe(0);
    expect(snapshot.confirmedGuests).toBe(0);
    expect(snapshot.checkedInGuests).toBe(0);
    expect(snapshot.noShowGuests).toBe(0);
    expect(snapshot.walkIns).toBe(0);
    expect(snapshot.replacements).toBe(0);
    expect(snapshot.openExceptions).toBe(0);
    expect(snapshot.resolvedExceptions).toBe(0);
    expect(snapshot.email.queued).toBe(0);
    expect(snapshot.email.sent).toBe(0);
    expect(snapshot.email.failed).toBe(0);
    expect(snapshot.attendanceRate).toBe(0);
    expect(snapshot.tableCompletion).toEqual([]);
  });

  it("computes table completion and attendance metrics from event data", async () => {
    const suffix = Date.now().toString();
    const eventId = `unit_evt_${suffix}`;
    const tableId = `unit_tbl_${suffix}`;
    const seat1Id = `unit_seat_${suffix}_1`;
    const seat2Id = `unit_seat_${suffix}_2`;
    const seat3Id = `unit_seat_${suffix}_3`;
    const guest1Id = `unit_guest_${suffix}_1`;
    const guest2Id = `unit_guest_${suffix}_2`;

    try {
      await prisma.event.create({
        data: {
          id: eventId,
          organizationId,
          name: `Unit Reporting ${suffix}`,
          type: "GALA",
          status: "DRAFT",
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: "Unit Test Venue",
          capacity: 20,
        },
      });

      await prisma.eventTable.create({
        data: {
          id: tableId,
          eventId,
          name: "Unit Table",
          capacity: 4,
          tableUid: `unit-table-${suffix}`,
          publicCode: `UT${suffix.slice(-6)}`,
        },
      });

      await prisma.eventTableSeat.createMany({
        data: [
          { id: seat1Id, eventId, tableId, seatNumber: 1, status: "CONFIRMED" },
          { id: seat2Id, eventId, tableId, seatNumber: 2, status: "CHECKED_IN" },
          { id: seat3Id, eventId, tableId, seatNumber: 3, status: "EMPTY" },
        ],
      });

      await prisma.eventGuest.createMany({
        data: [
          {
            id: guest1Id,
            eventId,
            tableId,
            seatId: seat1Id,
            firstName: "Alpha",
            lastName: "Guest",
            email: `alpha-${suffix}@example.org`,
            rsvpStatus: "CONFIRMED",
            checkedIn: true,
            source: "ADMIN",
            checkinCode: `U${suffix.slice(-5)}A`,
          },
          {
            id: guest2Id,
            eventId,
            tableId,
            seatId: seat2Id,
            firstName: "Beta",
            lastName: "Guest",
            email: `beta-${suffix}@example.org`,
            rsvpStatus: "CONFIRMED",
            checkedIn: false,
            source: "WALK_IN",
            checkinCode: `U${suffix.slice(-5)}B`,
          },
        ],
      });

      await prisma.eventCheckInException.createMany({
        data: [
          {
            eventId,
            tableId,
            issueType: "OTHER",
            status: "OPEN",
            guestName: "Open Issue",
          },
          {
            eventId,
            tableId,
            issueType: "OTHER",
            status: "RESOLVED",
            guestName: "Resolved Issue",
          },
        ],
      });

      await prisma.eventEmailLog.createMany({
        data: [
          {
            eventId,
            tableId,
            type: "HOST_ACCESS",
            recipientEmail: `queued-${suffix}@example.org`,
            status: "QUEUED",
          },
          {
            eventId,
            tableId,
            type: "HOST_ACCESS",
            recipientEmail: `sent-${suffix}@example.org`,
            status: "SENT",
          },
          {
            eventId,
            tableId,
            type: "HOST_ACCESS",
            recipientEmail: `failed-${suffix}@example.org`,
            status: "FAILED",
          },
        ],
      });

      const snapshot = await getEventReportingSnapshot(eventId);

      expect(snapshot.expectedGuests).toBe(2);
      expect(snapshot.confirmedGuests).toBe(2);
      expect(snapshot.checkedInGuests).toBe(1);
      expect(snapshot.noShowGuests).toBe(1);
      expect(snapshot.walkIns).toBe(1);
      expect(snapshot.replacements).toBe(0);
      expect(snapshot.openExceptions).toBe(1);
      expect(snapshot.resolvedExceptions).toBe(1);
      expect(snapshot.email.queued).toBe(1);
      expect(snapshot.email.sent).toBe(1);
      expect(snapshot.email.failed).toBe(1);
      expect(snapshot.attendanceRate).toBe(50);

      const unitTable = snapshot.tableCompletion.find((row) => row.tableId === tableId);
      expect(unitTable).toBeTruthy();
      expect(unitTable?.capacity).toBe(4);
      expect(unitTable?.confirmed).toBe(2);
      expect(unitTable?.completionRate).toBe(50);
    } finally {
      await prisma.eventEmailLog.deleteMany({ where: { eventId } });
      await prisma.eventCheckInException.deleteMany({ where: { eventId } });
      await prisma.eventGuest.deleteMany({ where: { eventId } });
      await prisma.eventTableSeat.deleteMany({ where: { eventId } });
      await prisma.eventTable.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    }
  });
});