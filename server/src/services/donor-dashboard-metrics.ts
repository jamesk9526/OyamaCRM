/** Donation dates are calendar dates stored at UTC midnight, including imported gifts. */
import type { Prisma } from "@prisma/client";
import { calcYoYPercent } from "../lib/dateRanges.js";
import { centsToMoney, moneyToCents } from "../lib/money.js";

/** Convert local calendar boundaries to the UTC calendar dates used by gift storage. */
export function donationCalendarRange(range: { gte: Date; lt: Date }) {
  const boundary = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return { gte: boundary(range.gte), lt: boundary(range.lt) };
}

function dateValue(value: unknown): Date | undefined {
  if (!(value instanceof Date) && typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/** Same calendar day/time one year earlier, clamping Feb 29 rather than rolling into March. */
function priorYear(date: Date): Date {
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

export function getPriorYearComparisonRange(range: Prisma.DateTimeFilter | undefined): Prisma.DateTimeFilter | undefined {
  const gte = dateValue(range?.gte);
  if (!gte) return undefined;
  const lt = dateValue(range?.lt);
  const lte = dateValue(range?.lte);
  return { gte: priorYear(gte), ...(lt ? { lt: priorYear(lt) } : {}), ...(lte ? { lte: priorYear(lte) } : {}) };
}

export function averageGiftAmount(total: unknown, count: number): number {
  return count > 0 ? centsToMoney(moneyToCents(total) / count) : 0;
}

interface Gift { date: Date; amount: unknown }
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

function inRange(date: Date, range?: Prisma.DateTimeFilter): boolean {
  const gte = dateValue(range?.gte); const lt = dateValue(range?.lt); const lte = dateValue(range?.lte);
  return (!gte || date >= gte) && (!lt || date < lt) && (!lte || date <= lte);
}

/** One pass per gift, exact cent totals, observed month gaps, and matched prior-year cutoffs. */
export function buildMonthlyGivingComparison(gifts: Gift[], previousGifts: Gift[], range?: Prisma.DateTimeFilter) {
  const current = gifts.filter((gift) => inRange(gift.date, range));
  const comparisonRange = getPriorYearComparisonRange(range);
  const previous = comparisonRange ? previousGifts.filter((gift) => inRange(gift.date, comparisonRange)) : [];
  const byMonth = new Map<string, { cents: number; count: number }>();
  const previousByMonth = new Map<string, number>();
  let totalCents = 0; let comparisonCents = 0; let earliest = Infinity; let latest = -Infinity;
  for (const gift of current) {
    const key = monthKey(gift.date); const cents = moneyToCents(gift.amount);
    const bucket = byMonth.get(key) ?? { cents: 0, count: 0 };
    bucket.cents += cents; bucket.count += 1; byMonth.set(key, bucket); totalCents += cents;
    earliest = Math.min(earliest, gift.date.getTime()); latest = Math.max(latest, gift.date.getTime());
  }
  for (const gift of previous) {
    const key = `${gift.date.getUTCFullYear() + 1}-${String(gift.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const cents = moneyToCents(gift.amount);
    previousByMonth.set(key, (previousByMonth.get(key) ?? 0) + cents); comparisonCents += cents;
  }

  const start = dateValue(range?.gte) ?? (current.length ? new Date(earliest) : undefined);
  const exclusiveEnd = dateValue(range?.lt);
  const inclusiveEnd = dateValue(range?.lte);
  const end = exclusiveEnd && inclusiveEnd
    ? new Date(Math.min(exclusiveEnd.getTime() - 1, inclusiveEnd.getTime()))
    : exclusiveEnd ? new Date(exclusiveEnd.getTime() - 1)
      : inclusiveEnd ?? (current.length ? new Date(latest) : undefined);
  const points: Array<{ month: string; label: string; amount: number; giftCount: number; previousAmount: number | null; isPartial: boolean }> = [];
  if (start && end) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const key = monthKey(cursor); const bucket = byMonth.get(key);
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1) - 1);
      points.push({
        month: key,
        label: cursor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        amount: centsToMoney(bucket?.cents ?? 0), giftCount: bucket?.count ?? 0,
        previousAmount: comparisonRange ? centsToMoney(previousByMonth.get(key) ?? 0) : null,
        isPartial: Boolean(range) && (start > cursor || end < monthEnd),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const total = centsToMoney(totalCents);
  const comparisonTotal = comparisonRange ? centsToMoney(comparisonCents) : null;
  return { points, total, giftCount: current.length, comparisonTotal, trendPercent: comparisonTotal === null ? null : calcYoYPercent(total, comparisonTotal) };
}
