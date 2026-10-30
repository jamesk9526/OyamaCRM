import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ constituent: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => {
  req.user = { sub: "user", email: "qa@example.invalid", role: "staff", orgId: "org" }; next();
} }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
import router from "@/server/src/routes/constituents";
const app = express(); app.use("/api/constituents", router);
beforeEach(() => { vi.clearAllMocks(); db.constituent.findMany.mockResolvedValue([]); db.constituent.count.mockResolvedValue(0); });

describe("dashboard donor record handoff", () => {
  it("filters by completed donations in the exact tenant and reporting period", async () => {
    const from = "2026-01-01T00:00:00.000Z", through = "2026-10-30T12:34:56.000Z";
    const response = await request(app).get(`/api/constituents?${new URLSearchParams({ givingFrom: from, givingThrough: through, page: "1" })}`);
    expect(response.status).toBe(200);
    expect(db.constituent.findMany.mock.lastCall?.[0].where).toMatchObject({ organizationId: "org", donations: { some: { status: "COMPLETED", date: { gte: new Date(from), lte: new Date(through) } } } });
    expect(db.constituent.count.mock.calls[0][0].where).toEqual(db.constituent.findMany.mock.lastCall?.[0].where);
  });
  it.each([
    { givingFrom: "bad", givingThrough: "2026-10-01" },
    { givingFrom: "2026-10-01" },
    { givingFrom: "2026-10-02", givingThrough: "2026-10-01" },
  ])("rejects incomplete or invalid periods: %o", async (query) => {
    const response = await request(app).get("/api/constituents").query(query);
    expect(response.status).toBe(400); expect(db.constituent.findMany).not.toHaveBeenCalled();
  });
});
