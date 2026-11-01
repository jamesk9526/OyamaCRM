import type { DonorDashboardSummary } from "../types";

/** Linear pace estimate from the server's year-to-date interval; no invented momentum. */
export function buildFundraisingForecast(amount: number, period: DonorDashboardSummary["period"]) {
  if (!period || !Number.isFinite(amount) || amount < 0) return null;
  const start = new Date(period.from);
  const through = new Date(period.through);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const elapsed = through.getTime() - start.getTime();
  const duration = end.getTime() - start.getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > duration || duration <= 0) return null;
  const projected = amount * duration / elapsed;
  return { projected, monthlyPace: projected / 12, remainingDays: Math.ceil((duration - elapsed) / 86400000) };
}
