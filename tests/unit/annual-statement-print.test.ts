import { describe, expect, it } from "vitest";
import { renderAnnualStatements, type AnnualGivingStatement } from "@/app/components/donor-reports/annual-statement-print";

const statement: AnnualGivingStatement = {
  organizationName: "The Pregnancy Care Center",
  organizationAddress: "315 S. Madison Ave., P.O. Box 107, Aurora, MO 65605",
  organizationPhone: "417-678-0090",
  organizationTaxId: "",
  constituent: { id: "donor-a", name: "Paul and Rebecca Haine", addressLines: ["22634 Lawrence 2240", "Aurora, MO 65605"], email: null },
  calendarYear: 2026,
  gifts: [{ date: "2026-03-05T00:00:00.000Z", giftId: "6288", receiptNumber: "R-6288", event: "Gala Fundraiser", comment: "Meal <value>", checkNumber: "2644", paymentMethod: "CHECK", amount: 150, taxDeductibleAmount: 75, taxDeductibleNotes: null }],
  totalAmount: 150,
  taxDeductibleAmount: 75,
  generatedAt: "2026-12-31T00:00:00.000Z",
};

describe("annual donation statement printout", () => {
  it("renders the reference columns, annual totals, and escaped CRM content", () => {
    const html = renderAnnualStatements([statement]);
    expect(html).toContain("Donation Statement");
    expect(html).toContain("Calendar year 2026");
    expect(html).toContain("Gift ID");
    expect(html).toContain("Receipt # R-6288");
    expect(html).toContain("Check #");
    expect(html).toContain("Tax-deductible<br>Amount");
    expect(html).toContain("$150.00");
    expect(html).toContain("$75.00");
    expect(html).toContain("Meal &lt;value&gt;");
    expect(html).not.toContain("Meal <value>");
  });

  it("places each constituent on a separate printable page", () => {
    const html = renderAnnualStatements([statement, { ...statement, constituent: { ...statement.constituent, id: "donor-b", name: "Second Donor" } }]);
    expect(html.match(/class="statement"/g)).toHaveLength(2);
    expect(html).toContain("page-break-after:always");
  });
});
