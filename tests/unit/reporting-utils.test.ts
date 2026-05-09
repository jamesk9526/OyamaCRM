/**
 * Unit tests for server/src/lib/dateRanges.ts.
 * Validates every date-range helper, the retention formula, and the safe YoY
 * percentage function used throughout the OyamaCRM reporting system.
 *
 * Tests are deliberately deterministic: they freeze or mock the current date
 * where needed so results do not drift as time passes.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getYearRange,
  getMonthRange,
  getQuarterRange,
  getYTDRange,
  getMTDRange,
  getQTDRange,
  getStartOfWeek,
  calcRetentionRate,
  calcYoYPercent,
} from "@/server/src/lib/dateRanges";

// ─── getYearRange ─────────────────────────────────────────────────────────────

describe("getYearRange", () => {
  it("returns Jan 1 as start and exclusive Jan 1 next year as end", () => {
    const range = getYearRange(2025);
    expect(range.gte).toEqual(new Date(2025, 0, 1));
    expect(range.lt).toEqual(new Date(2026, 0, 1));
  });

  it("includes a donation at 2025-01-01 00:00:00 local", () => {
    const range = getYearRange(2025);
    const jan1 = new Date(2025, 0, 1, 0, 0, 0);
    expect(jan1 >= range.gte && jan1 < range.lt).toBe(true);
  });

  it("includes a donation at 2025-12-31 23:59:59 local", () => {
    const range = getYearRange(2025);
    const dec31Late = new Date(2025, 11, 31, 23, 59, 59);
    expect(dec31Late >= range.gte && dec31Late < range.lt).toBe(true);
  });

  it("excludes a donation at exactly 2026-01-01 00:00:00 local", () => {
    const range = getYearRange(2025);
    const nextYearStart = new Date(2026, 0, 1, 0, 0, 0);
    expect(nextYearStart >= range.gte && nextYearStart < range.lt).toBe(false);
  });

  it("works for leap year 2024", () => {
    const range = getYearRange(2024);
    const leapDay = new Date(2024, 1, 29, 12, 0, 0);
    expect(leapDay >= range.gte && leapDay < range.lt).toBe(true);
  });
});

// ─── getMonthRange ────────────────────────────────────────────────────────────

describe("getMonthRange", () => {
  it("covers January correctly (month = 0)", () => {
    const range = getMonthRange(2025, 0);
    expect(range.gte).toEqual(new Date(2025, 0, 1));
    expect(range.lt).toEqual(new Date(2025, 1, 1));
  });

  it("covers December correctly (month = 11), rolling over to next year", () => {
    const range = getMonthRange(2025, 11);
    expect(range.gte).toEqual(new Date(2025, 11, 1));
    expect(range.lt).toEqual(new Date(2026, 0, 1));
  });

  it("includes last second of the month", () => {
    const range = getMonthRange(2025, 2); // March
    const mar31Late = new Date(2025, 2, 31, 23, 59, 59);
    expect(mar31Late >= range.gte && mar31Late < range.lt).toBe(true);
  });

  it("excludes first second of following month", () => {
    const range = getMonthRange(2025, 2); // March
    const apr1 = new Date(2025, 3, 1, 0, 0, 0);
    expect(apr1 >= range.gte && apr1 < range.lt).toBe(false);
  });
});

// ─── getQuarterRange ──────────────────────────────────────────────────────────

describe("getQuarterRange", () => {
  it("Q1 spans Jan–Mar", () => {
    const range = getQuarterRange(2025, 1);
    expect(range.gte).toEqual(new Date(2025, 0, 1));
    expect(range.lt).toEqual(new Date(2025, 3, 1));
  });

  it("Q2 spans Apr–Jun", () => {
    const range = getQuarterRange(2025, 2);
    expect(range.gte).toEqual(new Date(2025, 3, 1));
    expect(range.lt).toEqual(new Date(2025, 6, 1));
  });

  it("Q3 spans Jul–Sep", () => {
    const range = getQuarterRange(2025, 3);
    expect(range.gte).toEqual(new Date(2025, 6, 1));
    expect(range.lt).toEqual(new Date(2025, 9, 1));
  });

  it("Q4 spans Oct–Dec", () => {
    const range = getQuarterRange(2025, 4);
    expect(range.gte).toEqual(new Date(2025, 9, 1));
    expect(range.lt).toEqual(new Date(2026, 0, 1));
  });

  it("Q4 Dec 31 late is included", () => {
    const range = getQuarterRange(2025, 4);
    const dec31Late = new Date(2025, 11, 31, 23, 59, 59);
    expect(dec31Late >= range.gte && dec31Late < range.lt).toBe(true);
  });
});

// ─── getYTDRange ──────────────────────────────────────────────────────────────

describe("getYTDRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 10, 30, 0)); // June 15 2025 10:30
  });
  afterEach(() => vi.useRealTimers());

  it("starts on Jan 1 of the current year", () => {
    const range = getYTDRange();
    expect(range.gte).toEqual(new Date(2025, 0, 1));
  });

  it("ends at current time (lte = now)", () => {
    const range = getYTDRange();
    // lte should be approximately now (within a second due to call overhead)
    const now = Date.now();
    expect(Math.abs(range.lte.getTime() - now)).toBeLessThan(1000);
  });

  it("includes a Jan 1 donation", () => {
    const range = getYTDRange();
    const jan1 = new Date(2025, 0, 1, 0, 0, 1);
    expect(jan1 >= range.gte && jan1 <= range.lte).toBe(true);
  });
});

// ─── getMTDRange ──────────────────────────────────────────────────────────────

describe("getMTDRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15)); // June 15 2025
  });
  afterEach(() => vi.useRealTimers());

  it("starts on the 1st of the current month", () => {
    const range = getMTDRange();
    expect(range.gte).toEqual(new Date(2025, 5, 1));
  });

  it("includes June 1 donation", () => {
    const range = getMTDRange();
    const jun1 = new Date(2025, 5, 1, 8, 0, 0);
    expect(jun1 >= range.gte && jun1 <= range.lte).toBe(true);
  });

  it("excludes May 31 donation", () => {
    const range = getMTDRange();
    const may31 = new Date(2025, 4, 31, 23, 59, 59);
    expect(may31 >= range.gte).toBe(false);
  });
});

// ─── getQTDRange ──────────────────────────────────────────────────────────────

describe("getQTDRange", () => {
  afterEach(() => vi.useRealTimers());

  it("returns Q2 start (Apr 1) when in June", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 20)); // June 20
    const range = getQTDRange();
    expect(range.gte).toEqual(new Date(2025, 3, 1)); // April 1
    vi.useRealTimers();
  });

  it("returns Q1 start (Jan 1) when in March", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15)); // March 15
    const range = getQTDRange();
    expect(range.gte).toEqual(new Date(2025, 0, 1)); // January 1
    vi.useRealTimers();
  });

  it("returns Q4 start (Oct 1) when in November", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 10, 5)); // November 5
    const range = getQTDRange();
    expect(range.gte).toEqual(new Date(2025, 9, 1)); // October 1
    vi.useRealTimers();
  });
});

// ─── getStartOfWeek ───────────────────────────────────────────────────────────

describe("getStartOfWeek", () => {
  afterEach(() => vi.useRealTimers());

  it("returns Sunday midnight of the current week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 14, 15, 0, 0)); // Wednesday May 14 2025
    const start = getStartOfWeek();
    // May 11 2025 is the Sunday
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(4); // May
    expect(start.getDate()).toBe(11); // Sunday May 11
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    vi.useRealTimers();
  });

  it("returns same day when already Sunday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 11, 8, 0, 0)); // Sunday May 11
    const start = getStartOfWeek();
    expect(start.getDate()).toBe(11);
    vi.useRealTimers();
  });
});

// ─── calcRetentionRate ────────────────────────────────────────────────────────

describe("calcRetentionRate", () => {
  it("returns 62 for 62 retained out of 100", () => {
    expect(calcRetentionRate(62, 100)).toBe(62);
  });

  it("returns 0 when total is 0 (safe divide-by-zero)", () => {
    expect(calcRetentionRate(0, 0)).toBe(0);
  });

  it("returns 100 for perfect retention", () => {
    expect(calcRetentionRate(50, 50)).toBe(100);
  });

  it("returns 0 when retained is 0", () => {
    expect(calcRetentionRate(0, 200)).toBe(0);
  });

  it("rounds to nearest integer (not floor)", () => {
    // 1 / 3 = 33.33...% → rounds to 33
    expect(calcRetentionRate(1, 3)).toBe(33);
    // 2 / 3 = 66.67...% → rounds to 67
    expect(calcRetentionRate(2, 3)).toBe(67);
  });

  it("does not include new donors in the retained count", () => {
    // New donors are irrelevant to the retention formula — only prior-year donors matter
    // This test documents the contract: totalLastYear excludes new donors
    const retained = 30; // 30 of last year's 50 donors gave again
    const totalLastYear = 50;
    expect(calcRetentionRate(retained, totalLastYear)).toBe(60);
  });
});

// ─── calcYoYPercent ──────────────────────────────────────────────────────────

describe("calcYoYPercent", () => {
  it("returns null when previous is 0 (no prior data)", () => {
    expect(calcYoYPercent(5000, 0)).toBeNull();
  });

  it("returns 0 when there is no change", () => {
    expect(calcYoYPercent(1000, 1000)).toBe(0);
  });

  it("returns positive % for growth", () => {
    // 1500 vs 1000 = +50%
    expect(calcYoYPercent(1500, 1000)).toBe(50);
  });

  it("returns negative % for decline", () => {
    // 500 vs 1000 = -50%
    expect(calcYoYPercent(500, 1000)).toBe(-50);
  });

  it("rounds to nearest integer", () => {
    // 3 / 2 = 50% exactly — no rounding needed
    // 7 / 6 = 16.67% → rounds to 17
    expect(calcYoYPercent(7, 6)).toBe(17);
  });

  it("handles large numbers without overflow", () => {
    // $2,000,000 vs $1,500,000 = +33.33% → 33
    expect(calcYoYPercent(2_000_000, 1_500_000)).toBe(33);
  });
});
