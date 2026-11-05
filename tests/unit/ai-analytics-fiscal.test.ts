/** Synthetic gifts exercise fiscal cohorts through the actual analytics service. */
import type { Request } from "express";
import type { ChatGptGrant } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
vi.mock("@/server/src/ai-access/policy", () => ({
  demandAccess: async () => ({ mode: "automatic", constraints: [], limits: { maxRows: 100 } }),
  decideAccess: async () => ({ mode: "blocked", constraints: [] }),
}));
import { runAnalytics } from "@/server/src/ai-access/analytics";
const req = { user: { sub: "staff", orgId: "org", role: "admin" } } as Request;
const grant = {} as ChatGptGrant;
beforeEach(async () => {
  resetCreateRows();
  await db.organizationSettings.create({ data: { organizationId: "org", fiscalYearStart: 7, currency: "USD", timezone: "America/Chicago" } });
  for (const id of ["retained", "lapsed", "new", "boundary"]) await db.constituent.create({ data: { id, organizationId: "org" } });
});
async function gift(id: string, donor: string, date: string, amount = "10.01", extra = {}) {
  await db.donation.create({ data: { id, constituentId: donor, date: new Date(date), amount, status: "COMPLETED", isRecurring: false, ...extra } });
}
describe("AI fiscal donor calculations", () => {
  it("compares fiscal years across leap day without losing the prior July 1 cohort", async () => {
    await gift("a", "retained", "2023-07-01T00:00:00Z");
    await gift("b", "lapsed", "2024-06-30T23:59:59.999Z");
    await gift("c", "retained", "2024-07-01T00:00:00Z");
    await gift("d", "new", "2025-06-30T23:59:59.999Z");
    await gift("excluded", "boundary", "2025-07-01T00:00:00Z");
    const result = await runAnalytics(req, grant, "donor-retention", "2024-07-01", "2025-06-30", "https://example.invalid");
    expect(result.summary).toMatchObject({ priorDonors: 2, currentDonors: 2, retainedDonors: 1, retentionPercent: 50,
      comparison: { from: "2023-07-01T00:00:00.000Z", through: "2024-06-30T23:59:59.999Z", basis: "PRIOR_YEAR_SAME_DATES" } });
    expect(result.totalCompletedGiving).toBe(20.02);
  });
  it("counts distinct recurring donors, first-time donors and cents without pending gifts", async () => {
    await gift("old", "retained", "2024-01-01T00:00:00Z");
    await gift("repeat1", "retained", "2025-07-01T00:00:00Z", "0.10", { isRecurring: true });
    await gift("repeat2", "retained", "2026-06-30T00:00:00Z", "0.20", { isRecurring: true });
    await gift("first", "new", "2025-07-01T00:00:00Z", "1.01");
    await gift("pending", "lapsed", "2025-08-01T00:00:00Z", "9000", { status: "PENDING" });
    const recurring = await runAnalytics(req, grant, "recurring-giving", "2025-07-01", "2026-06-30", "https://example.invalid");
    expect(recurring.summary).toEqual({ gifts: 2, distinctDonors: 1, amount: 0.3 });
    expect(recurring.totalCompletedGiving).toBe(1.31);
    const first = await runAnalytics(req, grant, "first-time-donors", "2025-07-01", "2026-06-30", "https://example.invalid");
    expect(first.summary.matchingDonors).toBe(1);
    expect(first.rows).toEqual([]); // aggregate-only access exposes no donor records
  });
});
