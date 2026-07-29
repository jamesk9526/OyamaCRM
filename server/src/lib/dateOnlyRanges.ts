export interface InclusiveCalendarDateFilter {
  gte?: Date;
  lt?: Date;
  lte?: Date;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

/** Parses a date input as an inclusive UTC calendar-day start. */
export function parseCalendarDateStart(value: string | null | undefined): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const dateOnly = parseDateOnly(raw);
  if (dateOnly) return new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day));
  if (DATE_ONLY_PATTERN.test(raw)) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Returns the exclusive UTC boundary immediately after a selected calendar day. */
export function parseCalendarDateExclusiveEnd(value: string | null | undefined): Date | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const dateOnly = parseDateOnly(raw);
  if (dateOnly) return new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day + 1));
  return undefined;
}

/**
 * Builds an inclusive human calendar-date filter.
 * Date-only end values use `lt next-day` so every timestamp on the last day is included.
 */
export function buildInclusiveCalendarDateFilter(
  fromValue: string | null | undefined,
  throughValue: string | null | undefined,
): InclusiveCalendarDateFilter | undefined {
  let fromRaw = String(fromValue ?? "").trim();
  let throughRaw = String(throughValue ?? "").trim();
  let from = parseCalendarDateStart(fromRaw);
  let throughStart = parseCalendarDateStart(throughRaw);

  if (from && throughStart && from > throughStart) {
    [fromRaw, throughRaw] = [throughRaw, fromRaw];
    from = parseCalendarDateStart(fromRaw);
    throughStart = parseCalendarDateStart(throughRaw);
  }

  if (!from && !throughStart) return undefined;
  const exclusiveEnd = parseCalendarDateExclusiveEnd(throughRaw);
  return {
    ...(from ? { gte: from } : {}),
    ...(exclusiveEnd ? { lt: exclusiveEnd } : throughStart ? { lte: throughStart } : {}),
  };
}
