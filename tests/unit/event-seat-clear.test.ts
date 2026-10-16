import { beforeEach, expect, it, vi } from "vitest";
import { clearSeat } from "@/server/src/services/event-seat-service";

const db = vi.hoisted(() => ({
  eventTableSeat: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  eventGuest: { update: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: {
  ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db),
} }));

beforeEach(() => {
  vi.clearAllMocks();
  db.eventTableSeat.findFirst.mockResolvedValue({ id: "seat-1", guest: { id: "guest-1" } });
});

it("clearing a seat removes the table association so the guest becomes available for placement", async () => {
  await clearSeat({ eventId: "event-1", seatId: "seat-1" });
  expect(db.eventGuest.update).toHaveBeenCalledWith({
    where: { id: "guest-1" }, data: { tableId: null, seatId: null, seatNumber: null },
  });
});
