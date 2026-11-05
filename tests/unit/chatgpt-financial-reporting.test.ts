/** Known synthetic gifts exercise the real report calculations and MCP result contract. */
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import { callTool } from "@/server/src/chatgpt/tools";
import { DEFAULT_MCP_POLICY, MCP_POLICY_KEY } from "@/server/src/chatgpt/policy";
const req = { user: { sub: "synthetic-user", orgId: "org", role: "admin", email: "user@example.invalid" } } as Request;
const report = (name: string, extra = {}) => callTool(req, "synthetic-grant", "run_report", { report: name, from: "2025-01-01", through: "2025-01-31", ...extra });
beforeEach(async () => {
  resetCreateRows();
  await db.chatGptGrant.create({ data: { id: "synthetic-grant", userId: "synthetic-user", organizationId: "org", scopes: "reports.read", revokedAt: null, refreshExpiresAt: new Date(Date.now() + 86400000) } });
  vi.stubEnv("CHATGPT_PUBLIC_URL", "https://crm.example.invalid");
  await db.organizationSettings.create({ data: { organizationId: "org", currency: "CAD", timezone: "America/Chicago", fiscalYearStart: 7 } });
  for (const id of ["a", "b"]) await db.constituent.create({ data: { id, organizationId: "org" } });
  await db.constituent.create({ data: { id: "foreign", organizationId: "other-org" } });
  await db.campaign.create({ data: { id: "appeal", name: "Synthetic appeal" } });
  await db.designation.create({ data: { id: "fund", name: "Synthetic fund" } });
  const gifts = [
    { id: "first", amount: "0.10", constituentId: "a", paymentMethod: "CASH" },
    { id: "last", amount: "0.20", constituentId: "a", paymentMethod: "CASH", date: new Date("2025-01-31T23:59:59.999Z") },
    { id: "inkind", amount: "100.01", constituentId: "b", paymentMethod: "IN_KIND" },
    { id: "pending", amount: "9000.00", constituentId: "a", status: "PENDING" },
    { id: "refunded", amount: "8000.00", constituentId: "a", status: "REFUNDED" },
    { id: "foreign-gift", amount: "7000.00", constituentId: "foreign" },
    { id: "outside", amount: "6000.00", constituentId: "a", date: new Date("2025-02-01T00:00:00Z") },
  ];
  for (const gift of gifts) await db.donation.create({ data: { status: "COMPLETED", date: new Date("2025-01-01T00:00:00Z"), campaignId: "appeal", designationId: "fund", isRecurring: false, ...gift } });
});
describe("MCP financial reporting semantics", () => {
  it("includes both July 1 and June 30 in a complete fiscal year", async () => {
    for (const [id, date, amount] of [
      ["fy-start", "2025-07-01T00:00:00Z", "10.01"],
      ["fy-end", "2026-06-30T23:59:59.999Z", "20.02"],
      ["next-fy", "2026-07-01T00:00:00Z", "999.00"],
    ]) await db.donation.create({ data: { id, date: new Date(date), amount, constituentId: "a", status: "COMPLETED" } });
    await db.pluginSetting.create({ data: { organizationId: "org", pluginKey: MCP_POLICY_KEY, config: { revision: 1, policy: { ...DEFAULT_MCP_POLICY, defaultDateBasis: "fiscal" } } } });
    const result = await callTool(req, "synthetic-grant", "run_report", { report: "payment-method-summary", dateBasis: "fiscal", year: 2026 }) as Record<string, unknown>;
    expect(result.exactRange).toEqual({ from: "2025-07-01T00:00:00.000Z", through: "2026-06-30T23:59:59.999Z", inclusive: true });
    expect(result.summary).toContainEqual({ label: "Gift total", value: 30.03, type: "currency" });
  });
  it("uses exact money arithmetic, completed status, tenant scope and inclusive cutoff dates", async () => {
    const result = await report("payment-method-summary") as Record<string, unknown>;
    expect(result.summary).toContainEqual({ label: "Gift total", value: 100.31, type: "currency" });
    expect(result.summary).toContainEqual({ label: "Gifts", value: 3, type: "number" });
    expect(result.rows).toContainEqual({ paymentMethod: "CASH", giftCount: 2, donorCount: 1, totalAmount: 0.3, shareOfGiving: 0.3 });
    expect(result.financialContext).toMatchObject({ currency: "CAD", fiscalYearStartMonth: 7 });
    expect(result.exactRange).toEqual({ from: "2025-01-01T00:00:00.000Z", through: "2025-01-31T23:59:59.999Z", inclusive: true });
    expect(result.audienceConstituentIds).toBeUndefined();
  });
  it("preserves campaign/designation attribution and distinct group donor counts", async () => {
    const campaign = await report("campaign-performance") as Record<string, unknown>;
    expect(campaign.rows).toEqual([{ campaign: "Synthetic appeal", giftCount: 3, donorCount: 2, totalAmount: 100.31 }]);
    const designation = await report("designation-performance") as Record<string, unknown>;
    expect(designation.rows).toEqual([{ designation: "Synthetic fund", giftCount: 3, donorCount: 2, totalAmount: 100.31, shareOfGiving: 100 }]);
    expect(String(designation.definition)).toContain("does not establish a legal restriction");
  });
  it("keeps undefined percent changes null when the comparison base is zero", async () => {
    const result = await report("crm-performance-scorecard") as { comparison: { metrics: { changePercent: number | null; prior: number }[] }; financialContext: unknown; summary: unknown[] };
    expect(result.summary).toContainEqual({ label: "Giving revenue", value: 100.31, type: "currency" });
    expect(result.comparison.metrics.every(metric => metric.prior === 0 && metric.changePercent === null)).toBe(true);
    const cells = JSON.stringify(result.comparison); expect(cells).not.toContain("Infinity"); expect(cells).not.toContain("NaN"); expect(cells).not.toContain("twoYearsPrior");
    expect(rows.createDelivery).toHaveLength(0); expect(rows.donation).toHaveLength(7);
    expect(JSON.stringify(result.financialContext)).toContain("not audited financial statements");
  });
  it("returns useful empty results with no fabricated revenue", async () => {
    const result = await report("campaign-performance", { from: "2020-01-01", through: "2020-01-31" }) as Record<string, unknown>;
    expect(result.rows).toEqual([]); expect(result.summary).toContainEqual({ label: "Campaign giving", value: 0, type: "currency" });
    expect(result.truncated).toBe(false);
  });
  it("explains currency, comparison, deductible giving and cash limits without exposing records", async () => {
    const context = await callTool(req, "synthetic-grant", "get_reporting_context", {});
    expect(context).toMatchObject({ currency: "CAD", fiscalYearStartMonth: 7 });
    const serialized = JSON.stringify(context); expect(serialized).toContain("tax-deductible"); expect(serialized).toContain("bank cash"); expect(serialized).toContain("not a financial health rating"); expect(serialized).not.toContain("foreign-gift");
  });
  it("limits displayed group rows without dropping gifts from report totals", async () => {
    await db.pluginSetting.create({ data: { organizationId: "org", pluginKey: MCP_POLICY_KEY, config: { revision: 1, policy: { ...DEFAULT_MCP_POLICY, maxReportRows: 10 } } } });
    for (let n = 0; n < 11; n++) {
      await db.campaign.create({ data: { id: `extra-${n}`, name: `Synthetic group ${n}` } });
      await db.donation.create({ data: { status: "COMPLETED", date: new Date("2025-01-15T00:00:00Z"), campaignId: `extra-${n}`, constituentId: "a", amount: "0.01" } });
    }
    const result = await report("campaign-performance") as { rows: unknown[]; totalRows: number; truncated: boolean; summary: unknown[] };
    expect(result.rows).toHaveLength(10); expect(result.totalRows).toBe(12); expect(result.truncated).toBe(true);
    expect(result.summary).toContainEqual({ label: "Campaign giving", value: 100.42, type: "currency" });
  });
});
