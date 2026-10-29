export interface AvailabilityWindow { day: number; start: string; end: string }
export function validAvailability(value: unknown): value is AvailabilityWindow[] {
  if (!Array.isArray(value) || value.length > 40) return false;
  return value.every((row) => row && Number.isInteger(row.day) && row.day >= 0 && row.day <= 6 && typeof row.start === "string" && typeof row.end === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.end) && row.start < row.end);
}
/** Actual instants are converted into each resource's IANA zone, including DST offsets. */
export function withinAvailability(start: Date, end: Date, timezone: string, windows: unknown): boolean {
  if (windows === null || windows === undefined) return true;
  if (!validAvailability(windows)) return false;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const a = parts(start); const b = parts(end);
  if (a.year !== b.year || a.month !== b.month || a.day !== b.day) return false;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(a.weekday);
  const first = `${a.hour}:${a.minute}`; const last = `${b.hour}:${b.minute}`;
  return windows.some((window) => window.day === weekday && window.start <= first && window.end >= last && first < last);
}
