import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestHandler } from "express";
import events from "@/server/src/routes/events";

const db = vi.hoisted(() => ({
  event: { findFirst: vi.fn() }, ticketType: { findFirst: vi.fn() },
  eventTable: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  eventGuest: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  eventGuestInvite: { deleteMany: vi.fn() },
  eventTableAccessToken: { deleteMany: vi.fn() },
  eventTableSeat: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
  auditLog: { create: vi.fn() },
  activity: { create: vi.fn() },
}));
const checkIn = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/services/checkin-service", async (original) => ({
  ...await original<object>(), createCheckInRecord: checkIn,
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org-1" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: ((_req, _res, next) => next()) as RequestHandler }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => ((_req, _res, next) => next()) as RequestHandler }));
vi.mock("@/server/src/middleware/requireRole", () => ({ requireRole: () => ((_req, _res, next) => next()) as RequestHandler }));

const app = express();
app.use(express.json());
app.use("/api/events", events);

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.eventGuest.findMany.mockResolvedValue([]);
  db.event.findFirst.mockResolvedValue({ id: "event-1", organizationId: "org-1" });
  db.eventGuest.findFirst.mockResolvedValue({ id: "guest-1", eventId: "event-1", ticketTypeId: null, event: { organizationId: "org-1" } });
  db.eventGuest.findUnique.mockResolvedValue(null);
  db.eventGuest.create.mockResolvedValue({ id: "guest-1", event: { name: "Event" } });
  db.eventGuest.update.mockResolvedValue({ id: "guest-1", ticketType: { id: "ticket-1", name: "Individual" } });
  db.ticketType.findFirst.mockResolvedValue({ id: "ticket-1", active: true });
  db.eventTable.findFirst.mockResolvedValue({ id: "table-1", eventId: "event-1", capacity: 8, guests: [{ id: "guest-1" }], event: { organizationId: "org-1" } });
  db.eventTable.findUnique.mockResolvedValue({ id: "table-1", name: "New name", capacity: 8 });
  checkIn.mockResolvedValue({ status: "CHECKED_IN" });
});

describe("table operation boundaries", () => {
  it("deletes only the chosen table and its layout while retaining guest records", async () => {
    db.eventTable.findFirst.mockResolvedValue({ id: "table-1", name: "Original table", tableNumber: 2, hostName: "Original Owner", hostEmail: "owner@example.test", event: { organizationId: "org-1" } });
    db.eventGuest.findMany.mockResolvedValue([{ id: "guest-1", notes: "Existing note" }]);
    const response = await request(app).delete("/api/events/tables/table-1");
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.auditLog.create.mock.calls[0][0].data.metadata.originalTable).toMatchObject({ hostName: "Original Owner", hostEmail: "owner@example.test" });
    expect(db.eventGuest.update).toHaveBeenCalledWith({ where: { id: "guest-1" }, data: { notes: expect.stringContaining("Existing note\n\nOriginal table: 2 · Original table\nOriginal host: Original Owner") } });
    expect(db.eventGuest.updateMany).toHaveBeenCalledWith({
      where: { tableId: "table-1" }, data: { tableId: null, seatId: null, seatNumber: null },
    });
    expect(db.eventTable.delete).toHaveBeenCalledWith({ where: { id: "table-1" } });
    expect(db.eventTableSeat.deleteMany).toHaveBeenCalledWith({ where: { tableId: "table-1" } });
    expect(db.eventGuestInvite.deleteMany).toHaveBeenCalledWith({ where: { tableId: "table-1" } });
    expect(db.eventTableAccessToken.deleteMany).toHaveBeenCalledWith({ where: { tableId: "table-1" } });
  });
  it("does not delete another organization's table", async () => {
    db.eventTable.findFirst.mockResolvedValue({ event: { organizationId: "other-org" } });
    expect((await request(app).delete("/api/events/tables/table-1")).status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns table-linked guests with the seat roster in table details", async () => {
    db.eventTable.findFirst.mockImplementation(async ({ include }) => ({
      id: "table-1", capacity: 8, seats: [], guestInvites: [],
      ...(include?.guests ? { guests: [{ id: "guest-1", seatId: null }] } : {}),
    }));
    const response = await request(app).get("/api/events/event-1/tablelink/tbl-1");
    expect(response.status).toBe(200);
    expect(response.body.guests).toEqual([{ id: "guest-1", seatId: null }]);
  });
  it("renames a table without writing seating or capacity fields", async () => {
    const response = await request(app).patch("/api/events/tables/table-1").send({ name: " New name " });
    expect(response.status).toBe(200);
    expect(db.eventTable.update).toHaveBeenCalledWith({ where: { id: "table-1" }, data: { name: "New name" } });
  });
  it("rejects an empty table name", async () => {
    expect((await request(app).patch("/api/events/tables/table-1").send({ name: " " })).status).toBe(400);
    expect(db.eventTable.update).not.toHaveBeenCalled();
  });
  it("does not rename tables owned by another organization", async () => {
    db.eventTable.findFirst.mockResolvedValue({ event: { organizationId: "other-org" } });
    expect((await request(app).patch("/api/events/tables/table-1").send({ name: "New" })).status).toBe(404);
    expect(db.eventTable.update).not.toHaveBeenCalled();
  });
  it("rejects bulk check-in IDs that do not belong to the selected table", async () => {
    const response = await request(app).post("/api/events/event-1/checkin/table/table-1/bulk").send({ guestIds: ["guest-1", "other-table-guest"] });
    expect(response.status).toBe(400);
    expect(checkIn).not.toHaveBeenCalled();
  });
  it("deduplicates bulk check-in IDs", async () => {
    const response = await request(app).post("/api/events/event-1/checkin/table/table-1/bulk").send({ guestIds: ["guest-1", "guest-1"] });
    expect(response.status).toBe(200);
    expect(checkIn).toHaveBeenCalledOnce();
    expect(response.body.results).toHaveLength(1);
  });
});

