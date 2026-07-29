/**
 * Centralized date-range helpers for OyamaCRM reports and analytics.
 *
 * All helpers return `{ gte, lt }` (inclusive start, exclusive end) using the
 * JavaScript `Date` constructor with local-time arguments so that the server's
 * configured timezone (America/Chicago by default) is respected.
 *
 * WHY EXCLUSIVE END?
 *   `new Date('2025-12-31')` parses as UTC midnight — 2025-12-31T00:00:00Z — so
 *   `lte: new Date('2025-12-31')` misses any donation recorded on Dec 31 with a
 *   time component after midnight UTC.  Using `lt: new Date(year + 1, 0, 1)`
 *   (exclusive Jan 1 of the next year) includes the full last day of any period.
 *
 * @module lib/dateRanges
 */

/** Prisma-compatible date filter for the full calendar year `year`. */
export function getYearRange(year: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(year, 0, 1),         // Jan 1 00:00:00 local
    lt: new Date(year + 1, 0, 1),      // Jan 1 next year (exclusive)
  };
}

/** Bounds a fiscal year start month to January-December. */
export function normalizeFiscalYearStart(month: number | null | undefined): number {
  const parsed = Number.parseInt(String(month ?? 1), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 12) : 1;
}

/** Returns the month number that closes a 12-month fiscal year. */
export function getFiscalYearEndMonth(startMonth: number): number {
  const normalizedStart = normalizeFiscalYearStart(startMonth);
  return ((normalizedStart + 10) % 12) + 1;
}

/**
 * Returns the fiscal year label for a date.
 * For non-January starts, the label is the calendar year in which the fiscal year ends.
 */
export function getFiscalYearForDate(date: Date = new Date(), fiscalYearStart = 1): number {
  const startMonth = normalizeFiscalYearStart(fiscalYearStart);
  if (startMonth === 1) return date.getFullYear();
  return date.getMonth() + 1 >= startMonth ? date.getFullYear() + 1 : date.getFullYear();
}

/** Prisma-compatible date filter for a full fiscal year. */
export function getFiscalYearRange(fiscalYear: number, fiscalYearStart = 1): { gte: Date; lt: Date } {
  const startMonth = normalizeFiscalYearStart(fiscalYearStart);
  const startYear = startMonth === 1 ? fiscalYear : fiscalYear - 1;
  const endYear = startMonth === 1 ? fiscalYear + 1 : fiscalYear;
  return {
    gte: new Date(startYear, startMonth - 1, 1),
    lt: new Date(endYear, startMonth - 1, 1),
  };
}

/** Prisma-compatible fiscal YTD filter: fiscal start through right now. */
export function getFiscalYTDRange(fiscalYearStart = 1, now = new Date()): { gte: Date; lte: Date } {
  const fiscalYear = getFiscalYearForDate(now, fiscalYearStart);
  const range = getFiscalYearRange(fiscalYear, fiscalYearStart);
  return {
    gte: range.gte,
    lte: now,
  };
}

/**
 * Prisma-compatible date filter for a specific calendar month.
 * @param year  Four-digit year.
 * @param month 0-indexed month (0 = January, 11 = December).
 */
export function getMonthRange(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(year, month, 1),
    lt: new Date(year, month + 1, 1),
  };
}

/**
 * Prisma-compatible date filter for a fiscal quarter (calendar-year aligned).
 * @param year    Four-digit year.
 * @param quarter 1–4.
 */
export function getQuarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4
): { gte: Date; lt: Date } {
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  return {
    gte: new Date(year, startMonth, 1),
    lt: new Date(year, startMonth + 3, 1),
  };
}

/** Prisma-compatible YTD filter: Jan 1 of current year through right now. */
export function getYTDRange(now = new Date()): { gte: Date; lte: Date } {
  return {
    gte: new Date(now.getFullYear(), 0, 1),
    lte: now,
  };
}

/** Prisma-compatible MTD filter: 1st of current month through right now. */
export function getMTDRange(now = new Date()): { gte: Date; lte: Date } {
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lte: now,
  };
}

/** Prisma-compatible QTD filter: start of current quarter through right now. */
export function getQTDRange(now = new Date()): { gte: Date; lte: Date } {
  const q = Math.floor(now.getMonth() / 3) as 0 | 1 | 2 | 3;
  return {
    gte: new Date(now.getFullYear(), q * 3, 1),
    lte: now,
  };
}

/**
 * Return the start of the current week (Sunday, midnight local time).
 * Used for the "This Week" dashboard card.
 */
export function getStartOfWeek(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay()); // rewind to Sunday
  return d;
}

export type ReportingYearBasis = "calendar" | "fiscal";

export interface ReportingPeriod {
  basis: ReportingYearBasis;
  year: number;
  label: string;
  start: Date;
  endExclusive: Date;
  through: Date;
  isCurrent: boolean;
}

/** One canonical calendar/fiscal reporting-year contract for dashboards and reports. */
export function getReportingPeriod(options: {
  basis?: ReportingYearBasis;
  year?: number;
  fiscalYearStart?: number;
  now?: Date;
} = {}): ReportingPeriod {
  const now = options.now ?? new Date();
  const basis = options.basis ?? "calendar";
  const fiscalYearStart = normalizeFiscalYearStart(options.fiscalYearStart);
  const currentYear = basis === "fiscal"
    ? getFiscalYearForDate(now, fiscalYearStart)
    : now.getFullYear();
  const year = options.year ?? currentYear;
  const range = basis === "fiscal"
    ? getFiscalYearRange(year, fiscalYearStart)
    : getYearRange(year);
  const isCurrent = year === currentYear;
  return {
    basis,
    year,
    label: basis === "fiscal" ? `FY ${year}` : `Calendar ${year}`,
    start: range.gte,
    endExclusive: range.lt,
    through: isCurrent ? now : new Date(range.lt.getTime() - 1),
    isCurrent,
  };
}

/**
 * Prior-month comparison through the same day and time as the current MTD
 * window. This avoids comparing a partial month with a full prior month.
 */
export function getPriorMonthComparableRange(now = new Date()): { gte: Date; lte: Date; fullMonthEnd: Date } {
  const gte = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fullMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const comparableDay = Math.min(now.getDate(), daysInPriorMonth);
  const lte = new Date(
    gte.getFullYear(),
    gte.getMonth(),
    comparableDay,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return { gte, lte: lte < fullMonthEnd ? lte : new Date(fullMonthEnd.getTime() - 1), fullMonthEnd };
}

/**
 * Donor retention formula helper (pure calculation, not a DB call).
 * Returns the integer percentage 0–100.
 * Returns 0 (not NaN) when `totalLastYear` is zero — safe for display.
 *
 * @param retainedDonors Number of last-year donors who also gave this year.
 * @param totalLastYear  Total distinct donors who gave last year.
 */
export function calcRetentionRate(
  retainedDonors: number,
  totalLastYear: number
): number {
  if (totalLastYear === 0) return 0;
  return Math.round((retainedDonors / totalLastYear) * 100);
}

/**
 * Safe Year-over-Year percentage change.
 * Returns null when `previous` is zero (no prior data).
 * Returns a rounded integer percentage when `previous` > 0.
 *
 * @param current  Current-period value.
 * @param previous Previous-period value.
 */
export function calcYoYPercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
