import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ $transaction: vi.fn(),
  emailUnsubscribeToken: { findUnique: vi.fn(), update: vi.fn() },
  emailPreference: { upsert: vi.fn(), findMany: vi.fn() },
  emailSubscription: { update: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  emailConsentEvent: { create: vi.fn() }, constituent: { update: vi.fn(), findMany: vi.fn() },
  emailSuppression: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
import preferences from "@/server/src/routes/email-preferences";
import { evaluateRecipientEligibility } from "@/server/src/services/email-compliance";
const app = express(); app.use(express.json()); app.use("/api/email", preferences);
beforeEach(() => {
  vi.resetAllMocks(); db.$transaction.mockImplementation(async run => run(db));
  db.emailUnsubscribeToken.findUnique.mockResolvedValue({ id: "token", organizationId: "org", subscriptionId: "sub", category: "SURVEY", expiresAt: new Date(Date.now() + 86400000), organization: { name: "Synthetic organization" }, subscription: { constituentId: "donor", email: "donor@example.invalid", globalStatus: "SUBSCRIBED", preferences: [] } });
});
describe("survey-only email preferences", () => {
  it("unsubscribes only surveys even if an old client requests all email", async () => {
    const result = await request(app).post("/api/email/unsubscribe/synthetic").send({ scope: "all" });
    expect(result.status).toBe(200); expect(result.body.unsubscribedScope).toBe("category");
    expect(db.emailPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ category: "SURVEY", status: "UNSUBSCRIBED" }) }));
    expect(db.emailSubscription.update).not.toHaveBeenCalled(); expect(db.constituent.update).not.toHaveBeenCalled(); expect(db.emailSuppression.create).not.toHaveBeenCalled();
  });
  it("restricts a survey token to survey preferences on both read and write", async () => {
    const read = await request(app).get("/api/email/preferences/synthetic");
    expect(read.body.categoryPreferences).toEqual([{ category: "SURVEY", status: "SUBSCRIBED" }]);
    await request(app).post("/api/email/preferences/synthetic").send({ globalStatus: "UNSUBSCRIBED" }).expect(422);
    await request(app).post("/api/email/preferences/synthetic").send({ categoryPreferences: [{ category: "NEWSLETTER", status: "UNSUBSCRIBED" }] }).expect(422);
    await request(app).post("/api/email/preferences/synthetic").send({ categoryPreferences: [{ category: "SURVEY", status: "SUBSCRIBED" }] }).expect(200);
    expect(db.emailSubscription.update).not.toHaveBeenCalled();
  });
  it("applies survey opt-outs to surveys without blocking newsletters, and honors global blocks", async () => {
    db.constituent.findMany.mockResolvedValue([{ id: "donor", email: "donor@example.invalid", doNotContact: false, doNotEmail: false, emailOptOut: false }]);
    db.emailSubscription.findMany.mockResolvedValue([{ id: "sub", email: "donor@example.invalid", globalStatus: "SUBSCRIBED" }]);
    db.emailSuppression.findMany.mockResolvedValue([]);
    db.emailPreference.findMany.mockImplementation(async ({ where }) => where.category === "SURVEY" ? [{ subscriptionId: "sub", status: "UNSUBSCRIBED" }] : []);
    const input = { organizationId: "org", candidates: [{ email: "donor@example.invalid", constituentId: "donor" }] };
    expect((await evaluateRecipientEligibility({ ...input, purpose: "MARKETING", category: "SURVEY" })).summary.categoryOptOut).toBe(1);
    expect((await evaluateRecipientEligibility({ ...input, purpose: "NEWSLETTER" })).summary.finalSendCount).toBe(1);
    db.emailSubscription.findMany.mockResolvedValue([{ id: "sub", email: "donor@example.invalid", globalStatus: "UNSUBSCRIBED" }]);
    expect((await evaluateRecipientEligibility({ ...input, purpose: "MARKETING", category: "SURVEY" })).summary.finalSendCount).toBe(0);
  });
});
