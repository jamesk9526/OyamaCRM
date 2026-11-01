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

/** Reporting APIs scope gift dates in UTC, including fiscal-year rollover. */
export function getReportingFiscalYearForDate(date = new Date(), fiscalYearStart = 1): number {
  const start = normalizeFiscalYearStart(fiscalYearStart);
  return start === 1 || date.getUTCMonth() + 1 < start ? date.getUTCFullYear() : date.getUTCFullYear() + 1;
}

let inMemoryReportingMode: ReportingYearMode = "calendar";
let sessionOnlyReportingMode = false;

export function getStoredReportingYearMode(): ReportingYearMode {
  if (typeof window === "undefined") return "calendar";
  if (sessionOnlyReportingMode) return inMemoryReportingMode;
  try {
    inMemoryReportingMode = window.localStorage.getItem(REPORTING_YEAR_MODE_STORAGE_KEY) === "fiscal" ? "fiscal" : "calendar";
  } catch { /* Keep the active session usable when storage is blocked. */ }
  return inMemoryReportingMode;
}

export function setStoredReportingYearMode(mode: ReportingYearMode) {
  if (typeof window === "undefined") return;
  inMemoryReportingMode = mode;
  try { window.localStorage.setItem(REPORTING_YEAR_MODE_STORAGE_KEY, mode); sessionOnlyReportingMode = false; } catch { sessionOnlyReportingMode = true; }
  window.dispatchEvent(new CustomEvent("reporting-year-mode:changed", { detail: { mode } }));
}
