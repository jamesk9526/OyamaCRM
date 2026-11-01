import Link from "next/link";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import { formatDonationDate } from "@/app/components/donations/donation-utils";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData, RetentionData } from "@/app/features/donor-dashboard/types";

export default function DonorRelationshipSummary({data, retention, loading: richLoading, unavailable: giftsUnavailable}: {data: DashboardData | null; retention: RetentionData | null; loading: boolean; unavailable: boolean}) {
  const summaryLoading = richLoading;
  const gifts = data?.recentDonations.slice(0, 6) ?? [];
  return (<section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-label="Constituent relationships">
        <CRMCard padding="md" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Recent gifts</h2>
            <Link href="/donations?allYears=1&status=COMPLETED" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">View donations</Link>
          </div>
          <div aria-live="polite" aria-busy={richLoading}>
            {richLoading ? <p className="py-6 text-sm text-slate-500">Loading recent gifts…</p>
              : giftsUnavailable ? <p className="py-6 text-sm text-slate-600">Recent gifts could not be loaded. Retry to refresh this list.</p>
              : gifts.length === 0 ? <p className="py-6 text-sm text-slate-500">No recent completed gifts.</p>
              : <ul className="divide-y divide-slate-100">{gifts.map((gift) => (
                <li key={gift.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    {gift.constituent ? <Link href={`/constituents/${encodeURIComponent(gift.constituent.id)}`} className="break-words text-sm font-semibold text-slate-900 hover:underline">{gift.constituent.firstName} {gift.constituent.lastName}</Link> : <span className="text-sm text-slate-600">Constituent unavailable</span>}
                    <p className="mt-1 break-words text-xs text-slate-500">{formatDonationDate(gift.date)}{gift.designation?.name ? ` · ${gift.designation.name}` : ""}</p>
                  </div>
                  <Link href={`/donations/${encodeURIComponent(gift.id)}`} className="shrink-0 text-sm font-semibold tabular-nums text-[var(--crm-accent)] hover:underline" aria-label={`View gift of ${formatDashboardCurrency(toDashboardNumber(gift.amount))}`}>{formatDashboardCurrency(toDashboardNumber(gift.amount))}</Link>
                </li>
              ))}</ul>}
          </div>
        </CRMCard>
        <CRMCard padding="md" className="min-w-0 donor-relationship-summary">
          <p className="donor-eyebrow">Relationship health</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Donor retention</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">How many of last year’s donors have given again in this reporting year?</p>
          <div className="mt-4 flex items-end gap-2"><strong className="text-4xl font-semibold tracking-tight text-slate-900">{summaryLoading ? "…" : retention && retention.total > 0 ? `${retention.rate.toFixed(1)}%` : "—"}</strong><span className="pb-1 text-xs text-slate-500">retained so far</span></div>
          {retention && retention.total > 0 && <progress className="donor-campaign-progress mt-3" max={retention.total} value={retention.retained} aria-label={`${retention.retained} of ${retention.total} prior-year donors retained`} />}
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div><dt className="text-xs text-slate-500">Gave again</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{summaryLoading ? "…" : retention?.retained.toLocaleString() ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Yet to give again</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{summaryLoading ? "…" : retention ? Math.max(0, retention.total - retention.retained).toLocaleString() : "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-500">Retained = prior-year donors who gave again this reporting year. This is a year-to-date measure.</p>
          <Link href="/reports?report=comprehensive-donor-analysis" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--crm-accent)] hover:underline">Explore donor retention →</Link>
        </CRMCard>
      </section>);
}
