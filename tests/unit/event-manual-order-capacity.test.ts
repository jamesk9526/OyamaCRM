import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import events from "@/server/src/routes/events";

const db = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  constituent: { findFirst: vi.fn() },
  ticketType: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  eventGuest: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  eventOrderItem: { groupBy: vi.fn() },
  eventOrder: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  activity: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org-1" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: ((_req, _res, next) => next()) as RequestHandler }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => ((_req, _res, next) => next()) as RequestHandler }));
vi.mock("@/server/src/middleware/requireRole", () => ({ requireRole: () => ((_req, _res, next) => next()) as RequestHandler }));

const app = express();
app.use(express.json());
app.use("/api/events", events);
const ticket = { id: "ticket-1", name: "Admission", price: 25, capacity: 5, available: 5, seatsIncluded: 1, minPerOrder: 1, maxPerOrder: 10 };
const placeOrder = (quantities = [1]) => request(app).post("/api/events/event-1/orders").send({
  constituentId: "person-1", items: quantities.map((quantity) => ({ ticketTypeId: "ticket-1", quantity })),
});

beforeEach(() => {
  vi.resetAllMocks();
  db.event.findFirst.mockResolvedValue({ id: "event-1", organizationId: "org-1", capacity: 100 });
  db.constituent.findFirst.mockResolvedValue({ id: "person-1", firstName: "Ada", lastName: "Lovelace" });
  db.ticketType.findMany.mockResolvedValue([ticket]);
  db.ticketType.updateMany.mockResolvedValue({ count: 1 });
  db.eventGuest.count.mockResolvedValue(0);
  db.eventGuest.findUnique.mockResolvedValue(null);
  db.eventOrderItem.groupBy.mockResolvedValue([]);
  db.eventOrder.create.mockResolvedValue({ id: "order-1", event: { name: "Event" } });
  db.eventOrder.findUniqueOrThrow.mockResolvedValue({ id: "order-1" });
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
});

describe("manual event order inventory", () => {
  it("checks combined quantity when a ticket appears twice", async () => {
    expect((await placeOrder([3, 3])).status).toBe(409);
    expect(db.eventOrder.create).not.toHaveBeenCalled();
  });

  it("creates a single combined order item for duplicate ticket rows", async () => {
    expect((await placeOrder([1, 2])).status).toBe(201);
    expect(db.eventOrder.create.mock.calls[0][0].data.items.create).toEqual([
      { ticketTypeId: "ticket-1", quantity: 3, unitPrice: 25, totalPrice: 75 },
    ]);
    expect(db.eventGuest.create).toHaveBeenCalledTimes(3);
  });

  it("reserves availability conditionally in a serializable transaction", async () => {
    expect((await placeOrder()).status).toBe(201);
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
    expect(db.ticketType.updateMany).toHaveBeenCalledWith({
      where: { id: "ticket-1", available: { gte: 1 } }, data: { available: { decrement: 1 } },
    });
    expect(db.ticketType.update).not.toHaveBeenCalled();
  });

  it("checks event capacity using the transaction snapshot", async () => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => {
      db.eventGuest.count.mockResolvedValue(100);
      return callback(db);
    });
    const result = await placeOrder();
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("EVENT_CAPACITY_REACHED");
    expect(db.eventOrder.create).not.toHaveBeenCalled();
  });

  it("checks sold ticket units using the transaction snapshot", async () => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => {
      db.eventOrderItem.groupBy.mockResolvedValue([{ ticketTypeId: "ticket-1", _sum: { quantity: 5 } }]);
      return callback(db);
    });
    const result = await placeOrder();
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("TICKET_CAPACITY_REACHED");
    expect(db.eventOrder.create).not.toHaveBeenCalled();
  });

  it("returns a conflict if another order consumes the remaining availability", async () => {
    db.ticketType.updateMany.mockResolvedValue({ count: 0 });
    const result = await placeOrder();
    expect(result.status).toBe(409);
    expect(db.eventGuest.create).not.toHaveBeenCalled();
  });

  it("returns a retryable conflict for a transaction serialization collision", async () => {
    db.$transaction.mockRejectedValue({ code: "P2034" });
    const result = await placeOrder();
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("ORDER_CAPACITY_CONFLICT");
  });
});
