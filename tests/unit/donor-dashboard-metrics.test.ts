import { describe, expect, it } from "vitest";
import { buildMonthlyGivingComparison, getPriorYearComparisonRange, averageGiftAmount, donationCalendarRange } from "@/server/src/services/donor-dashboard-metrics";

describe("donor dashboard metrics", () => {
  it("includes date-only gifts on the first day of the reporting period on non-UTC hosts", () => {
    const range = donationCalendarRange({ gte: new Date(2026, 6, 1), lt: new Date(2027, 6, 1) });
    expect(range.gte.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2027-07-01T00:00:00.000Z");
  });
  it("preserves exclusive year boundaries when comparing a historical year", () => {
    const range = getPriorYearComparisonRange({ gte: new Date("2025-01-01T00:00:00Z"), lt: new Date("2026-01-01T00:00:00Z") });
    expect(range).toEqual({ gte: new Date("2024-01-01T00:00:00Z"), lt: new Date("2025-01-01T00:00:00Z") });
  });
  it("clamps leap day to February rather than comparing into March", () => {
    expect(getPriorYearComparisonRange({ gte: new Date("2024-01-01T00:00:00Z"), lte: new Date("2024-02-29T15:00:00Z") })).toEqual({
      gte: new Date("2023-01-01T00:00:00Z"), lte: new Date("2023-02-28T15:00:00Z"),
    });
  });
  it("does not invent a comparison for all-time giving", () => {
    expect(getPriorYearComparisonRange(undefined)).toBeUndefined();
  });
  it("rounds averages to cents and handles zero gifts", () => {
    expect(averageGiftAmount("100.00", 3)).toBe(33.33);
    expect(averageGiftAmount("0.03", 2)).toBe(0.02);
    expect(averageGiftAmount("10.00", 0)).toBe(0);
  });
  it("produces exactly twelve historical buckets and excludes next-year gifts", () => {
    const range = { gte: new Date("2025-01-01T00:00:00Z"), lt: new Date("2026-01-01T00:00:00Z") };
    const result = buildMonthlyGivingComparison([
      { date: new Date("2025-12-31T23:59:59Z"), amount: "0.10" },
      { date: new Date("2025-12-31T00:00:00Z"), amount: "0.20" },
      { date: new Date("2026-01-01T00:00:00Z"), amount: "99.99" },
    ], [], range);
    expect(result.points).toHaveLength(12);
    expect(result.points.at(-1)).toMatchObject({ label: "Dec", amount: 0.3, giftCount: 2, previousAmount: 0, isPartial: false });
    expect(result.total).toBe(0.3);
    expect(result.giftCount).toBe(2);
    expect(result.trendPercent).toBeNull();
  });
  it("keeps fiscal month order, fills observed gaps, and compares only elapsed time", () => {
    const range = { gte: new Date("2026-07-01T00:00:00Z"), lte: new Date("2026-10-15T12:00:00Z") };
    const result = buildMonthlyGivingComparison([
      { date: new Date("2026-07-01T00:00:00Z"), amount: "10.00" },
      { date: new Date("2026-10-15T12:00:00Z"), amount: "30.00" },
    ], [
      { date: new Date("2025-07-10T00:00:00Z"), amount: "15.00" },
      { date: new Date("2025-10-15T12:00:00Z"), amount: "5.00" },
      { date: new Date("2025-10-20T00:00:00Z"), amount: "1000.00" },
    ], range);
    expect(result.points.map((point) => point.label)).toEqual(["Jul", "Aug", "Sep", "Oct"]);
    expect(result.points.at(-1)).toMatchObject({ previousAmount: 5, isPartial: true });
    expect(result.points[1]).toMatchObject({ amount: 0, previousAmount: 0 });
    expect(result.comparisonTotal).toBe(20);
    expect(result.trendPercent).toBe(100);
  });
  it("respects a custom date window in totals and partial buckets", () => {
    const range = { gte: new Date("2026-03-10T00:00:00Z"), lt: new Date("2026-04-16T00:00:00Z") };
    const result = buildMonthlyGivingComparison([
      { date: new Date("2026-03-01T00:00:00Z"), amount: "1000" },
      { date: new Date("2026-03-10T00:00:00Z"), amount: "10" },
      { date: new Date("2026-04-15T23:59:59Z"), amount: "20" },
    ], [], range);
    expect(result.points.map((point) => point.label)).toEqual(["Mar", "Apr"]);
    expect(result.points.every((point) => point.isPartial)).toBe(true);
    expect(result.total).toBe(30);
  });
  it("keeps separate years identifiable in an all-time chart", () => {
    const result = buildMonthlyGivingComparison([
      { date: new Date("2024-12-01T00:00:00Z"), amount: "10" },
      { date: new Date("2025-01-01T00:00:00Z"), amount: "20" },
    ], [], undefined);
    expect(result.points.map((point) => point.month)).toEqual(["2024-12", "2025-01"]);
    expect(result.points.map((point) => point.previousAmount)).toEqual([null, null]);
    expect(result.comparisonTotal).toBeNull();
    expect(result.total).toBe(30);
  });
});