describe("manual guest ticket assignment API", () => {
  it("saves an active event ticket when registering a manual guest", async () => {
    const response = await request(app).post("/api/events/event-1/guests").send({ firstName: "Ada", lastName: "Lovelace", ticketTypeId: "ticket-1" });
    expect(response.status).toBe(201);
    expect(db.ticketType.findFirst).toHaveBeenCalledWith({ where: { id: "ticket-1", eventId: "event-1" }, select: { id: true, active: true } });
    expect(db.eventGuest.create.mock.calls[0][0].data.ticketTypeId).toBe("ticket-1");
  });
  it("assigns a ticket to an existing manual guest", async () => {
    const response = await request(app).patch("/api/events/guests/guest-1").send({ ticketTypeId: "ticket-1" });
    expect(response.status).toBe(200);
    expect(db.eventGuest.update.mock.calls[0][0].data.ticketTypeId).toBe("ticket-1");
  });
  it.each(["POST", "PATCH"])("rejects a foreign or deleted ticket before %s writes", async (method) => {
    db.ticketType.findFirst.mockResolvedValue(null);
    const operation = method === "POST" ? request(app).post("/api/events/event-1/guests") : request(app).patch("/api/events/guests/guest-1");
    const response = await operation.send({ firstName: "Ada", lastName: "Lovelace", ticketTypeId: "foreign-ticket" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_TICKET_TYPE");
    expect(db.eventGuest.create).not.toHaveBeenCalled();
    expect(db.eventGuest.update).not.toHaveBeenCalled();
  });
  it("rejects inactive ticket assignment", async () => {
    db.ticketType.findFirst.mockResolvedValue({ id: "ticket-1", active: false });
    expect((await request(app).patch("/api/events/guests/guest-1").send({ ticketTypeId: "ticket-1" })).status).toBe(400);
  });
  it("removes a ticket using null", async () => {
    expect((await request(app).patch("/api/events/guests/guest-1").send({ ticketTypeId: null })).status).toBe(200);
    expect(db.ticketType.findFirst).not.toHaveBeenCalled();
    expect(db.eventGuest.update.mock.calls[0][0].data.ticketTypeId).toBeNull();
  });
  it("keeps a guest outside the organization inaccessible", async () => {
    db.eventGuest.findFirst.mockResolvedValue({ event: { organizationId: "other-org" } });
    expect((await request(app).patch("/api/events/guests/guest-1").send({ ticketTypeId: "ticket-1" })).status).toBe(404);
    expect(db.eventGuest.update).not.toHaveBeenCalled();
  });
});


describe("guest payment status from saved orders", () => {
  const paidOrder = { id: "order-1", orderNumber: "EV-1", status: "CONFIRMED", totalAmount: 80, paidAt: new Date(), transactionId: "stripe:pi_verified" };
  it.each(["/event-1/guests", "/guests?eventId=event-1"])("uses the settled database order at %s despite a stale guest flag", async (url) => {
    db.eventGuest.findMany.mockResolvedValue([{ id: "guest-1", paymentStatus: "DUE", order: paidOrder }]);
    const response = await request(app).get(`/api/events${url}`);
    expect(response.status).toBe(200);
    expect(response.body[0].paymentStatus).toBe("PAID");
    expect(db.eventGuest.findMany.mock.calls[0][0].include.order.select.paidAt).toBe(true);
    expect(db.eventGuest.update).not.toHaveBeenCalled();
  });
  it("does not treat a Stripe checkout reference as proof of payment", async () => {
    db.eventGuest.findMany.mockResolvedValue([{ paymentStatus: "DUE", order: { ...paidOrder, status: "PENDING", paidAt: null, transactionId: "stripe:checkout:cs_unpaid" } }]);
    const response = await request(app).get("/api/events/event-1/guests");
    expect(response.body[0].paymentStatus).toBe("DUE");
  });
  it("preserves complimentary, sponsored, and standalone guest payments", async () => {
    db.eventGuest.findMany.mockResolvedValue([{ paymentStatus: "COMP", order: paidOrder }, { paymentStatus: "SPONSORED", order: paidOrder }, { paymentStatus: "PAID", order: null }]);
    const response = await request(app).get("/api/events/event-1/guests");
    expect(response.body.map((guest: { paymentStatus: string }) => guest.paymentStatus)).toEqual(["COMP", "SPONSORED", "PAID"]);
  });
  it.each(["CANCELLED", "REFUNDED"])("does not show %s orders as paid using a historical paidAt", async (status) => {
    db.eventGuest.findMany.mockResolvedValue([{ paymentStatus: "PAID", order: { ...paidOrder, status } }]);
    const response = await request(app).get("/api/events/event-1/guests");
    expect(response.body[0].paymentStatus).toBe("DUE");
  });
  it("resolves payment when scanning a guest code", async () => {
    db.eventGuest.findFirst.mockResolvedValue({ id: "guest-1", paymentStatus: "DUE", order: paidOrder });
    const response = await request(app).get("/api/events/guests/by-code/ABC123?eventId=event-1");
    expect(response.status).toBe(200);
    expect(response.body.paymentStatus).toBe("PAID");
  });
});
