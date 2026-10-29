"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Gift, RefreshCcw, Search, UserPlus } from "lucide-react";
import { DonorDashboardOverviewSections } from "./DonorDashboardOverviewSections";
import { buildStewardshipSuggestions, formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { loadDonorDashboardData } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import type { DashboardData, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import { formatDonationDate } from "@/app/components/donations/donation-utils";
import DonorActionCenter from "./DonorActionCenter";
import DonorDashboardTools from "./DonorDashboardTools";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";

interface NaturalisticDonorDashboardProps {
  greeting: string;
  name: string;
  loading: boolean;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  revenueGoal: number;
  dataThroughLabel: string;
  reportingYearMode: string;
  headerActions?: ReactNode;
  extraSections?: ReactNode;
  onRefresh?: () => void | Promise<void>;
  loadError?: string | null;
}

export default function NaturalisticDonorDashboard({
  greeting, name, loading: summaryLoading, summary, retention,
  dataThroughLabel, reportingYearMode, headerActions, extraSections, onRefresh, loadError,
}: NaturalisticDonorDashboardProps) {
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [richLoading, setRichLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const loadId = useRef(0);
  const loadRichData = useCallback(async () => {
    const id = ++loadId.current;
    setRichLoading(true);
    setRequestError(null);
    try {
      const result = await loadDonorDashboardData({ reportingYearMode });
      if (id === loadId.current) setData(result);
    } catch (error) {
      if (id === loadId.current) setRequestError(error instanceof Error ? error.message : "Could not load dashboard details.");
    } finally {
      if (id === loadId.current) setRichLoading(false);
    }
  }, [reportingYearMode]);
  useEffect(() => {
    void loadRichData();
    return () => { loadId.current += 1; };
  }, [loadRichData]);
  const refresh = () => { void loadRichData(); void onRefresh?.(); };
  const busy = summaryLoading || richLoading;
  const errors = [loadError, requestError, ...(data?.errors ?? [])].filter(Boolean);
  const suggestions = buildStewardshipSuggestions(loadError ? null : summary, loadError ? null : retention);
  const giftsUnavailable = Boolean(requestError || !data
    || data.errors.some((error) => error.startsWith("Recent donor movement")));
  const gifts = data?.recentDonations.slice(0, 6) ?? [];
  const firstName = name.split(" ")[0] || "there";

  return (
    <div className="donor-daily-workspace space-y-5 pb-8">
      <CRMPageHeader breadcrumb="Donor CRM" title={`${greeting}, ${firstName}`}
        description="Care for your donors, follow through on promises, and grow lasting support."
        primaryAction={<Link href="/donations?recordGift=1" className="donor-button donor-button-primary"><Gift className="h-4 w-4" aria-hidden="true" />Record gift</Link>}
        secondaryActions={<>{headerActions}<button type="button" className="donor-button" onClick={refresh} disabled={busy}><RefreshCcw className="h-4 w-4" aria-hidden="true" />{busy ? "Refreshing" : "Refresh"}</button></>}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="donor-button" onClick={() => window.dispatchEvent(new Event("crm:focus-topbar-search"))}><Search className="h-4 w-4" aria-hidden="true" />Find a constituent</button>
        <Link href="/constituents" className="donor-button">Browse constituents</Link>
        <Link href="/constituents/new" className="donor-button"><UserPlus className="h-4 w-4" aria-hidden="true" />Add constituent</Link>
        <span className="text-xs text-slate-500">{summary ? dataThroughLabel : busy ? "Loading data…" : "Dashboard data unavailable"}</span>
      </div>
      {errors.length > 0 ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Some dashboard data is unavailable. Values from the last successful refresh may still be shown.</p>
        <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">View details</summary><ul className="mt-2 space-y-1 text-xs">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details>
        <button type="button" onClick={refresh} disabled={busy} className="donor-button mt-3">Retry</button>
      </div> : null}

      <section aria-label="Performance summary">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Performance summary</h2>
          <Link href="/reports" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">View reports</Link>
        </div>
        <div className="donor-performance-metrics grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CRMMetricCard label="Giving this year" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.ytdAmount)) : "—"} helper={summary?.period?.label ?? "Year to date"} loading={summaryLoading} tone="slate" />
          <CRMMetricCard label="Giving this month" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.monthAmount)) : "—"} loading={summaryLoading} tone="slate" />
          <CRMMetricCard label="Constituents" value={summary?.totalConstituents.toLocaleString() ?? "—"} helper={summary ? `${summary.activeDonors.toLocaleString()} active donors this year` : undefined} loading={summaryLoading} tone="slate" />
          <CRMMetricCard label="Retention" value={retention && retention.total > 0 ? `${Math.round(retention.rate)}%` : "—"} helper={retention?.total === 0 ? "No prior-year donor cohort" : reportingYearMode.toLowerCase() === "fiscal" ? "Fiscal-year view" : "Calendar-year view"} loading={summaryLoading} tone="slate" />
        </div>
      </section>
      <DonorActionCenter data={data} summary={summary} retention={retention} loading={busy} summaryUnavailable={Boolean(loadError || !summary)} detailsUnavailable={Boolean(requestError)} />

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-label="Constituent relationships">
        <CRMCard padding="md" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Recent gifts</h2>
            <Link href="/donations" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">View donations</Link>
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
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Keep donors connected</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">A gift is the start of the next conversation. Review donor history and communication preferences before reaching out.</p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div><dt className="text-xs text-slate-500">Active donors this year</dt><dd className="mt-1 text-2xl font-semibold text-slate-900">{summaryLoading ? "…" : summary?.activeDonors.toLocaleString() ?? "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Donors retained</dt><dd className="mt-1 text-2xl font-semibold text-slate-900">{summaryLoading ? "…" : retention ? `${retention.retained.toLocaleString()} / ${retention.total.toLocaleString()}` : "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-500">Retained = prior-year donors who gave again this reporting year. This is a year-to-date measure.</p>
          <Link href="/reports?report=comprehensive-donor-analysis" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--crm-accent)] hover:underline">Explore donor retention →</Link>
        </CRMCard>
      </section>

      <DonorDashboardTools data={data} loading={richLoading} unavailable={Boolean(requestError)} />
      <details className="crm-card-surface rounded-xl border p-4" onToggle={(event) => setInsightsOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-800">Giving breakdown and Steward insights</summary>
        <div className="mt-4">
          {richLoading ? <p className="text-sm text-slate-500">Loading insights…</p>
            : errors.length > 0 ? <p className="text-sm text-slate-600">Some insights are unavailable. Retry the dashboard to load a complete breakdown.</p>
            : data && insightsOpen ? <DonorDashboardOverviewSections designationSlices={data.designationSlices} designationTotal={data.designationTotal} suggestions={suggestions} /> : null}
        </div>
      </details>
      {extraSections}
    </div>
  );
}
