import { describe, expect, it, vi } from "vitest";
import { buildFundraisingForecast } from "@/app/features/donor-dashboard/calculations/fundraising-forecast";
import { unavailableWidgetSource } from "@/app/features/donor-dashboard/widget-availability";
import { getReportingFiscalYearForDate, getStoredReportingYearMode, setStoredReportingYearMode } from "@/app/lib/fiscal-year";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";
const period = (from: string, through: string) => ({from, through} as NonNullable<DonorDashboardSummary["period"]>);

describe("fiscal dashboard audit", () => {
  it("labels fiscal rollover by UTC gift dates, including offset timestamps", () => {
    expect(getReportingFiscalYearForDate(new Date("2026-06-30T18:59:59-05:00"),7)).toBe(2026);
    expect(getReportingFiscalYearForDate(new Date("2026-06-30T19:00:00-05:00"),7)).toBe(2027);
    expect(getReportingFiscalYearForDate(new Date("2026-07-01T00:00:00Z"),1)).toBe(2026);
  });
  it("projects fiscal giving using elapsed days, independent of calendar month", () => {
    const result = buildFundraisingForecast(920,period("2026-07-01T00:00:00Z","2026-10-01T00:00:00Z"));
    expect(result?.projected).toBe(3650);
    expect(result?.remainingDays).toBe(273);
  });
  it("includes leap days in the reporting year", () => {
    expect(buildFundraisingForecast(100,period("2023-07-01T00:00:00Z","2023-07-11T00:00:00Z"))?.projected).toBe(3660);
  });
  it("does not invent a forecast without an elapsed reporting interval", () => {
    expect(buildFundraisingForecast(100,undefined)).toBeNull();
    expect(buildFundraisingForecast(100,period("2026-07-01","2026-07-01"))).toBeNull();
    expect(buildFundraisingForecast(100,period("2026-07-01","2027-07-02"))).toBeNull();
  });
  it("distinguishes unavailable metrics from zero and preserves independent widgets", () => {
    expect(unavailableWidgetSource("revenue",false,true)).toBe("Summary metrics");
    expect(unavailableWidgetSource("retention",true,false)).toBe("Donor retention");
    expect(unavailableWidgetSource("workflow-pressure",true,false)).toBe("Donor retention");
    expect(unavailableWidgetSource("revenue",true,true)).toBeNull();
    expect(unavailableWidgetSource("tasks",false,false)).toBeNull();
  });
});

it("keeps a fiscal selection working when browser persistence fails", () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", {localStorage:{getItem:()=>"calendar",setItem:()=>{throw new Error("quota");}},dispatchEvent});
  try {
    setStoredReportingYearMode("fiscal");
    expect(getStoredReportingYearMode()).toBe("fiscal");
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({mode:"fiscal"});
  } finally {vi.unstubAllGlobals();}
});
