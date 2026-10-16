import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckInRecord, reverseCheckIn } from "@/server/src/services/checkin-service";

const db = vi.hoisted(() => ({
  eventGuest: { findFirst: vi.fn(), updateMany: vi.fn() },
  eventCheckInRecord: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  eventTableSeat: { updateMany: vi.fn() },
}));
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { ...db, $transaction: transaction } }));

beforeEach(() => {
  vi.clearAllMocks();
  transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  db.eventGuest.findFirst.mockResolvedValue({ id: "guest", eventId: "event", tableId: "table", seatId: "seat", checkedIn: false, checkedInAt: null });
  db.eventGuest.updateMany.mockResolvedValue({ count: 1 });
  db.eventCheckInRecord.create.mockImplementation(async ({ data }) => ({ id: "record", ...data }));
  db.eventCheckInRecord.findFirst.mockResolvedValue({ id: "record", notes: null });
});

describe("auditable event check-in", () => {
  it("claims guest state and writes its attendance record in the same transaction", async () => {
    const record = await createCheckInRecord({ eventId: "event", guestId: "guest", method: "MANUAL" });
    expect(record.status).toBe("CHECKED_IN");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(db.eventGuest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "guest", eventId: "event", checkedIn: false } }));
    expect(db.eventTableSeat.updateMany).toHaveBeenCalledWith({ where: { id: "seat", eventId: "event", guest: { id: "guest" } }, data: { status: "CHECKED_IN" } });
  });

  it("treats a concurrent check-in or imported checked-in flag as a duplicate", async () => {
    db.eventGuest.updateMany.mockResolvedValue({ count: 0 });
    const record = await createCheckInRecord({ eventId: "event", guestId: "guest", method: "QR_SCAN" });
    expect(record.status).toBe("DUPLICATE_ATTEMPT");
    expect(db.eventTableSeat.updateMany).not.toHaveBeenCalled();
  });

  it("does not mutate a guest belonging to another event", async () => {
    db.eventGuest.findFirst.mockResolvedValue(null);
    await expect(createCheckInRecord({ eventId: "event", guestId: "guest", method: "MANUAL" })).rejects.toThrow("Guest not found");
    expect(db.eventGuest.updateMany).not.toHaveBeenCalled();
    expect(db.eventCheckInRecord.create).not.toHaveBeenCalled();
  });

  it("can reverse imported check-ins that have no attendance record", async () => {
    db.eventGuest.findFirst.mockResolvedValue({ id: "guest", eventId: "event", seatId: "seat", tableId: "table", checkedIn: true, checkedInAt: new Date("2026-10-16T12:00:00Z") });
    db.eventCheckInRecord.findFirst.mockResolvedValue(null);
    const record = await reverseCheckIn({ eventId: "event", guestId: "guest", reversedByUserId: "staff" });
    expect(record?.status).toBe("REVERSED");
    expect(db.eventGuest.updateMany).toHaveBeenCalledWith({ where: { id: "guest", eventId: "event", checkedIn: true }, data: { checkedIn: false, checkedInAt: null } });
    expect(db.eventCheckInRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "REVERSED", reversedByUserId: "staff" }) });
  });

  it("returns no reversal when another desk already reversed the guest", async () => {
    db.eventGuest.updateMany.mockResolvedValue({ count: 0 });
    expect(await reverseCheckIn({ eventId: "event", guestId: "guest" })).toBeNull();
    expect(db.eventCheckInRecord.create).not.toHaveBeenCalled();
    expect(db.eventCheckInRecord.updateMany).not.toHaveBeenCalled();
  });

  it("reverses all historical active records for the guest", async () => {
    await reverseCheckIn({ eventId: "event", guestId: "guest" });
    expect(db.eventCheckInRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "event", guestId: "guest", status: "CHECKED_IN", reversedAt: null }, data: expect.objectContaining({ status: "REVERSED" }) }));
  });
});
