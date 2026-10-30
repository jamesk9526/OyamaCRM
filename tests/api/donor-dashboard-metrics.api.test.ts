import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  donation: { findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  constituent: { count: vi.fn(), findMany: vi.fn() }, campaign: { count: vi.fn(), aggregate: vi.fn() },
  task: { count: vi.fn() }, grant: { aggregate: vi.fn() }, organizationSettings: { findUnique: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "metrics-org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => {
  req.user = { sub: "metrics-user", email: "metrics@example.invalid", orgId: "metrics-org", role: "admin" }; next();
} }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock("@/server/src/services/letters-execution", () => ({ generateLetterFromTemplate: vi.fn() }));
import reports from "@/server/src/routes/reports";
const app = express(); app.use("/api/reports", reports);

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T12:30:00Z"));
  db.donation.findMany.mockResolvedValue([]);
  db.donation.aggregate.mockResolvedValue({ _sum: { amount: "100.00" }, _count: 3 });
  db.donation.groupBy.mockResolvedValue([{ constituentId: "a" }, { constituentId: "b" }]);
  db.constituent.count.mockResolvedValue(2); db.campaign.count.mockResolvedValue(0);
  db.campaign.aggregate.mockResolvedValue({ _sum: { goal: null } });
  db.grant.aggregate.mockResolvedValue({ _sum: { amountAwarded: null } }); db.task.count.mockResolvedValue(0);
  db.organizationSettings.findUnique.mockResolvedValue({ fiscalYearStart: 7 });
});
afterEach(() => vi.useRealTimers());

describe("donor dashboard reporting contracts", () => {
  it("uses UTC gift-date boundaries, exact averages, and a like-for-like prior year", async () => {
    const response = await request(app).get("/api/reports/summary");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ytdAmount: 100, ytdCount: 3, ytdAverageGift: 33.33, ytdAveragePerDonor: 50, previousPeriodAmount: 100, revenueChangePercent: 0 });
    expect(response.body.period.from).toBe("2026-01-01T00:00:00.000Z");
    expect(response.body.period.yearComparisonThrough).toBe("2025-10-15T12:30:00.000Z");
    expect(db.donation.aggregate.mock.calls[0][0].where).toMatchObject({ constituent: { organizationId: "metrics-org" }, status: "COMPLETED", date: { gte: new Date("2026-01-01T00:00:00Z"), lte: new Date("2026-10-15T12:30:00Z") } });
  });

  it("returns fiscal comparisons in order through the matching partial month", async () => {
    db.donation.findMany.mockResolvedValueOnce([{ date: new Date("2026-07-01T00:00:00Z"), amount: "150" }])
      .mockResolvedValueOnce([{ date: new Date("2025-07-01T00:00:00Z"), amount: "100" }]);
    const response = await request(app).get("/api/reports/giving-trend?dateBasis=fiscal");
    expect(response.status).toBe(200);
    expect(response.body.rangeLabel).toBe("FY 2027");
    expect(response.body.points.map((point: { label: string }) => point.label)).toEqual(["Jul", "Aug", "Sep", "Oct"]);
    expect(response.body).toMatchObject({ total: 150, comparisonTotal: 100, giftCount: 1, trendPercent: 50 });
    expect(db.donation.findMany.mock.calls[0][0].where.date.gte).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(db.donation.findMany.mock.calls[1][0].where.date.lte).toEqual(new Date("2025-10-15T12:30:00Z"));
    expect(response.body.points.at(-1).isPartial).toBe(true);
  });

  it("does not append a thirteenth month or include Jan 1 in the prior full year", async () => {
    const response = await request(app).get("/api/reports/giving-trend?year=2025");
    expect(response.status).toBe(200); expect(response.body.points).toHaveLength(12);
    expect(db.donation.findMany.mock.calls[1][0].where.date).toEqual({ gte: new Date("2024-01-01T00:00:00Z"), lt: new Date("2025-01-01T00:00:00Z") });
  });

  it("applies the same custom window to the chart and fund mix", async () => {
    const query = "?fromDate=2026-03-10&toDate=2026-04-15";
    const trend = await request(app).get(`/api/reports/giving-trend${query}`);
    expect(trend.status).toBe(200);
    const filter = db.donation.findMany.mock.calls[0][0].where.date;
    expect(filter.gte).toEqual(new Date("2026-03-10T00:00:00Z"));
    expect(filter.lt).toEqual(new Date("2026-04-16T00:00:00Z"));
    expect(trend.body.dataThrough).toBe("2026-04-15T23:59:59.999Z");
    const summary = await request(app).get(`/api/reports/summary${query}`);
    expect(summary.body.period.from).toBe("2026-03-10T00:00:00.000Z");
    expect(summary.body.period.through).toBe("2026-04-15T23:59:59.999Z");
    const mix = await request(app).get(`/api/reports/designations-summary${query}`);
    expect(mix.status).toBe(200);
    expect(db.donation.findMany.mock.lastCall?.[0].where.date).toEqual(filter);
  });

  it("honors all-years requests and does not invent an all-time YoY comparison", async () => {
    const trend = await request(app).get("/api/reports/giving-trend?scope=ALL_YEARS");
    expect(trend.status).toBe(200); expect(trend.body.comparisonTotal).toBeNull(); expect(trend.body.rangeLabel).toBe("All years");
    expect(db.donation.findMany).toHaveBeenCalledTimes(1);
    expect(db.donation.findMany.mock.calls[0][0].where.date).toBeUndefined();
    const summary = await request(app).get("/api/reports/summary?scope=ALL_YEARS");
    expect(summary.body.previousPeriodAmount).toBeNull(); expect(summary.body.revenueChangePercent).toBeNull();
    expect(summary.body.period.label).toBe("All years");
  });
});


describe("new donor cohorts", () => {
  it("uses the entire previous UTC month and stable pagination", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:30:00Z"));
    db.constituent.findMany.mockResolvedValue([{ id: "donor-1", firstName: "New", lastName: "Donor", firstGiftDate: "2025-12-31T00:00:00Z" }]);
    db.constituent.count.mockResolvedValue(21);
    const response = await request(app).get("/api/reports/new-donors?month=previous&page=2");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 21, page: 2, totalPages: 3 });
    expect(db.constituent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "metrics-org", firstGiftDate: { gte: new Date("2025-12-01T00:00:00Z"), lt: new Date("2026-01-01T00:00:00Z") } },
      skip: 10, take: 10, orderBy: [{ firstGiftDate: "desc" }, { id: "asc" }],
    }));
    expect(db.constituent.count.mock.lastCall?.[0].where).toEqual(db.constituent.findMany.mock.lastCall?.[0].where);
  });
  it("excludes future first gifts and rejects unsupported months", async () => {
    db.constituent.findMany.mockResolvedValue([]);
    const response = await request(app).get("/api/reports/new-donors");
    expect(response.status).toBe(200);
    expect(db.constituent.findMany.mock.lastCall?.[0].where.firstGiftDate).toEqual({ gte: new Date("2026-10-01T00:00:00Z"), lte: new Date("2026-10-15T12:30:00Z") });
    const bad = await request(app).get("/api/reports/new-donors?month=arbitrary");
    expect(bad.status).toBe(400);
  });
});
