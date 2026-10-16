import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventReportingSnapshot } from "@/server/src/services/event-reporting-service";

const db = vi.hoisted(() => ({
  eventGuest: { count: vi.fn() },
  eventCheckInException: { count: vi.fn() },
  eventEmailLog: { count: vi.fn() },
  eventTable: { findMany: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.clearAllMocks();
  db.eventGuest.count.mockResolvedValue(0);
  db.eventCheckInException.count.mockResolvedValue(0);
  db.eventEmailLog.count.mockResolvedValue(0);
});

describe("event reporting table completion", () => {
  it("counts actual confirmed guests instead of stale occupied seat statuses", async () => {
    db.eventTable.findMany.mockResolvedValue([{
      id: "table-1", name: "Table 1", capacity: 8,
      tableUid: "uid-1", publicCode: "code-1",
      seats: [
        { status: "CONFIRMED", guest: { rsvpStatus: "CONFIRMED", checkedIn: false } },
        { status: "CONFIRMED", guest: null },
        { status: "CHECKED_IN", guest: null },
        { status: "CONFIRMED", guest: { rsvpStatus: "DECLINED", checkedIn: false } },
      ],
    }]);

    const snapshot = await getEventReportingSnapshot("event-1");
    expect(snapshot.tableCompletion[0]).toMatchObject({ confirmed: 1, completionRate: 12.5 });
  });

  it("recognizes confirmed and checked-in guests when the seat status is stale", async () => {
    db.eventTable.findMany.mockResolvedValue([{
      id: "table-1", name: "Table 1", capacity: 4,
      tableUid: "uid-1", publicCode: "code-1",
      seats: [
        { status: "EMPTY", guest: { rsvpStatus: "CONFIRMED", checkedIn: false } },
        { status: "RESERVED", guest: { rsvpStatus: "PENDING", checkedIn: true } },
        { status: "RESERVED", guest: { rsvpStatus: "PENDING", checkedIn: false } },
      ],
    }]);

    const snapshot = await getEventReportingSnapshot("event-1");
    expect(snapshot.tableCompletion[0]).toMatchObject({ confirmed: 2, completionRate: 50 });
  });
});
