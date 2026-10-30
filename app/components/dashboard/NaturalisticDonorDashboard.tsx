"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Gift, RefreshCcw, TrendingUp, Users, Wallet } from "lucide-react";
import { DonorDashboardOverviewSections } from "./DonorDashboardOverviewSections";
import { buildStewardshipSuggestions, formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { loadDonorDashboardData } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import type { DashboardData, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import { formatDonationDate } from "@/app/components/donations/donation-utils";
import DashboardReportFinder from "./DashboardReportFinder";
import DonorSpotlight from "./DonorSpotlight";
import NewDonorsWidget from "./NewDonorsWidget";
import DashboardReminders from "./DashboardReminders";
import DonorActionCenter from "./DonorActionCenter";
import DonorDashboardTools from "./DonorDashboardTools";
import DonorPerformanceCharts from "./DonorPerformanceCharts";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import DonorWorkspaceNav from "@/app/components/donor-workspace/DonorWorkspaceNav";
import { DonorQuickViews } from "@/app/components/donor-workspace/BrowsePrimitives";

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
  const [focus, setFocus] = useState("overview");
  const [refreshVersion, setRefreshVersion] = useState(0);
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
  const refresh = () => { setRefreshVersion((value) => value + 1); void loadRichData(); void onRefresh?.(); };
  const busy = summaryLoading || richLoading;
  const errors = [loadError, requestError, ...(data?.errors ?? [])].filter(Boolean);
  const suggestions = buildStewardshipSuggestions(loadError ? null : summary, loadError ? null : retention);
  const giftsUnavailable = Boolean(requestError || !data
    || data.errors.some((error) => error.startsWith("Recent donor movement")));
  const gifts = data?.recentDonations.slice(0, 6) ?? [];
  const firstName = name.split(" ")[0] || "there";
  const averageGift = summary && summary.ytdCount > 0 ? summary.ytdAverageGift ?? toDashboardNumber(summary.ytdAmount) / summary.ytdCount : null;
  const revenueChange = summary?.revenueChangePercent;
  const periodLabel = summary?.period?.label ?? "Year to date";
  const comparisonHelper = summary?.previousPeriodAmount === 0 ? "No prior-year giving to compare" : "Prior-year comparison unavailable";

  const giftsQuery = new URLSearchParams({ status: "COMPLETED" });
  if (summary?.period?.from) giftsQuery.set("from", summary.period.from.slice(0, 10));
  if (summary?.period?.through) giftsQuery.set("to", summary.period.through.slice(0, 10));
  const matchingGiftsHref = `/donations?${giftsQuery}`;
  const monthQuery = new URLSearchParams({ status: "COMPLETED" });
  if (summary?.period?.monthFrom) monthQuery.set("from", summary.period.monthFrom.slice(0, 10));
  if (summary?.period?.monthThrough) monthQuery.set("to", summary.period.monthThrough.slice(0, 10));

  const donorQuery = new URLSearchParams();
  if (summary?.period?.from) donorQuery.set("givingFrom", summary.period.from);
  if (summary?.period?.through) donorQuery.set("givingThrough", summary.period.through);

  return (
    <div className="donor-daily-workspace donor-animated-dashboard space-y-5 pb-8">
      <DonorWorkspaceNav />
      <CRMPageHeader breadcrumb="Donor CRM" title={`${greeting}, ${firstName}`}
        description="See your fundraising momentum and turn insights into stronger donor relationships."
        primaryAction={<Link href="/donations?recordGift=1" className="donor-button donor-button-primary"><Gift className="h-4 w-4" aria-hidden="true" />Record gift</Link>}
        secondaryActions={<>{headerActions}<button type="button" className="donor-button" onClick={refresh} disabled={busy}><RefreshCcw className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />{busy ? "Refreshing" : "Refresh"}</button></>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span className="donor-period-label">{periodLabel} <span aria-hidden="true">·</span> Completed gifts</span>
        <span>{summary ? dataThroughLabel : busy ? "Loading data…" : "Dashboard data unavailable"}</span>
      </div>
      <div className="donor-browse-filter-heading"><DonorQuickViews label="Dashboard focus" items={[{ label: "Fundraising overview", active: focus === "overview", onClick: () => setFocus("overview") }, { label: "Supporter relationships", active: focus === "relationships", onClick: () => setFocus("relationships") }]} /><p className="donor-scope-note">{focus === "overview" ? "Giving trends and the next actions to take" : "Recent gifts, retention, campaigns, and relationship tools"}</p></div>
      {errors.length > 0 ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Some dashboard data is unavailable. Values from the last successful refresh may still be shown.</p>
        <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">View details</summary><ul className="mt-2 space-y-1 text-xs">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details>
        <button type="button" onClick={refresh} disabled={busy} className="donor-button mt-3">Retry</button>
      </div> : null}

      <DonorSpotlight onRefresh={refresh} data={data} summary={summary} loading={busy} unavailable={Boolean(loadError || requestError)} />
      <section aria-label="Performance summary">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Fundraising at a glance</h2>
          <Link href="/reports" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">View reports</Link>
        </div>
        <div className="donor-performance-metrics grid grid-cols-2 gap-3 xl:grid-cols-3">
          <CRMMetricCard href={matchingGiftsHref} label="Giving this year" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.ytdAmount)) : "—"} icon={<TrendingUp className="h-4 w-4" />} helper={revenueChange != null ? <span className={revenueChange < 0 ? "text-amber-700" : "text-emerald-700"}>{revenueChange > 0 ? "+" : ""}{revenueChange.toFixed(1)}% vs. same elapsed prior year</span> : comparisonHelper} loading={summaryLoading} tone="green" />
          <CRMMetricCard href={`/donations?${monthQuery}`} label="Giving this month" value={summary ? formatDashboardCurrency(toDashboardNumber(summary.monthAmount)) : "—"} icon={<Gift className="h-4 w-4" />} helper="Completed gifts this calendar month" loading={summaryLoading} tone="blue" />
          <CRMMetricCard href="/constituents" label="Constituents" value={summary?.totalConstituents.toLocaleString() ?? "—"} icon={<Users className="h-4 w-4" />} helper="All constituent records" loading={summaryLoading} tone="orange" />
          <CRMMetricCard href={matchingGiftsHref} label="Completed gifts" value={summary?.ytdCount?.toLocaleString() ?? "—"} icon={<Gift className="h-4 w-4" />} helper={periodLabel} loading={summaryLoading} tone="blue" />
          <CRMMetricCard href={matchingGiftsHref} label="Average gift" value={averageGift === null ? "—" : formatDashboardCurrency(averageGift)} icon={<Wallet className="h-4 w-4" />} helper="Giving ÷ completed gifts this period" loading={summaryLoading} tone="purple" />
          <CRMMetricCard href={`/constituents?${donorQuery}`} label="Active donors" value={summary?.activeDonors.toLocaleString() ?? "—"} icon={<Users className="h-4 w-4" />} helper="Donors with completed gifts this period" loading={summaryLoading} tone="orange" />
        </div>
      </section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Donors and staff reminders"><NewDonorsWidget refreshVersion={refreshVersion} /><DashboardReminders refreshVersion={refreshVersion} /></section>
      <DashboardReportFinder period={summary?.period} />
      {focus === "overview" && <DonorPerformanceCharts data={data} summary={summary} loading={richLoading} unavailable={Boolean(requestError)} />}
      <DonorActionCenter data={data} summary={summary} retention={retention} loading={busy} summaryUnavailable={Boolean(loadError || !summary)} detailsUnavailable={Boolean(requestError)} />

      {focus === "relationships" && <><section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-label="Constituent relationships">
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
      </section>

      <DonorDashboardTools data={data} loading={richLoading} unavailable={Boolean(requestError)} />
      <details className="crm-card-surface rounded-xl border p-4" onToggle={(event) => setInsightsOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-800">Steward recommendations</summary>
        <div className="mt-4">
          {richLoading ? <p className="text-sm text-slate-500">Loading insights…</p>
            : loadError ? <p className="text-sm text-slate-600">Recommendations are unavailable. Retry the dashboard to refresh your metrics.</p>
            : insightsOpen ? <DonorDashboardOverviewSections suggestions={suggestions} /> : null}
        </div>
      </details>
      </>}
      {extraSections}
    </div>
  );
}
