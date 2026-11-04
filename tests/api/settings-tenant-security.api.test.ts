import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  organization: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  organizationSettings: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/server/src/middleware/requireAuth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { sub: "synthetic-staff", orgId: req.get("x-org") || "", role: req.get("x-role") || "staff", email: "staff@example.invalid" }; next();
  },
}));
import settings from "@/server/src/routes/settings";
const app = express(); app.use(express.json()); app.use("/settings", settings);

beforeEach(() => {
  vi.clearAllMocks();
  db.organization.findFirst.mockResolvedValue({ id: "other-tenant", name: "Other tenant" });
  db.organization.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, name: "Synthetic own tenant" }));
  db.organizationSettings.findUnique.mockResolvedValue({ fiscalYearStart: 1, currency: "USD", smtpHost: "smtp.example.invalid", smtpUser: "synthetic-user", smtpPass: "synthetic-saved-secret" });
  db.organizationSettings.upsert.mockResolvedValue({});
  db.organization.update.mockResolvedValue({});
});

describe("organization settings tenant and secret boundary", () => {
  it.each(["staff", "admin"])("never returns an SMTP password to %s", async role => {
    const response = await request(app).get("/settings").set("x-org", "own-tenant").set("x-role", role);
    expect(response.status).toBe(200);
    expect(response.body.orgName).toBe("Synthetic own tenant");
    expect(response.body.smtpPass).toBe("");
    expect(response.body.smtpPassConfigured).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("synthetic-saved-secret");
    expect(db.organizationSettings.findUnique).toHaveBeenCalledWith({ where: { organizationId: "own-tenant" } });
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });
  it("rejects missing tenant context without falling back to another organization", async () => {
    const response = await request(app).get("/settings");
    expect(response.status).toBe(403);
    expect(db.organization.findFirst).not.toHaveBeenCalled();
    expect(db.organizationSettings.findUnique).not.toHaveBeenCalled();
  });
  it("keeps the saved password on an unchanged blank form and writes only the authenticated tenant", async () => {
    const response = await request(app).put("/settings").set("x-org", "own-tenant").set("x-role", "admin").send({ orgName: "Own updated", smtpHost: "smtp.example.invalid", smtpPass: "" });
    expect(response.status).toBe(200);
    expect(db.organization.update).toHaveBeenCalledWith({ where: { id: "own-tenant" }, data: { name: "Own updated" } });
    const args = db.organizationSettings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: "own-tenant" });
    expect(args.update).not.toHaveProperty("smtpPass");
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });
  it("allows an explicit replacement password without returning it", async () => {
    const response = await request(app).put("/settings").set("x-org", "own-tenant").set("x-role", "admin").send({ smtpPass: "synthetic-replacement-secret" });
    expect(response.status).toBe(200);
    expect(db.organizationSettings.upsert.mock.calls[0][0].update.smtpPass).toBe("synthetic-replacement-secret");
    expect(JSON.stringify(response.body)).not.toContain("synthetic-replacement-secret");
  });
  it("keeps settings writes admin-only", async () => {
    expect((await request(app).put("/settings").set("x-org", "own-tenant").send({ orgName: "Unauthorized" })).status).toBe(403);
    expect(db.organization.update).not.toHaveBeenCalled();
  });
});
