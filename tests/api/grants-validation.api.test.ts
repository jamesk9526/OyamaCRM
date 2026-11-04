import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  grant: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  grantFunder: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  grantActivity: { create: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org" }));
vi.mock("@/server/src/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/server/src/services/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/server/src/middleware/requireAuth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { sub: "synthetic-staff", orgId: "org", email: "staff@example.invalid", role: "admin" }; next();
  },
}));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
import grants from "@/server/src/routes/grants";
const app = express(); app.use(express.json()); app.use("/grants", grants);

beforeEach(() => {
  vi.clearAllMocks();
  db.grantFunder.findFirst.mockResolvedValue({ id: "funder" });
  db.grant.findFirst.mockResolvedValue({ status: "IDEA", assigneeId: null, title: "Synthetic grant" });
  db.user.findFirst.mockImplementation(async ({ where }) => where.id === "allowed-staff" && where.organizationId === "org" && where.active === true && where.role.not === "compassion_user" ? { id: where.id } : null);
  db.grant.create.mockImplementation(async ({ data }) => ({ id: "grant", ...data }));
  db.grant.update.mockImplementation(async ({ data }) => ({ id: "grant", title: "Synthetic grant", ...data }));
  db.grantActivity.create.mockResolvedValue({ id: "activity" });
});

describe("grant create/update validation", () => {
  it.each(["foreign-staff", "inactive-staff", "clinical-staff"])("rejects an unavailable assignee %s before writing or notifying", async assigneeId => {
    for (const method of ["post", "patch"] as const) {
      const response = await request(app)[method](method === "post" ? "/grants" : "/grants/grant").send({ funderId: "funder", title: "Synthetic grant", assigneeId });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("organization");
    }
    expect(db.grant.create).not.toHaveBeenCalled(); expect(db.grant.update).not.toHaveBeenCalled();
  });
  it.each([
    { amountRequested: -1 }, { amountAwarded: "NaN" }, { amountRequested: "Infinity" },
    { amountRequested: 10000000000 }, { amountRequested: false },
    { applicationDeadline: "2026-02-31" }, { loiDeadline: "invalid" },
    { requiresLOI: "false" }, { title: "   " },
  ])("rejects invalid grant fields %j before either write", async input => {
    for (const method of ["post", "patch"] as const) {
      expect((await request(app)[method](method === "post" ? "/grants" : "/grants/grant").send({ funderId: "funder", title: "Synthetic grant", ...input })).status).toBe(400);
    }
    expect(db.grant.create).not.toHaveBeenCalled(); expect(db.grant.update).not.toHaveBeenCalled();
  });
  it("accepts organization staff, zero amounts, and valid dates", async () => {
    const response = await request(app).post("/grants").send({ funderId: "funder", title: "Synthetic grant", assigneeId: "allowed-staff", amountRequested: 0, applicationDeadline: "2028-02-29", requiresLOI: false });
    expect(response.status).toBe(201);
    expect(db.grant.create.mock.calls[0][0].data.amountRequested).toBe(0);
    expect(db.user.findFirst).toHaveBeenCalledWith({ where: { id: "allowed-staff", organizationId: "org", active: true, role: { not: "compassion_user" } }, select: { id: true } });
  });
  it("clears optional amounts/dates/assignee and accepts numeric form amounts", async () => {
    expect((await request(app).patch("/grants/grant").send({ amountRequested: "", amountAwarded: "25.50", applicationDeadline: null, assigneeId: "" })).status).toBe(200);
    expect(db.grant.update.mock.calls[0][0].data).toMatchObject({ amountRequested: null, amountAwarded: 25.5, applicationDeadline: null, assigneeId: null });
  });
});
