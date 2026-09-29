import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  donation: { findMany: vi.fn() },
  constituent: { findMany: vi.fn() },
  organization: { findUnique: vi.fn() },
  branding: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: mocks }));
vi.mock("@/server/src/services/organization-branding", () => ({ loadOrganizationBrandingContext: mocks.branding }));

import {
  buildConstituentGivingStatement,
  buildConstituentGivingStatements,
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
  { id: "gift-1", constituentId: "donor-a", amount: "100.00", taxDeductible: true, taxDeductibleAmount: "75.00", taxDeductibleNotes: "Goods valued at $25", date: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), receiptNumber: "R-1", receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CHECK", checkNumber: "2642", notes: "Gala meal", event: { name: "Gala" }, isRecurring: false, designation: null, constituent: donor },
  { id: "gift-2", constituentId: "donor-a", amount: "50.00", taxDeductible: false, taxDeductibleAmount: null, taxDeductibleNotes: null, date: new Date("2026-03-01"), createdAt: new Date("2026-03-01"), receiptNumber: null, receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CASH", checkNumber: null, notes: null, event: null, isRecurring: false, designation: null, constituent: donor },
  { id: "gift-3", constituentId: "donor-a", amount: "25.00", taxDeductible: true, taxDeductibleAmount: null, taxDeductibleNotes: null, date: new Date("2026-04-01"), createdAt: new Date("2026-04-01"), receiptNumber: null, receiptSentAt: null, acknowledgmentSentAt: null, paymentMethod: "CASH", checkNumber: null, notes: null, event: null, isRecurring: false, designation: null, constituent: donor },
];
const options = parseDonorLibraryReportOptions("tax-deductible-giving", { year: "2026" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.donation.findMany.mockResolvedValue(gifts);
  mocks.constituent.findMany.mockResolvedValue([donor]);
  mocks.organization.findUnique.mockResolvedValue({ name: "Community Fund" });
  mocks.branding.mockResolvedValue({ organizationName: "Community Fund", addressLine: "1 Main St, Aurora, MO 65605", contactPhone: "417-555-0100", taxId: "12-3456789" });
});

describe("tax-deductible giving report", () => {
  it("groups completed gifts into one constituent row and separates deductible value", async () => {
    const report = await buildDonorLibraryReport("org-a", "tax-deductible-giving", options);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ calendarYear: 2026, giftCount: 3, totalAmount: 175, taxDeductibleAmount: 100, nonDeductibleAmount: 75 });
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
    expect(statement?.gifts[0]).toMatchObject({ giftId: "gift-1", receiptNumber: "R-1", event: "Gala", comment: "Gala meal", checkNumber: "2642", paymentMethod: "Check" });
    expect(mocks.donation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "COMPLETED", constituentId: { in: ["donor-a"] }, constituent: { organizationId: "org-a" } }),
    }));
    expect(mocks.constituent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["donor-a"] }, organizationId: "org-a" } }));
  });

  it("does not return a statement for a constituent outside the organization", async () => {
    mocks.constituent.findMany.mockResolvedValue([]);
    expect(await buildConstituentGivingStatement("org-a", "other-donor", options)).toBeNull();
  });

  it("uses a full calendar year even if arbitrary dates or fiscal mode are passed", () => {
    const parsed = parseDonorLibraryReportOptions("tax-deductible-giving", { year: "2025", from: "2025-07-01", through: "2025-07-31", dateBasis: "fiscal", paymentMethod: "CASH" });
    expect(parsed.from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(parsed.through.toISOString()).toBe("2025-12-31T23:59:59.999Z");
    expect(parsed.dateBasis).toBe("calendar");
    expect(parsed.paymentMethod).toBeUndefined();
  });

  it("builds selected constituents in one batch and rejects excessive selections", async () => {
    expect(await buildConstituentGivingStatements("org-a", ["donor-a"], options)).toHaveLength(1);
    expect(mocks.donation.findMany).toHaveBeenCalledTimes(1);
    await expect(buildConstituentGivingStatements("org-a", Array.from({ length: 101 }, (_, index) => `donor-${index}`), options)).rejects.toThrow("Select between 1 and 100 constituents.");
  });
});
