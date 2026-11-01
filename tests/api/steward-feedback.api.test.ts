import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), unique: vi.fn() }));
vi.mock("../../server/src/lib/prisma.js", () => ({ prisma: { auditLog: { create: mock.create, findMany: mock.list, findUnique: mock.unique } } }));
import router from "../../server/src/routes/steward-feedback.js";
import { signAccessToken } from "../../server/src/lib/auth.js";
const app = express(); app.use(express.json()); app.use("/feedback", router);
const admin = signAccessToken({ sub: "admin", orgId: "org-a", email: "a@example.invalid", role: "admin" });
const staff = signAccessToken({ sub: "staff", orgId: "org-a", email: "s@example.invalid", role: "staff" });
const report = { reportId: "11111111-2222-4333-8444-555555555555", rating: "down", reason: "incorrect", note: "Invented an amount" };
beforeEach(() => { vi.resetAllMocks(); mock.create.mockResolvedValue({}); mock.list.mockResolvedValue([]); });
describe("Steward master improvements log", () => {
  it("requires authentication and admin role for log access", async () => {
    await request(app).get("/feedback").expect(401);
    await request(app).get("/feedback").set("Authorization", `Bearer ${staff}`).expect(403);
  });
  it("persists feedback under authenticated tenant, ignoring supplied tenant", async () => {
    await request(app).post("/feedback").set("Authorization", `Bearer ${staff}`).send({ ...report, organizationId: "org-b" }).expect(200);
    expect(mock.create.mock.calls[0][0].data.organizationId).toBe("org-a");
    expect(mock.create.mock.calls[0][0].data.metadata.excerpt).toBe("");
  });
  it("does not acknowledge failed persistence", async () => {
    mock.create.mockRejectedValue(new Error("database offline"));
    await request(app).post("/feedback").set("Authorization", `Bearer ${staff}`).send(report).expect(503);
  });
  it("purpose-bound desktop token can append but cannot read CRM reports", async () => {
    const connection = await request(app).post("/feedback/connection").set("Authorization", `Bearer ${admin}`).send({}).expect(200);
    const token = connection.body.data.token;
    await request(app).post("/feedback/bridge").set("Authorization", `Bearer ${token}`).send(report).expect(200);
    expect(mock.create.mock.calls[0][0].data.organizationId).toBe("org-a");
    await request(app).get("/feedback").set("Authorization", `Bearer ${token}`).expect(401);
    await request(app).post("/feedback/bridge").set("Authorization", `Bearer ${admin}`).send(report).expect(401);
  });
  it("lists only this organization's reports", async () => {
    await request(app).get("/feedback").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(mock.list.mock.calls[0][0].where.organizationId).toBe("org-a");
  });
});
