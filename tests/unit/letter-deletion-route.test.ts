import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import deletionRoutes from "@/server/src/routes/letter-deletion";

const db = vi.hoisted(() => ({
  userPermission: { findUnique: vi.fn() },
  letterTemplate: { findFirst: vi.fn(), deleteMany: vi.fn() },
  generatedLetter: { findFirst: vi.fn(), deleteMany: vi.fn() },
  stewardPathStep: { count: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
const app = express();
app.use(express.json());
// Only the authenticated user context is synthetic; real permission middleware runs.
app.use((req, _res, next) => {
  if (req.get("x-test-role")) req.user = { sub: "staff-1", orgId: req.get("x-test-org") ?? "org-1", role: req.get("x-test-role")!, email: "qa@example.test" };
  next();
});
app.use("/api/letters", deletionRoutes);
const urls = ["/api/letters/templates/template-1/permanent", "/api/letters/generated/letter-1"];
beforeEach(() => {
  vi.resetAllMocks();
  db.userPermission.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation(async callback => callback(db));
  db.letterTemplate.findFirst.mockResolvedValue({ id: "template-1", name: "Test letter", _count: { generatedLetters: 0 } });
  db.generatedLetter.findFirst.mockResolvedValue({ id: "letter-1", templateId: "template-1", status: "GENERATED", printedAt: null, mailedAt: null, emailSentAt: null, emailCampaignId: "email-1", communicationActivityId: "activity-1" });
  db.letterTemplate.deleteMany.mockResolvedValue({ count: 1 });
  db.generatedLetter.deleteMany.mockResolvedValue({ count: 1 });
  db.stewardPathStep.count.mockResolvedValue(0);
  db.auditLog.create.mockResolvedValue({});
});

describe.each(urls)("typed letter deletion at %s", url => {
  it.each([undefined, "", "DELETE", " delete ", true])("rejects invalid confirmation %s without a transaction", async confirmation => {
    const response = await request(app).delete(url).set("x-test-role", "manager").send({ confirmation });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DELETE_CONFIRMATION_REQUIRED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("requires authentication and the existing archive permission", async () => {
    expect((await request(app).delete(url).send({ confirmation: "delete" })).status).toBe(401);
    expect((await request(app).delete(url).set("x-test-role", "staff").send({ confirmation: "delete" })).status).toBe(403);
    db.userPermission.findUnique.mockResolvedValue({ granted: false });
    expect((await request(app).delete(url).set("x-test-role", "admin").send({ confirmation: "delete" })).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("requires an authenticated organization", async () => {
    expect((await request(app).delete(url).set("x-test-role", "manager").set("x-test-org", "").send({ confirmation: "delete" })).status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing or other-organization record", async () => {
    db.letterTemplate.findFirst.mockResolvedValue(null);
    db.generatedLetter.findFirst.mockResolvedValue(null);
    expect((await request(app).delete(url).set("x-test-role", "manager").send({ confirmation: "delete", organizationId: "other-org" })).status).toBe(404);
    const model = url.includes("/templates/") ? db.letterTemplate : db.generatedLetter;
    expect(model.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-1" }) }));
    expect(model.deleteMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("reports concurrent changes as a conflict", async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }));
    expect((await request(app).delete(url).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(409);
  });
});

describe("template deletion safeguards", () => {
  it("removes only an unused template and audits in the same serializable transaction", async () => {
    expect((await request(app).delete(urls[0]).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(204);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(db.letterTemplate.deleteMany).toHaveBeenCalledWith({ where: { id: "template-1", organizationId: "org-1", generatedLetters: { none: {} } } });
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "LETTER_TEMPLATE_DELETED", entityId: "template-1", organizationId: "org-1", userId: "staff-1" }) });
    expect(db.generatedLetter.deleteMany).not.toHaveBeenCalled();
  });
  it("cannot cascade-delete generated letters", async () => {
    db.letterTemplate.findFirst.mockResolvedValue({ id: "template-1", _count: { generatedLetters: 2 } });
    expect((await request(app).delete(urls[0]).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(409);
    expect(db.letterTemplate.deleteMany).not.toHaveBeenCalled();
  });
  it("cannot break a linked Steward Path", async () => {
    db.stewardPathStep.count.mockResolvedValue(1);
    expect((await request(app).delete(urls[0]).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(409);
    expect(db.stewardPathStep.count).toHaveBeenCalledWith({ where: { path: { organizationId: "org-1" }, configJson: { path: "$.templateId", equals: "template-1" } } });
    expect(db.letterTemplate.deleteMany).not.toHaveBeenCalled();
  });
  it("requires refresh if the record changes before deletion", async () => {
    db.letterTemplate.deleteMany.mockResolvedValue({ count: 0 });
    expect((await request(app).delete(urls[0]).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(409);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

it("deletes a generated record with delivery metadata retained in its audit entry", async () => {
  const mailedAt = new Date("2026-11-01T10:00:00Z");
  db.generatedLetter.findFirst.mockResolvedValue({ id: "letter-1", templateId: "template-1", status: "MAILED", printedAt: null, mailedAt, emailSentAt: null, emailCampaignId: "email-1", communicationActivityId: "activity-1" });
  expect((await request(app).delete(urls[1]).set("x-test-role", "manager").send({ confirmation: "delete" })).status).toBe(204);
  expect(db.generatedLetter.deleteMany).toHaveBeenCalledWith({ where: { id: "letter-1", organizationId: "org-1" } });
  expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "GENERATED_LETTER_DELETED", metadata: expect.objectContaining({ mailedAt: mailedAt.toISOString(), emailCampaignId: "email-1", communicationActivityId: "activity-1" }) }) });
  expect(db.letterTemplate.deleteMany).not.toHaveBeenCalled();
});

it("fails the transaction if its audit entry cannot be written", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  db.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
  const response = await request(app).delete(urls[1]).set("x-test-role", "manager").send({ confirmation: "delete" });
  expect(response.status).toBe(500);
  expect(response.body.error.message).not.toContain("audit unavailable");
  log.mockRestore();
});
