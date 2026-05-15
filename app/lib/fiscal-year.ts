// Fiscal year helpers shared by dashboard, reports, and settings UI.

export type ReportingYearMode = "calendar" | "fiscal";

export const REPORTING_YEAR_MODE_STORAGE_KEY = "oyama-reporting-year-mode";

export function normalizeFiscalYearStart(month: number | null | undefined): number {
  const parsed = Number.parseInt(String(month ?? 1), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 12) : 1;
}

export function getFiscalYearEndMonth(startMonth: number): number {
  const normalizedStart = normalizeFiscalYearStart(startMonth);
  return ((normalizedStart + 10) % 12) + 1;
}

export function getFiscalYearForDate(date = new Date(), fiscalYearStart = 1): number {
  const startMonth = normalizeFiscalYearStart(fiscalYearStart);
  if (startMonth === 1) return date.getFullYear();
  return date.getMonth() + 1 >= startMonth ? date.getFullYear() + 1 : date.getFullYear();
}

export function getStoredReportingYearMode(): ReportingYearMode {
  if (typeof window === "undefined") return "calendar";
  return window.localStorage.getItem(REPORTING_YEAR_MODE_STORAGE_KEY) === "fiscal" ? "fiscal" : "calendar";
}

export function setStoredReportingYearMode(mode: ReportingYearMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORTING_YEAR_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent("reporting-year-mode:changed", { detail: { mode } }));
}
