/**
 * GivingSourceMixCard summarizes payment/source mix from real recent completed gifts.
 */
"use client";

import type { DonationPreview } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

interface GivingSourceMixCardProps {
  donations: DonationPreview[];
  loading: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: "Card",
  ACH: "ACH",
  CHECK: "Check",
  CASH: "Cash",
  WIRE: "Wire",
  STOCK: "Stock",
  IN_KIND: "In-kind",
  ONLINE: "Online",
  CRYPTO: "Crypto",
  OTHER: "Other",
};

export default function GivingSourceMixCard({ donations, loading }: GivingSourceMixCardProps) {
  const rows = Array.from(donations.reduce((map, donation) => {
    const key = donation.paymentMethod ?? "OTHER";
    const existing = map.get(key) ?? { method: key, label: METHOD_LABELS[key] ?? "Other", amount: 0, count: 0 };
    existing.amount += toDashboardNumber(donation.amount);
    existing.count += 1;
    map.set(key, existing);
    return map;
  }, new Map<string, { method: string; label: string; amount: number; count: number }>()).values())
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Giving Source Mix</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">Payment methods from recent completed gifts</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-50" />)}
        </div>
      ) : rows.length === 0 || total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-600">No payment source data yet.</p>
          <p className="mt-1 text-xs text-slate-400">Completed gifts with payment methods will populate this card.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Recent total</p>
            <p className="mt-0.5 text-xl font-bold text-slate-950">{formatDashboardCurrency(total)}</p>
          </div>
          {rows.slice(0, 5).map((row) => {
            const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
            return (
              <div key={row.method}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span className="text-slate-500">{row.count.toLocaleString()} gifts · {formatDashboardCurrency(row.amount)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
