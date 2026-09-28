import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  donation: { findMany: vi.fn() },
  constituent: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: mocks }));

import {
  buildConstituentGivingStatement,
  buildDonorLibraryReport,
  parseDonorLibraryReportOptions,
} from "@/server/src/services/donor-report-library";

const donor = {
  id: "donor-a",
  firstName: "Alex",
  lastName: "Rivera",
  displayName: null,
  organizationName: null,
  email: "alex@example.com",
  addressLine1: "1 Main St",
  addressLine2: null,
  city: "Aurora",
  state: "MO",
  zip: "65605",
};
const gifts = [
  { id: "gift-1", amount: "100.00", taxDeductible: true, taxDeductibleAmount: "75.00", taxDeductibleNotes: "Goods valued at $25", date: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), receiptNumber: "R-1", receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CHECK", isRecurring: false, designation: null, constituent: donor },
  { id: "gift-2", amount: "50.00", taxDeductible: false, taxDeductibleAmount: null, taxDeductibleNotes: null, date: new Date("2026-03-01"), createdAt: new Date("2026-03-01"), receiptNumber: null, receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CASH", isRecurring: false, designation: null, constituent: donor },
  { id: "gift-3", amount: "25.00", taxDeductible: true, taxDeductibleAmount: null, taxDeductibleNotes: null, date: new Date("2026-04-01"), createdAt: new Date("2026-04-01"), receiptNumber: null, receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CASH", isRecurring: false, designation: null, constituent: donor },
];
const options = parseDonorLibraryReportOptions("tax-deductible-giving", { from: "2026-01-01", through: "2026-12-31" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.donation.findMany.mockResolvedValue(gifts);
  mocks.constituent.findFirst.mockResolvedValue(donor);
  mocks.organization.findUnique.mockResolvedValue({ name: "Community Fund" });
});

describe("tax-deductible giving report", () => {
  it("groups completed gifts into one constituent row and separates deductible value", async () => {
    const report = await buildDonorLibraryReport("org-a", "tax-deductible-giving", options);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ giftCount: 3, totalAmount: 175, taxDeductibleAmount: 100, nonDeductibleAmount: 75 });
    expect(report.summary).toContainEqual({ label: "Tax-deductible total", value: 100, type: "currency" });
    expect(mocks.donation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "COMPLETED", constituent: { organizationId: "org-a" } }),
    }));
  });

  it("prints the same filtered gifts and totals without changing receipt state", async () => {
    const statement = await buildConstituentGivingStatement("org-a", "donor-a", options);
    expect(statement).toMatchObject({ organizationName: "Community Fund", totalAmount: 175, taxDeductibleAmount: 100 });
    expect(statement?.gifts.map((gift) => gift.taxDeductibleAmount)).toEqual([75, 0, 25]);
    expect(statement?.gifts[0].taxDeductibleNotes).toBe("Goods valued at $25");
    expect(mocks.donation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "COMPLETED", constituentId: "donor-a", constituent: { organizationId: "org-a" } }),
    }));
    expect(mocks.constituent.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "donor-a", organizationId: "org-a" } }));
  });

  it("does not return a statement for a constituent outside the organization", async () => {
    mocks.constituent.findFirst.mockResolvedValue(null);
    expect(await buildConstituentGivingStatement("org-a", "other-donor", options)).toBeNull();
  });
});
