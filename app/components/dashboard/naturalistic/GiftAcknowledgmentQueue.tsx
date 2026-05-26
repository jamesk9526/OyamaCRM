/**
 * GiftAcknowledgmentQueue highlights real completed gifts that still need acknowledgment.
 */
"use client";

import Link from "next/link";
import type { DonationPreview } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

interface GiftAcknowledgmentQueueProps {
  donations: DonationPreview[];
  loading: boolean;
}

function donorName(donation: DonationPreview): string {
  const first = donation.constituent?.firstName ?? "";
  const last = donation.constituent?.lastName ?? "";
  return `${first} ${last}`.trim() || "Anonymous donor";
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GiftAcknowledgmentQueue({ donations, loading }: GiftAcknowledgmentQueueProps) {
  const unacknowledged = donations.filter((donation) => !donation.acknowledgmentSentAt);
  const total = unacknowledged.reduce((sum, donation) => sum + toDashboardNumber(donation.amount), 0);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Acknowledgment Queue</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Completed gifts still needing receipt or thank-you follow-up</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          {loading ? "..." : unacknowledged.length.toLocaleString()}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-50" />
          ))}
        </div>
      ) : unacknowledged.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-600">No gifts waiting for acknowledgment.</p>
          <p className="mt-1 text-xs text-slate-400">New completed gifts without an acknowledgment timestamp will appear here.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Open value</p>
            <p className="mt-0.5 text-xl font-bold text-slate-950">{formatDashboardCurrency(total)}</p>
          </div>
          <div className="space-y-2">
            {unacknowledged.slice(0, 4).map((donation) => (
              <Link
                key={donation.id}
                href={donation.constituent?.id ? `/constituents/${donation.constituent.id}` : "/donations"}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{donorName(donation)}</p>
                  <p className="truncate text-xs text-slate-400">{donation.designation?.name ?? donation.campaign?.name ?? "Undesignated"} · {shortDate(donation.date)}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-emerald-700">{formatDashboardCurrency(toDashboardNumber(donation.amount))}</p>
              </Link>
            ))}
          </div>
          {unacknowledged.length > 4 ? (
            <Link href="/donations?acknowledgment=pending" className="mt-3 inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-900">
              View {unacknowledged.length - 4} more pending acknowledgments
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
