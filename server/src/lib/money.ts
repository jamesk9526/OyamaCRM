/**
 * Money helpers for reporting code.
 *
 * Database Decimal values are converted through their string representation so
 * additions happen in integer cents instead of binary floating point.
 */
export function moneyToCents(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const fallback = Number(raw);
    return Number.isFinite(fallback) ? Math.round(fallback * 100) : 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number.parseInt(match[2], 10);
  const fractional = `${match[3] ?? ""}00`.slice(0, 3);
  const firstTwo = Number.parseInt(fractional.slice(0, 2), 10);
  const rounded = firstTwo + (Number(fractional[2]) >= 5 ? 1 : 0);
  return sign * (whole * 100 + rounded);
}

export function centsToMoney(value: number): number {
  return Math.round(value) / 100;
}

export function sumMoney(values: Iterable<unknown>): number {
  let total = 0;
  for (const value of values) total += moneyToCents(value);
  return centsToMoney(total);
}
