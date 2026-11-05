export const CENTER_COLUMNS = [
  { key: "a2a", label: "A2A", clinical: false },
  { key: "bc", label: "B.C.", clinical: false },
  { key: "fob", label: "FOB at visit", clinical: false },
  { key: "birth", label: "Birth", clinical: false },
  { key: "pregnant", label: "Pregnant", clinical: true },
  { key: "spiritual", label: "Spiritual", clinical: false },
] as const;
export interface CenterDefinition { key: string; description: string; configured: boolean }
export interface VisitFacts { metrics?: Record<string, boolean>; notes?: string }
export function csvCell(value: unknown): string {
  const raw = String(value ?? ""); return `"${(/^[=+@\-\t\r\n]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""')}"`;
}
export function calendarMonth(month: unknown) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a calendar month.");
  const start = new Date(`${month}-01T00:00:00Z`); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
