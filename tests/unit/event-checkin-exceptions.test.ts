import { beforeEach, expect, it, vi } from "vitest";
import { createCheckInException, dismissCheckInException, resolveCheckInException } from "@/server/src/services/checkin-exception-service";

const db = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), create: vi.fn() }));
const related = vi.hoisted(() => ({ eventGuest: { findFirst: vi.fn() }, eventTable: { findFirst: vi.fn() }, eventTableSeat: { findFirst: vi.fn() } }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { eventCheckInException: db, ...related } }));
beforeEach(() => {
  vi.clearAllMocks();
  related.eventGuest.findFirst.mockResolvedValue({ id: "guest" });
  related.eventTable.findFirst.mockResolvedValue({ id: "table" });
  related.eventTableSeat.findFirst.mockResolvedValue({ id: "seat" });
});

for (const action of [resolveCheckInException, dismissCheckInException]) {
  it(`${action.name} cannot act on an exception from another organization or event`, async () => {
    db.findFirst.mockResolvedValue(null);
    expect(await action({ exceptionId: "foreign", eventId: "event", organizationId: "org" })).toBeNull();
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "foreign", eventId: "event", event: { organizationId: "org" } } });
    expect(db.update).not.toHaveBeenCalled();
  });
  it(`${action.name} updates an exception after its event and organization match`, async () => {
    db.findFirst.mockResolvedValue({ id: "exception", notes: "Existing note" });
    await action({ exceptionId: "exception", eventId: "event", organizationId: "org", resolvedByUserId: "staff" });
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "exception" }, data: expect.objectContaining({ resolvedByUserId: "staff", notes: "Existing note" }) }));
  });
}

for (const [field, model, code] of [
  ["guestId", "eventGuest", "GUEST_NOT_FOUND"],
  ["tableId", "eventTable", "TABLE_NOT_FOUND"],
  ["seatId", "eventTableSeat", "SEAT_NOT_FOUND"],
] as const) {
  it(`rejects foreign ${field} before creating an exception`, async () => {
    related[model].findFirst.mockResolvedValue(null);
    await expect(createCheckInException({ eventId: "event", issueType: "OTHER", [field]: "foreign" })).rejects.toMatchObject({ code });
    expect(related[model].findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign", eventId: "event" } }));
    expect(db.create).not.toHaveBeenCalled();
  });
}

it("requires an exception seat to belong to its claimed table", async () => {
  related.eventTableSeat.findFirst.mockResolvedValue(null);
  await expect(createCheckInException({ eventId: "event", issueType: "WRONG_TABLE", tableId: "table", seatId: "other-seat" })).rejects.toMatchObject({ code: "SEAT_NOT_FOUND" });
  expect(related.eventTableSeat.findFirst).toHaveBeenCalledWith({ where: { id: "other-seat", eventId: "event", tableId: "table" }, select: { id: true } });
  expect(db.create).not.toHaveBeenCalled();
});

it("allows an unlinked exception for an unknown guest", async () => {
  await createCheckInException({ eventId: "event", issueType: "NOT_FOUND", guestName: "Unknown Guest" });
  expect(db.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: "event", issueType: "NOT_FOUND", guestName: "Unknown Guest", status: "OPEN" }) });
  expect(related.eventGuest.findFirst).not.toHaveBeenCalled();
});
