"use client";

import DonorDashboardMetrics from "./DonorDashboardMetrics";
import DonorRelationshipSummary from "./DonorRelationshipSummary";
import DonorReferenceOperations from "./DonorReferenceOperations";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Gift, RefreshCcw } from "lucide-react";
import { DonorDashboardOverviewSections } from "./DonorDashboardOverviewSections";
import { buildStewardshipSuggestions } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import DashboardReportFinder from "./DashboardReportFinder";
import DonorSpotlight from "./DonorSpotlight";
import NewDonorsWidget from "./NewDonorsWidget";
import DashboardReminders from "./DashboardReminders";
import DonorActionCenter from "./DonorActionCenter";
import DonorDashboardTools from "./DonorDashboardTools";
import DonorPerformanceCharts from "./DonorPerformanceCharts";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import { DonorQuickViews } from "@/app/components/donor-workspace/BrowsePrimitives";

interface NaturalisticDonorDashboardProps {
  greeting: string;
  name: string;
  loading: boolean;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  data: DashboardData | null;
  requestError?: string | null;
  refreshVersion: number;
  dataThroughLabel: string;
  headerActions?: ReactNode;
  extraSections?: ReactNode;
  onRefresh: () => void | Promise<void>;
  loadError?: string | null;
}

export default function NaturalisticDonorDashboard({
  greeting, name, loading: summaryLoading, summary, retention,
  dataThroughLabel, data, requestError, refreshVersion, headerActions, extraSections, onRefresh, loadError,
}: NaturalisticDonorDashboardProps) {
  const [focus, setFocus] = useState("overview");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const richLoading = summaryLoading;
  const refresh = onRefresh;
  const busy = summaryLoading;
  const errors = [loadError, requestError, ...(data?.errors ?? [])].filter(Boolean);
  const suggestions = buildStewardshipSuggestions(summary, retention);
  const giftsUnavailable = Boolean(requestError || !data || data.errors.some(error => error.startsWith("Recent donor movement")));
  const firstName = name.split(" ")[0] || "there";
  const periodLabel = summary?.period?.label ?? "Year to date";

  return (
    <div className="donor-daily-workspace donor-animated-dashboard donor-reference-dashboard space-y-3 pb-8">
      <CRMPageHeader breadcrumb="Donor CRM" title={`${greeting}, ${firstName}`}
        description="Here’s your fundraising overview and next steps."
        primaryAction={<Link href="/donations?recordGift=1" className="donor-button donor-button-primary"><Gift className="h-4 w-4" aria-hidden="true" />Record gift</Link>}
        secondaryActions={<><Link href="/constituents" className="donor-button">Contacts</Link>{headerActions}<button type="button" className="donor-button" onClick={refresh} disabled={busy}><RefreshCcw className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />{busy ? "Refreshing" : "Refresh"}</button></>}
      />
      {errors.length > 0 ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Some dashboard data is unavailable. Unavailable sections are marked below; other dashboard tools remain usable.</p>
        <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold">View details</summary><ul className="mt-2 space-y-1 text-xs">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details>
        <button type="button" onClick={refresh} disabled={busy} className="donor-button mt-3">Retry</button>
      </div> : null}

      <DonorDashboardMetrics summary={summary} loading={summaryLoading} />
      <div className="donor-browse-filter-heading"><DonorQuickViews label="Dashboard focus" items={[{ label: "Fundraising overview", active: focus === "overview", onClick: () => setFocus("overview") }, { label: "Supporter relationships", active: focus === "relationships", onClick: () => setFocus("relationships") }]} /><p className="donor-scope-note">{focus === "overview" ? "Giving trends and the next actions to take" : "Recent gifts, retention, campaigns, and relationship tools"}</p></div>
      {focus === "overview" && <DonorPerformanceCharts data={data} summary={summary} loading={richLoading} unavailable={Boolean(requestError)} />}
      <DonorReferenceOperations data={data} loading={richLoading} unavailable={giftsUnavailable} revision={refreshVersion} />
      <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Donors and staff reminders"><NewDonorsWidget refreshVersion={refreshVersion} /><DashboardReminders refreshVersion={refreshVersion} /></section>



      <DonorActionCenter data={data} summary={summary} retention={retention} loading={busy} summaryUnavailable={!summary} detailsUnavailable={Boolean(requestError)} />

      {focus === "relationships" && <><DonorRelationshipSummary data={data} retention={retention} loading={busy} unavailable={giftsUnavailable} />

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
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span className="donor-period-label">{periodLabel} <span aria-hidden="true">·</span> Completed gifts</span>
        <span>{summary ? dataThroughLabel : busy ? "Loading data…" : "Dashboard data unavailable"}</span>
      </div>

      <details className="crm-card-surface rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Workspace insights & report finder</summary><div className="mt-4 space-y-4">      <DonorSpotlight onRefresh={refresh} data={data} summary={summary} loading={busy} unavailable={Boolean(loadError || requestError)} />
<DashboardReportFinder period={summary?.period} /></div></details>
      {extraSections}
    </div>
  );
}
