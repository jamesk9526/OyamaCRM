import type { DesignationSlice } from "../types";
import { toDashboardNumber } from "./dashboard-calculations";

/** Keep every contributed dollar represented when a small chart groups funds. */
export function buildDesignationChart(slices: DesignationSlice[], limit = 4) {
  const combined = new Map<string, number>();
  for (const slice of slices) {
    const amount = Math.round(toDashboardNumber(slice.amount) * 100);
    if (amount <= 0) continue;
    const name = slice.name.trim() || "Unassigned";
    combined.set(name, (combined.get(name) ?? 0) + amount);
  }
  const sorted = [...combined].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, row) => sum + row.amount, 0);
  const visible = sorted.slice(0, limit);
  const remaining = sorted.slice(limit).reduce((sum, row) => sum + row.amount, 0);
  if (remaining > 0) visible.push({ name: "Other funds", amount: remaining });
  return { total: total / 100, rows: visible.map((row) => ({ name: row.name, amount: row.amount / 100, percentage: total > 0 ? row.amount / total * 100 : 0 })) };
}
