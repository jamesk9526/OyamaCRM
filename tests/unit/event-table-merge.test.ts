import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeEventTables } from "@/server/src/services/event-table-merge";

const db = vi.hoisted(() => ({
  eventTable: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  eventTableSeat: { update: vi.fn() },
  eventGuest: { updateMany: vi.fn() }, eventGuestInvite: { updateMany: vi.fn() },
  eventCheckInRecord: { updateMany: vi.fn() }, eventCheckInException: { updateMany: vi.fn() },
  eventEmailLog: { updateMany: vi.fn() }, eventTableAccessToken: { updateMany: vi.fn() },
  triviaTeam: { update: vi.fn() }, $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
const input = { organizationId: "org", sourceId: "table-2", targetId: "table-9" };
const source = () => ({ id: "table-2", eventId: "event", tableNumber: 2, capacity: 2, name: "Source", notes: "Dietary notes", hostName: "Host", seats: [{ id: "seat-a", seatNumber: 1 }, { id: "seat-b", seatNumber: 2 }], triviaTeam: null });
const target = () => ({ id: "table-9", eventId: "event", tableNumber: 9, capacity: 3, name: "Keep me", notes: "Keep notes", seats: [{ id: "seat-existing", seatNumber: 1 }], triviaTeam: null });
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.eventTable.findMany.mockResolvedValue([source(), target()]);
  db.eventTable.update.mockImplementation(async ({ data }) => ({ ...target(), ...data }));
});

describe("seating-only table merge", () => {
  it("keeps Table 9 and moves original seat IDs and records without touching financial fields", async () => {
    const result = await mergeEventTables(input);
    expect(result.table).toMatchObject({ id: "table-9", tableNumber: 9, name: "Keep me", capacity: 5 });
    expect(result.table.notes).toContain("Keep notes");
    expect(result.table.notes).toContain("Dietary notes");
    expect(db.eventTable.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["table-2", "table-9"] }, event: { organizationId: "org" } });
    expect(db.eventTableSeat.update).toHaveBeenNthCalledWith(1, { where: { id: "seat-a" }, data: { tableId: "table-9", seatNumber: 4 } });
    expect(db.eventTableSeat.update).toHaveBeenNthCalledWith(2, { where: { id: "seat-b" }, data: { tableId: "table-9", seatNumber: 5 } });
    for (const call of db.eventGuest.updateMany.mock.calls) {
      expect(Object.keys(call[0].data).every((key) => ["tableId", "seatNumber"].includes(key))).toBe(true);
    }
    for (const model of [db.eventGuestInvite, db.eventCheckInRecord, db.eventCheckInException, db.eventEmailLog]) {
      expect(model.updateMany).toHaveBeenCalledWith({ where: { tableId: "table-2" }, data: { tableId: "table-9" } });
    }
    expect(db.eventTableAccessToken.updateMany).toHaveBeenCalledWith({ where: { tableId: "table-2" }, data: { tableId: "table-9", status: "REVOKED" } });
    expect(db.eventTable.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: "table-2" } });
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "Serializable" });
  });
  it("retains independent Trivia scores rather than combining teams", async () => {
    db.eventTable.findMany.mockResolvedValue([{ ...source(), triviaTeam: { id: "team", score: 40, payload: { eventsTableId: "table-2", score: 40 } } }, target()]);
    await mergeEventTables(input);
    expect(db.triviaTeam.update).toHaveBeenCalledWith({ where: { id: "team" }, data: { eventTableId: null, payload: { score: 40, eventsTableMergedIntoId: "table-9" } } });
  });
  it("rejects self-merges before opening a transaction", async () => {
    await expect(mergeEventTables({ ...input, targetId: input.sourceId })).rejects.toThrow("different table");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejects missing or foreign tables and cross-event merges before writes", async () => {
    db.eventTable.findMany.mockResolvedValue([source()]);
    await expect(mergeEventTables(input)).rejects.toThrow("no longer available");
    db.eventTable.findMany.mockResolvedValue([source(), { ...target(), eventId: "other" }]);
    await expect(mergeEventTables(input)).rejects.toThrow("same event");
    expect(db.eventGuest.updateMany).not.toHaveBeenCalled();
    expect(db.eventTable.delete).not.toHaveBeenCalled();
  });
  it("rejects capacity overflow without removing either table", async () => {
    db.eventTable.findMany.mockResolvedValue([source(), { ...target(), capacity: 500 }]);
    await expect(mergeEventTables(input)).rejects.toThrow("500-seat limit");
    expect(db.eventTableSeat.update).not.toHaveBeenCalled();
    expect(db.eventTable.delete).not.toHaveBeenCalled();
  });
  it("propagates a move failure to roll back the transaction instead of deleting the source", async () => {
    db.eventGuestInvite.updateMany.mockRejectedValue(new Error("database unavailable"));
    await expect(mergeEventTables(input)).rejects.toThrow("database unavailable");
    expect(db.eventTable.delete).not.toHaveBeenCalled();
  });
});
