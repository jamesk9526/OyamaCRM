import { beforeEach, expect, it, vi } from "vitest";
import { createEventGuest, createWalkInGuest } from "@/server/src/services/event-guest-service";

const db = vi.hoisted(() => ({
  eventGuest: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  eventTable: { findFirst: vi.fn() },
  eventTableSeat: { findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } }));

beforeEach(() => {
  vi.clearAllMocks();
  db.eventGuest.findUnique.mockResolvedValue(null);
  db.eventGuest.count.mockResolvedValue(1);
  db.eventGuest.create.mockImplementation(async ({ data }) => ({ id: "guest", ...data }));
  db.eventTable.findFirst.mockResolvedValue({ id: "table", name: "Table 1", capacity: 8 });
  db.eventTableSeat.findFirst.mockResolvedValue({ id: "seat", tableId: "table", seatNumber: 2, guest: null });
  db.eventTableSeat.findMany.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({ seatNumber: index + 1 })));
});

it("places a walk-in into a real open seat when a table is selected", async () => {
  const guest = await createWalkInGuest({ eventId: "event", tableId: "table", firstName: "Jamie", lastName: "Guest" });
  expect(guest).toMatchObject({ tableId: "table", seatId: "seat", seatNumber: 2, source: "WALK_IN" });
  expect(db.eventTableSeat.update).toHaveBeenCalledWith({ where: { id: "seat" }, data: { status: "CONFIRMED" } });
});

it("rejects a table from a different event before creating a guest", async () => {
  db.eventTable.findFirst.mockResolvedValue(null);
  await expect(createWalkInGuest({ eventId: "event", tableId: "foreign-table" })).rejects.toMatchObject({ code: "TABLE_NOT_FOUND" });
  expect(db.eventTable.findFirst).toHaveBeenCalledWith({ where: { id: "foreign-table", eventId: "event" } });
  expect(db.eventGuest.create).not.toHaveBeenCalled();
});

it("rejects invalid or foreign seat IDs rather than silently ignoring them", async () => {
  db.eventTableSeat.findFirst.mockResolvedValue(null);
  await expect(createEventGuest({ eventId: "event", seatId: "foreign-seat" })).rejects.toMatchObject({ code: "SEAT_NOT_FOUND" });
  expect(db.eventGuest.create).not.toHaveBeenCalled();
});

it("rejects a seat that belongs to a different table", async () => {
  db.eventTableSeat.findFirst.mockResolvedValue(null);
  await expect(createEventGuest({ eventId: "event", tableId: "table", seatId: "seat-from-other-table" })).rejects.toMatchObject({ code: "SEAT_NOT_FOUND" });
  expect(db.eventTableSeat.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "seat-from-other-table", eventId: "event", tableId: "table" } }));
});

it("does not create a walk-in when a table is full", async () => {
  db.eventGuest.count.mockResolvedValue(8);
  await expect(createWalkInGuest({ eventId: "event", tableId: "table" })).rejects.toMatchObject({ code: "TABLE_FULL" });
  expect(db.eventGuest.create).not.toHaveBeenCalled();
});

it("does not take an occupied seat", async () => {
  db.eventTableSeat.findFirst.mockResolvedValue({ id: "seat", guest: { id: "other-guest" } });
  await expect(createEventGuest({ eventId: "event", seatId: "seat" })).rejects.toMatchObject({ code: "SEAT_OCCUPIED" });
  expect(db.eventGuest.create).not.toHaveBeenCalled();
});

it("keeps walk-ins without table selection unassigned", async () => {
  const guest = await createWalkInGuest({ eventId: "event", firstName: "Jamie" });
  expect(guest.tableId).toBeUndefined();
  expect(guest.seatId).toBeUndefined();
  expect(db.eventTableSeat.update).not.toHaveBeenCalled();
});

it("supports replacement guest source through the same validated lifecycle", async () => {
  const guest = await createEventGuest({ eventId: "event", source: "REPLACEMENT", rsvpStatus: "CONFIRMED", tableId: "table" });
  expect(guest).toMatchObject({ source: "REPLACEMENT", seatId: "seat", seatNumber: 2 });
});

it("returns a recoverable seating conflict when another desk claims the seat", async () => {
  db.eventGuest.create.mockRejectedValue({ code: "P2002", meta: { target: "EventGuest_seatId_key" } });
  await expect(createWalkInGuest({ eventId: "event", tableId: "table" })).rejects.toMatchObject({ code: "SEAT_OCCUPIED" });
  expect(db.eventTableSeat.update).not.toHaveBeenCalled();
});

it("does not misreport unrelated uniqueness errors as seating conflicts", async () => {
  const collision = { code: "P2002", meta: { target: "EventGuest_checkinCode_key" } };
  db.eventGuest.create.mockRejectedValue(collision);
  await expect(createWalkInGuest({ eventId: "event", tableId: "table" })).rejects.toBe(collision);
});
