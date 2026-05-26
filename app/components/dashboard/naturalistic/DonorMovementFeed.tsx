/**
 * DonorMovementFeed shows a live timeline of recent donor activity:
 * recent gifts, new donors, thank-you letters, and upcoming follow-ups.
 * Feels like a soft editorial timeline rather than a dense data table.
 */
"use client";

import Link from "next/link";

interface DonationPreview {
  id: string;
  amount: number | string;
  date: string;
  paymentMethod?: string | null;
  constituent?: { id: string; firstName: string; lastName: string } | null;
  campaign?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
}

interface DonorMovementFeedProps {
  donations: DonationPreview[];
  loading: boolean;
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "Scheduled";
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function donorInitials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
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
};

/** DonorMovementFeed — editorial-style timeline of recent gifts. */
export default function DonorMovementFeed({ donations, loading }: DonorMovementFeedProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Recent Donor Movement</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Latest gifts and activity across your organization</p>
        </div>
        <Link href="/donations" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition">
          View all
        </Link>
      </div>

      {/* Feed */}
      <div className="divide-y divide-slate-50">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : donations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">No recent donor movement yet.</p>
            <p className="mt-1 max-w-xs text-xs text-slate-400">Once donations, tasks, or communications are added, they will appear here.</p>
            <Link href="/donations?recordGift=1" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
              Record first gift
            </Link>
          </div>
        ) : (
          donations.slice(0, 8).map((donation) => {
            const first = donation.constituent?.firstName ?? "";
            const last = donation.constituent?.lastName ?? "";
            const name = `${first} ${last}`.trim() || "Anonymous";
            const initials = donorInitials(first, last);
            const amount = toNumber(donation.amount);
            const context = donation.designation?.name ?? donation.campaign?.name ?? "Undesignated";
            const method = METHOD_LABELS[donation.paymentMethod ?? ""] ?? null;

            return (
              <Link
                key={donation.id}
                href={donation.constituent?.id ? `/constituents/${donation.constituent.id}` : "/donations"}
                className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50/80"
              >
                {/* Avatar */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white shadow-sm">
                  {initials}
                </span>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-400">
                    Gift to <span className="font-medium text-slate-600">{context}</span>
                    {method ? <> · <span className="rounded-sm bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">{method}</span></> : null}
                  </p>
                </div>

                {/* Amount + date */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(amount)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{relativeDate(donation.date)}</p>
                </div>

                {/* Chevron */}
                <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            );
          })
        )}
      </div>

      {!loading && donations.length > 8 ? (
        <div className="border-t border-slate-100 px-6 py-3 text-center">
          <Link href="/donations" className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
            {donations.length - 8} more gifts → View all donations
          </Link>
        </div>
      ) : null}
    </div>
  );
}
