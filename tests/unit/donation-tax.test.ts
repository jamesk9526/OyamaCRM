import { describe, expect, it } from "vitest";
import { resolveDonationTaxDetails } from "@/server/src/services/donation-tax";

describe("resolveDonationTaxDetails", () => {
  it("defaults a deductible gift to the full gift amount", () => {
    expect(resolveDonationTaxDetails({ amount: 100 })).toEqual({
      taxDeductible: true,
      taxDeductibleAmount: 100,
    });
  });

  it("supports a partial deductible amount", () => {
    expect(resolveDonationTaxDetails({
      amount: "100.00",
      taxDeductible: true,
      taxDeductibleAmount: "75.50",
    })).toEqual({
      taxDeductible: true,
      taxDeductibleAmount: 75.5,
    });
  });

  it("sets the deductible amount to zero when the gift is not deductible", () => {
    expect(resolveDonationTaxDetails({
      amount: 100,
      taxDeductible: false,
      taxDeductibleAmount: 75,
    })).toEqual({
      taxDeductible: false,
      taxDeductibleAmount: 0,
    });
  });

  it("rejects a deductible amount greater than the gift", () => {
    expect(() => resolveDonationTaxDetails({
      amount: 100,
      taxDeductibleAmount: 100.01,
    })).toThrow("Tax-deductible amount cannot exceed the gift amount.");
  });

  it("preserves a partial amount when unrelated gift fields are updated", () => {
    expect(resolveDonationTaxDetails(
      { amount: 100, taxDeductible: true },
      { amount: 100, taxDeductible: true, taxDeductibleAmount: 60 },
    )).toEqual({
      taxDeductible: true,
      taxDeductibleAmount: 60,
    });
  });
});
