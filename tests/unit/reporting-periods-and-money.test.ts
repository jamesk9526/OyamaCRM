import { describe, expect, it } from "vitest";
import {
  getPriorMonthComparableRange,
  getReportingPeriod,
} from "../../server/src/lib/dateRanges";
import { centsToMoney, moneyToCents, sumMoney } from "../../server/src/lib/money";

describe("reporting period consistency", () => {
  it("labels a July-start fiscal year by the year in which it ends", () => {
    const now = new Date(2026, 6, 29, 13, 30);
    const period = getReportingPeriod({ basis: "fiscal", fiscalYearStart: 7, now });

    expect(period.year).toBe(2027);
    expect(period.label).toBe("FY 2027");
    expect(period.start).toEqual(new Date(2026, 6, 1));
    expect(period.through).toEqual(now);
  });

  it("compares MTD with the same point in the prior month", () => {
    const now = new Date(2026, 6, 29, 14, 15, 10);
    const prior = getPriorMonthComparableRange(now);

    expect(prior.gte).toEqual(new Date(2026, 5, 1));
    expect(prior.lte).toEqual(new Date(2026, 5, 29, 14, 15, 10));
  });

  it("clamps a 31st-day comparison to the prior month end", () => {
    const prior = getPriorMonthComparableRange(new Date(2026, 2, 31, 12));
    expect(prior.lte.getMonth()).toBe(1);
    expect(prior.lte.getDate()).toBe(28);
  });
});

describe("exact report money arithmetic", () => {
  it("preserves cents across additions", () => {
    expect(moneyToCents("498.97")).toBe(49_897);
    expect(sumMoney(["498.97", "184.99", "15.94"])).toBe(699.9);
    expect(centsToMoney(1_015_977)).toBe(10_159.77);
  });

  it("rounds values with more than two decimal places once", () => {
    expect(moneyToCents("1.005")).toBe(101);
    expect(moneyToCents("-1.005")).toBe(-101);
  });
});
