import { describe, expect, it } from "vitest";
import {
  buildInclusiveCalendarDateFilter,
  parseCalendarDateExclusiveEnd,
  parseCalendarDateStart,
} from "../../server/src/lib/dateOnlyRanges";

describe("inclusive calendar date ranges", () => {
  it("includes the first instant and every timestamp on the selected first day", () => {
    const filter = buildInclusiveCalendarDateFilter("2026-07-01", "2026-07-31");
    expect(filter?.gte?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(new Date("2026-07-01T00:00:00.000Z") >= filter!.gte!).toBe(true);
    expect(new Date("2026-07-01T15:00:00.000Z") >= filter!.gte!).toBe(true);
  });

  it("uses an exclusive next-day end so the full last day is included", () => {
    const filter = buildInclusiveCalendarDateFilter("2026-07-01", "2026-07-31");
    expect(filter?.lt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(new Date("2026-07-31T23:59:59.999Z") < filter!.lt!).toBe(true);
    expect(new Date("2026-08-01T00:00:00.000Z") < filter!.lt!).toBe(false);
  });

  it("normalizes reversed inputs and rejects invalid calendar dates", () => {
    const filter = buildInclusiveCalendarDateFilter("2026-07-31", "2026-07-01");
    expect(filter?.gte?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(filter?.lt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(parseCalendarDateStart("2026-02-31")).toBeUndefined();
    expect(parseCalendarDateExclusiveEnd("2026-02-31")).toBeUndefined();
  });
});
