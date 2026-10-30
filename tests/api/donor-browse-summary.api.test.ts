import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ constituent: { findMany: vi.fn(), count: vi.fn() }, donation: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() }, organizationSettings: { findUnique: vi.fn() } }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "browse-org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => { req.user = { sub: "browse-user", email: "browse@example.invalid", orgId: "browse-org", role: "admin" }; next(); } }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock("@/server/src/services/letters-execution", () => ({ generateLetterFromTemplate: vi.fn() }));
import constituents from "@/server/src/routes/constituents";
import donations from "@/server/src/routes/donations";
const app = express(); app.use("/api/constituents", constituents); app.use("/api/donations", donations);

beforeEach(() => {
  vi.resetAllMocks(); db.constituent.findMany.mockResolvedValue([]); db.constituent.count.mockResolvedValue(0);
  db.donation.findMany.mockResolvedValue([]); db.donation.count.mockResolvedValue(3); db.donation.aggregate.mockResolvedValue({ _sum: { amount: "100.01" } });
  db.organizationSettings.findUnique.mockResolvedValue({ fiscalYearStart: 7 });
});

describe("donor browse metrics and handoff scopes", () => {
  it("intersects the selected type/status with every constituent summary rather than overwriting them", async () => {
    const response = await request(app).get("/api/constituents?page=1&status=LAPSED&type=DONOR&search=Taylor");
    expect(response.status).toBe(200);
    const base = db.constituent.count.mock.calls[0][0].where;
    expect(base).toMatchObject({ organizationId: "browse-org", donorStatus: "LAPSED", type: "DONOR" });
    for (const call of db.constituent.count.mock.calls.slice(1)) expect(call[0].where.AND[0]).toEqual(base);
    expect(db.constituent.count.mock.calls[1][0].where.AND[1]).toEqual({ donorStatus: { in: ["ACTIVE", "MAJOR_DONOR"] } });
    expect(db.constituent.count.mock.calls[3][0].where.AND[1]).toEqual({ type: "PROSPECT" });
  });

  it("limits needs-thanks to completed gifts and preserves constituent/campaign scope on list and metrics", async () => {
    const query = "?constituentId=supporter-1&campaignId=appeal-2&acknowledgment=pending&from=2026-01-01&to=2026-10-30";
    expect((await request(app).get(`/api/donations${query}`)).status).toBe(200);
    const response = await request(app).get(`/api/donations/stats${query}`);
    expect(response.status).toBe(200);
    const listWhere = db.donation.findMany.mock.calls[0][0].where;
    expect(listWhere.AND).toContainEqual({ constituentId: "supporter-1" });
    expect(listWhere.AND).toContainEqual({ campaignId: "appeal-2" });
    expect(listWhere.AND).toContainEqual({ acknowledgmentSentAt: null, status: "COMPLETED" });
    expect(db.donation.aggregate.mock.calls[0][0].where.AND[0]).toEqual(listWhere);
    expect(response.body).toMatchObject({ totalRaised: 100.01, completed: 3, averageGift: 33.34, pendingAcknowledgments: 3 });
  });

  it("returns a zero average for no completed gifts and keeps pending-count filters explicit", async () => {
    db.donation.count.mockResolvedValue(0); db.donation.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const response = await request(app).get("/api/donations/stats?status=PENDING");
    expect(response.status).toBe(200); expect(response.body.averageGift).toBe(0);
    const pendingWhere = db.donation.count.mock.calls.at(-1)![0].where;
    expect(pendingWhere.AND[0].AND).toContainEqual({ status: "PENDING" });
    expect(pendingWhere.AND[1]).toEqual({ status: "COMPLETED", acknowledgmentSentAt: null });
  });

  it("uses UTC midnight at the first calendar day for calendar and fiscal giving scopes", async () => {
    for (const basis of ["calendar", "fiscal"]) {
      await request(app).get(`/api/donations/stats?scope=CURRENT_YEAR&dateBasis=${basis}`);
      const filter = db.donation.aggregate.mock.calls.at(-1)![0].where.AND[0].AND.find((entry: { date?: unknown }) => entry.date)?.date;
      expect(filter.gte.getUTCHours()).toBe(0); expect(filter.gte.getUTCDate()).toBe(1);
    }
  });
});
