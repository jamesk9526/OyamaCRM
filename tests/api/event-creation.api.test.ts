import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  ticketType: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  pluginSetting: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  runtime: vi.fn(), audit: vi.fn(), $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: mocks }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org-a" }));
vi.mock("@/server/src/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("@/server/src/services/payment-gateway-settings", () => ({ readPaymentGatewayRuntimeConfig: mocks.runtime, readPaymentGatewayPublicSettings: async () => ({ currency: "USD" }) }));
import eventsRouter from "@/server/src/routes/events";

const app = express(); app.use(express.json()); app.use("/api/events", eventsRouter);
const sections = [{ id: "hero", enabled: true, lockToEventData: true }, { id: "registration-form", enabled: true, lockToEventData: true }];
const ticket = { id: "ticket-a", eventId: "event-a", name: "Admission", price: 0, active: true, available: 10, minPerOrder: 1, seatsIncluded: 1 };
const event = { id: "event-a", name: "Community night", active: true, visibility: "PUBLIC", status: "DRAFT", startDate: new Date("2030-10-01"), ticketTypes: [ticket] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.$transaction.mockImplementation((operation) => operation(mocks));
  mocks.event.findFirst.mockImplementation(async ({ where }) => where.id === event.id && where.organizationId === "org-a" ? event : null);
  mocks.pluginSetting.findUnique.mockResolvedValue({ config: { events: { "event-a": { pageSlug: "community-night", paymentPolicy: "NoPaymentRequired", status: "Draft", sections } } } });
  mocks.pluginSetting.findMany.mockResolvedValue([]);
  mocks.pluginSetting.upsert.mockResolvedValue({});
  mocks.runtime.mockResolvedValue({ stripe: { enabled: false, mode: "sandbox", publishableKey: "", secretKey: "", webhookSecret: "" } });
});
describe("event creator server boundary", () => {
  it("scopes readiness and publishing to the authenticated organization", async () => {
    expect((await request(app).get("/api/events/other-org-event/creation-readiness")).status).toBe(404);
    expect((await request(app).patch("/api/events/other-org-event/page-builder-config").send({ status: "Published" })).status).toBe(404);
    expect(mocks.pluginSetting.upsert).not.toHaveBeenCalled();
  });
  it("returns actionable readiness steps without credentials", async () => {
    const response = await request(app).get("/api/events/event-a/creation-readiness");
    expect(response.status).toBe(200); expect(response.body.nextStep).toBe("registration");
    expect(response.body.checks.find((check: { id: string }) => check.id === "policy").passed).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain("secretKey");
  });
  it("publishes a complete free registration page", async () => {
    const response = await request(app).patch("/api/events/event-a/page-builder-config").send({ status: "Published", paymentPolicy: "NoPaymentRequired", sections });
    expect(response.status).toBe(200); expect(response.body.status).toBe("Published"); expect(mocks.pluginSetting.upsert).toHaveBeenCalledOnce();
    expect(mocks.event.updateMany).toHaveBeenCalledWith({ where: { id: "event-a", organizationId: "org-a", status: "DRAFT" }, data: { status: "PUBLISHED" } });
  });
  it("blocks direct publication with paid tickets under a free policy", async () => {
    mocks.event.findFirst.mockResolvedValue({ ...event, ticketTypes: [{ ...ticket, price: 20 }] });
    const response = await request(app).patch("/api/events/event-a/page-builder-config").send({ status: "Published", paymentPolicy: "NoPaymentRequired", sections });
    expect(response.status).toBe(409); expect(response.body.error.code).toBe("CREATION_NOT_READY"); expect(mocks.pluginSetting.upsert).not.toHaveBeenCalled();
  });
  it("blocks unavailable online checkout and missing tickets", async () => {
    const response = await request(app).patch("/api/events/event-a/page-builder-config").send({ status: "Published", paymentPolicy: "StripeCheckout", sections });
    expect(response.status).toBe(409);
    mocks.event.findFirst.mockResolvedValue({ ...event, ticketTypes: [] });
    expect((await request(app).patch("/api/events/event-a/page-builder-config").send({ status: "Published", sections })).status).toBe(409);
    expect(mocks.pluginSetting.upsert).not.toHaveBeenCalled();
  });
  it("preserves publishing pages without registration", async () => {
    mocks.event.findFirst.mockResolvedValue({ ...event, ticketTypes: [] });
    const response = await request(app).patch("/api/events/event-a/page-builder-config").send({ status: "Published", sections: [{ id: "hero", enabled: true }] });
    expect(response.status).toBe(200);
  });
  it("rejects reserved and globally conflicting slugs", async () => {
    expect((await request(app).patch("/api/events/event-a/page-builder-config").send({ pageSlug: "events" })).status).toBe(400);
    mocks.pluginSetting.findMany.mockResolvedValue([{ organizationId: "org-b", config: { events: { other: { pageSlug: "taken", status: "Draft" } } } }]);
    expect((await request(app).patch("/api/events/event-a/page-builder-config").send({ pageSlug: "taken" })).status).toBe(409);
  });
  it("validates ticket writes and refuses another event's ticket", async () => {
    expect((await request(app).post("/api/events/event-a/ticket-types").send({ name: "Ticket", price: -1 })).status).toBe(400);
    mocks.ticketType.findFirst.mockResolvedValue(null);
    expect((await request(app).patch("/api/events/event-a/ticket-types/other-ticket").send({ price: 2 })).status).toBe(404);
    mocks.ticketType.findFirst.mockResolvedValue(ticket);
    expect((await request(app).patch("/api/events/event-a/ticket-types/ticket-a").send({ minPerOrder: 3, maxPerOrder: 1 })).status).toBe(400);
    expect(mocks.ticketType.update).not.toHaveBeenCalled();
  });
  it("creates Standard and Trivia drafts with atomic Trivia configuration", async () => {
    mocks.event.create.mockResolvedValue({ id: "new" });
    for (const mode of ["STANDARD", "TRIVIA"]) {
      const response = await request(app).post("/api/events").send({ name: "Night", mode, startDate: "2030-10-01T18:00:00Z" });
      expect(response.status).toBe(201);
      const data = mocks.event.create.mock.lastCall?.[0].data;
      expect(data.status).toBe("DRAFT"); expect(data.type).toBe(mode === "TRIVIA" ? "TRIVIA" : "OTHER");
      expect(Boolean(data.triviaConfiguration)).toBe(mode === "TRIVIA");
    }
  });
});
