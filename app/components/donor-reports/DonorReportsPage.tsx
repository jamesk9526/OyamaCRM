// DonorReportsPage renders the DonorCRM-specific reporting catalog and preparation workspace.
"use client";

import { useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import ReportViewer from "@/app/components/donor-reports/ReportViewer";
import {
  DONOR_REPORT_CATEGORIES,
  DONOR_REPORTS,
  type DonorReportCategory,
  type DonorReportDefinition,
} from "@/app/components/donor-reports/donor-report-catalog";

type CategoryFilter = "All" | DonorReportCategory;
type ReportScopeFilter = "YEAR" | "ALL_YEARS";
type ReportDateBasis = "calendar" | "fiscal";

const REPORT_LIMIT_OPTIONS = [50, 100, 250, 500, 1000, 5000] as const;
type ReportLimit = (typeof REPORT_LIMIT_OPTIONS)[number];

const categoryTones: Record<DonorReportCategory, string> = {
  "Donor Intelligence": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Giving: "border-sky-200 bg-sky-50 text-sky-700",
  Retention: "border-violet-200 bg-violet-50 text-violet-700",
  "Campaigns & Funds": "border-amber-200 bg-amber-50 text-amber-700",
  Stewardship: "border-rose-200 bg-rose-50 text-rose-700",
  Commitments: "border-slate-200 bg-slate-50 text-slate-700",
};

function ReportIcon({ category }: { category: DonorReportCategory }) {
  const common = "h-4 w-4";
  if (category === "Giving") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M8 8h6.5a2.5 2.5 0 010 5H9.5a2.5 2.5 0 000 5H16" />
      </svg>
    );
  }
  if (category === "Retention") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8a6 6 0 018.9-1.3L18 8M17 16a6 6 0 01-8.9 1.3L6 16M18 4v4h-4M6 20v-4h4" />
      </svg>
    );
  }
  if (category === "Campaigns & Funds") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18V6l11-2v12L5 18zM16 7h3v8h-3" />
      </svg>
    );
  }
  if (category === "Stewardship") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h9M5 17h6M16 16l1.5 1.5L21 14" />
      </svg>
    );
  }
  if (category === "Commitments") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h7l3 3v13H7zM14 4v4h4M9.5 13h5M9.5 16h4" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 15V9m5 6V5m5 10v-3" />
    </svg>
  );
}

function countByCategory(category: DonorReportCategory): number {
  return DONOR_REPORTS.filter((report) => report.category === category).length;
}

function ReportCard({
  report,
  selected,
  onSelect,
}: {
  report: DonorReportDefinition;
  selected: boolean;
  onSelect: (report: DonorReportDefinition) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(report)}
      className={`group flex h-full min-h-[172px] flex-col rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-sm ${
        selected ? "border-green-400 shadow-[inset_3px_0_0_#16a34a]" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${categoryTones[report.category]}`}>
          <ReportIcon category={report.category} />
          {report.category}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Template
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-950">{report.title}</h3>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{report.description}</p>
      <div className="mt-auto pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary Inputs</p>
        <p className="mt-1 text-xs text-slate-700">{report.inputs.slice(0, 3).join(" / ")}</p>
      </div>
    </button>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildReportQueryParams({
  year,
  scope,
  dateBasis,
  fromDate,
  toDate,
  limit,
}: {
  year: number;
  scope: ReportScopeFilter;
  dateBasis: ReportDateBasis;
  fromDate: string;
  toDate: string;
  limit: ReportLimit;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("year", String(year));
  params.set("limit", String(limit));
  if (scope === "ALL_YEARS") params.set("scope", "ALL_YEARS");
  if (dateBasis === "fiscal") params.set("dateBasis", "fiscal");
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  return params;
}

function appendQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/** Maps each report template ID to its live API endpoint (year-aware). */
const REPORT_ENDPOINT_MAP: Record<string, string> = {
  "donor-summary": "/api/reports/top-donors",
  "donation-history": "/api/reports/recent-donations",
  "year-to-date-giving": "/api/reports/summary",
  "monthly-giving": "/api/reports/giving-by-month",
  "donor-retention": "/api/reports/donor-retention",
  "lapsed-donor": "/api/reports/lybunt",
  "new-donor": "/api/reports/new-vs-returning",
  "major-donor": "/api/reports/top-donors",
  "recurring-donor": "/api/reports/summary",
  "campaign-performance": "/api/reports/campaign-performance",
  "appeal-performance": "/api/reports/campaign-performance",
  "designation-fund": "/api/reports/campaign-performance",
  "top-donors": "/api/reports/top-donors",
  "first-time-donor": "/api/reports/new-vs-returning",
  "donor-engagement": "/api/reports/donor-segments",
  "stewardship-follow-up": "/api/reports/summary",
  "thank-you-letter-status": "/api/reports/summary",
  "communication-history": "/api/reports/recent-donations",
  "pledge": "/api/reports/summary",
  "grant-tracking": "/api/reports/summary",
};

/** Reports that also have a direct server-side CSV export endpoint. */
const REPORT_CSV_MAP: Record<string, string> = {
  "year-to-date-giving": "/api/reports/exports/summary.csv",
  "donor-summary": "/api/reports/exports/summary.csv",
  "monthly-giving": "/api/reports/exports/giving-by-month.csv",
};

/** Human-readable column labels for results tables. */
const COLUMN_LABELS: Record<string, string> = {
  firstName: "First", lastName: "Last", email: "Email", donorStatus: "Status",
  totalLifetimeGiving: "Lifetime Giving", lastGiftDate: "Last Gift", lastGiftAmount: "Last Amt",
  month: "Month", amount: "Amount", grantAmount: "Grants", newCount: "New",
  returningCount: "Returning", name: "Name", goal: "Goal", raised: "Raised",
  giftCount: "Gifts", uniqueDonors: "Donors", avgGift: "Avg Gift", active: "Active",
  startDate: "Start", endDate: "End", paymentMethod: "Method", count: "Count",
  date: "Date",
};

const CURRENCY_CELL_KEYS = new Set(["amount","grantAmount","totalLifetimeGiving","lastGiftAmount","raised","goal","avgGift"]);
const DATE_CELL_KEYS = new Set(["lastGiftDate","startDate","endDate","date"]);

/** Formats a single table cell value for display. */
function fmtCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (key === "month" && typeof value === "number") return MONTHS[value - 1] ?? String(value);
  if (CURRENCY_CELL_KEYS.has(key) && typeof value === "number") {
    return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (DATE_CELL_KEYS.has(key) && typeof value === "string") return new Date(value).toLocaleDateString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return String(value);
}

/** Renders an array result as a compact scrollable table. */
function ArrayResultsTable({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data returned for this period.</p>;
  }
  const keys = Object.keys(data[0]).filter((k) => k !== "id");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            {keys.map((k) => (
              <th key={k} className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                {COLUMN_LABELS[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={`border-b border-slate-50 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
              {keys.map((k) => (
                <td key={k} className="py-1.5 pr-3 text-slate-700 whitespace-nowrap">{fmtCell(k, row[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-center text-xs text-slate-400">Showing all {data.length.toLocaleString()} rows.</p>
    </div>
  );
}

/** Renders a flat KPI object (summary, retention, donor-segments) as metric tiles. */
function KpiResultsGrid({ data }: { data: Record<string, unknown> }) {
  const KPI_LABELS: Record<string, string> = {
    totalConstituents: "Constituents", ytdAmount: "YTD Raised", ytdCount: "YTD Gifts",
    ytdGrantAmount: "YTD Grants", activeCampaigns: "Active Campaigns",
    pendingTasks: "Pending Tasks", overdueTasks: "Overdue Tasks",
    weekAmount: "This Week", weekCount: "Week Gifts",
    total: "Prior Year Donors", retained: "Retained", rate: "Retention Rate",
    year: "Report Year", ACTIVE: "Active", LAPSED: "Lapsed", NEW: "New",
    MAJOR_DONOR: "Major Donors", PROSPECT: "Prospects", DECEASED: "Deceased", OTHER: "Other",
    newDonorsThisMonth: "New (Month)", activeGoalTotal: "Campaign Goals",
    activeCampaignRaisedAmount: "Campaign Raised", monthAmount: "This Month",
  };
  const KPI_CURRENCY = new Set(["ytdAmount","ytdGrantAmount","weekAmount","activeCampaignRaisedAmount","activeGoalTotal","monthAmount"]);
  const KPI_PCT = new Set(["rate","momTrend"]);
  const entries = Object.entries(data).filter(([, v]) => typeof v !== "object" || v === null);
  return (
    <div className="grid grid-cols-2 gap-2">
      {entries.map(([k, v]) => {
        let display: string;
        if (KPI_CURRENCY.has(k) && typeof v === "number") {
          display = "$" + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } else if (KPI_PCT.has(k) && typeof v === "number") {
          display = v.toFixed(1) + "%";
        } else {
          display = typeof v === "number" ? v.toLocaleString() : String(v ?? "\u2014");
        }
        return (
          <div key={k} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{KPI_LABELS[k] ?? k}</p>
            <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{display}</p>
          </div>
        );
      })}
    </div>
  );
}

type RunState = "idle" | "loading" | "done" | "error";

/**
 * Provides the DonorCRM-owned reports workspace. All templates are wired to live
 * API endpoints — select a report, pick a year, and click Run Report.
 */
export default function DonorReportsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [selectedReportId, setSelectedReportId] = useState(DONOR_REPORTS[0]?.id ?? "");
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [runScope, setRunScope] = useState<ReportScopeFilter>("YEAR");
  const [runDateBasis, setRunDateBasis] = useState<ReportDateBasis>("calendar");
  const [runFromDate, setRunFromDate] = useState("");
  const [runToDate, setRunToDate] = useState("");
  const [runLimit, setRunLimit] = useState<ReportLimit>(500);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runData, setRunData] = useState<unknown>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const selectedReport = DONOR_REPORTS.find((r) => r.id === selectedReportId) ?? DONOR_REPORTS[0];
  const hasEndpoint = selectedReport ? Boolean(REPORT_ENDPOINT_MAP[selectedReport.id]) : false;
  const hasCsvServer = selectedReport ? Boolean(REPORT_CSV_MAP[selectedReport.id]) : false;
  const canExport = hasCsvServer || (runState === "done" && Array.isArray(runData) && (runData as unknown[]).length > 0);

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return DONOR_REPORTS.filter((report) => {
      const categoryMatches = category === "All" || report.category === category;
      const queryMatches = !normalized
        || report.title.toLowerCase().includes(normalized)
        || report.description.toLowerCase().includes(normalized)
        || report.inputs.some((input) => input.toLowerCase().includes(normalized));
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  function resetFilters() {
    setQuery("");
    setCategory("All");
  }

  const runWindowLabel = runFromDate || runToDate
    ? `${runFromDate || "start"} to ${runToDate || "today"}`
    : runScope === "ALL_YEARS"
      ? "all years"
      : String(runYear);

  /** Resets run state when a different template is selected. */
  const handleSelectReport = useCallback((report: DonorReportDefinition) => {
    setSelectedReportId(report.id);
    setRunState("idle");
    setRunData(null);
    setRunError(null);
  }, []);

  /** Fetches the live report data from the mapped API endpoint. */
  const runReport = useCallback(async () => {
    if (!selectedReport) return;
    const endpointBase = REPORT_ENDPOINT_MAP[selectedReport.id];
    if (!endpointBase) return;
    const queryParams = buildReportQueryParams({
      year: runYear,
      scope: runScope,
      dateBasis: runDateBasis,
      fromDate: runFromDate,
      toDate: runToDate,
      limit: runLimit,
    });
    const endpoint = appendQuery(endpointBase, queryParams);
    setRunState("loading");
    setRunData(null);
    setRunError(null);
    try {
      const data = await apiFetch<unknown>(endpoint);
      setRunData(data);
      setRunState("done");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Report failed. Please try again.");
      setRunState("error");
    }
  }, [selectedReport, runYear, runScope, runDateBasis, runFromDate, runToDate, runLimit]);

  /** Downloads CSV — server-side for supported reports, client-side otherwise. */
  function exportCsv() {
    if (!selectedReport) return;
    const queryParams = buildReportQueryParams({
      year: runYear,
      scope: runScope,
      dateBasis: runDateBasis,
      fromDate: runFromDate,
      toDate: runToDate,
      limit: runLimit,
    });
    const csvBase = REPORT_CSV_MAP[selectedReport.id];
    if (csvBase) {
      const a = document.createElement("a");
      a.href = appendQuery(csvBase, queryParams);
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (!Array.isArray(runData) || (runData as unknown[]).length === 0) return;
    const rows = runData as Record<string, unknown>[];
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map((row) =>
      headers.map((h) => {
        const v = String(row[h] ?? "");
        return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",")
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport.id}-${runWindowLabel.replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <EnterprisePageShell
      ribbon={
        <div className="space-y-3">
          <WorkspaceBreadcrumbBar
            items={[{ label: "DonorCRM", href: "/" }, { label: "Reports" }]}
            statusLabel="Donor Reports"
            metadata={`${DONOR_REPORTS.length} report templates`}
            primaryAction={
              <button
                type="button"
                disabled={!hasEndpoint || runState === "loading"}
                onClick={() => void runReport()}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  hasEndpoint && runState !== "loading"
                    ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                {runState === "loading" ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </>
                ) : "Run Report"}
              </button>
            }
          />
          <WorkspaceRibbon>
            <WorkspaceRibbonGroup label="Library">
              <WorkspaceRibbonButton label="All Reports" onClick={() => setCategory("All")} variant={category === "All" ? "primary" : "secondary"} />
              <WorkspaceRibbonButton label="Giving" onClick={() => setCategory("Giving")} variant={category === "Giving" ? "primary" : "secondary"} />
              <WorkspaceRibbonButton label="Retention" onClick={() => setCategory("Retention")} variant={category === "Retention" ? "primary" : "secondary"} />
              <WorkspaceRibbonButton label="Campaigns" onClick={() => setCategory("Campaigns & Funds")} variant={category === "Campaigns & Funds" ? "primary" : "secondary"} />
              <WorkspaceRibbonButton label="Stewardship" onClick={() => setCategory("Stewardship")} variant={category === "Stewardship" ? "primary" : "secondary"} />
            </WorkspaceRibbonGroup>
            <WorkspaceRibbonGroup label="Custom Run">
              <WorkspaceRibbonButton
                label={runScope === "ALL_YEARS" ? "All Years" : "Selected Year"}
                onClick={() => setRunScope((prev) => (prev === "ALL_YEARS" ? "YEAR" : "ALL_YEARS"))}
                variant={runScope === "ALL_YEARS" ? "primary" : "secondary"}
              />
              <WorkspaceRibbonButton
                label={runDateBasis === "fiscal" ? "Fiscal Basis" : "Calendar Basis"}
                onClick={() => setRunDateBasis((prev) => (prev === "fiscal" ? "calendar" : "fiscal"))}
                variant={runDateBasis === "fiscal" ? "primary" : "secondary"}
              />
            </WorkspaceRibbonGroup>
            <WorkspaceRibbonGroup label="Actions">
              <WorkspaceRibbonButton label="Reset Filters" onClick={resetFilters} variant="secondary" />
              <WorkspaceRibbonButton label="Export CSV" onClick={exportCsv} disabled={!canExport} variant="secondary" />
            </WorkspaceRibbonGroup>
          </WorkspaceRibbon>
        </div>
      }
      contentClassName="space-y-5"
    >
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {DONOR_REPORT_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-xl border bg-white p-3 text-left transition hover:border-green-300 hover:shadow-sm ${
              category === item ? "border-green-400 shadow-[inset_3px_0_0_#16a34a]" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <ReportIcon category={item} />
              </span>
              <span className="text-lg font-semibold text-slate-950">{countByCategory(item)}</span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-900">{item}</p>
          </button>
        ))}
      </section>

      {/* Template browser — full width */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search donor reports</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports, inputs, or outcomes..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
            aria-label="Filter reports by category"
          >
            <option value="All">All categories</option>
            {DONOR_REPORT_CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              selected={selectedReport?.id === report.id}
              onSelect={handleSelectReport}
            />
          ))}
        </div>

        {filteredReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No donor reports match those filters.
          </div>
        ) : null}
      </section>

      {/* Run controls + results — below the cards, full width */}
      {selectedReport ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${categoryTones[selectedReport.category]}`}>
                <ReportIcon category={selectedReport.category} />
                {selectedReport.category}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {runState === "done" ? "Results" : runState === "error" ? "Error" : "Selected Template"}
                </p>
                <h2 className="truncate text-base font-semibold text-slate-950">{selectedReport.title}</h2>
              </div>
            </div>

            {/* Run options inline in header */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Year:
                <input
                  type="number"
                  min={2015}
                  max={new Date().getFullYear() + 1}
                  value={runYear}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10);
                    if (Number.isFinite(y)) setRunYear(y);
                  }}
                  className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Scope:
                <select
                  value={runScope}
                  onChange={(e) => setRunScope(e.target.value as ReportScopeFilter)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                >
                  <option value="YEAR">Year</option>
                  <option value="ALL_YEARS">All years</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Basis:
                <select
                  value={runDateBasis}
                  onChange={(e) => setRunDateBasis(e.target.value as ReportDateBasis)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                >
                  <option value="calendar">Calendar</option>
                  <option value="fiscal">Fiscal</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                From:
                <input
                  type="date"
                  value={runFromDate}
                  onChange={(e) => setRunFromDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                To:
                <input
                  type="date"
                  value={runToDate}
                  onChange={(e) => setRunToDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                Rows:
                <select
                  value={runLimit}
                  onChange={(e) => setRunLimit(Number(e.target.value) as ReportLimit)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-green-400"
                >
                  {REPORT_LIMIT_OPTIONS.map((limitOption) => (
                    <option key={limitOption} value={limitOption}>
                      {limitOption === 5000 ? "All" : limitOption}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!hasEndpoint || runState === "loading"}
                onClick={() => void runReport()}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  hasEndpoint && runState !== "loading"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                {runState === "loading" ? (
                  <>
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running
                  </>
                ) : runState === "done" ? "Re-run" : "Run Report"}
              </button>
              {runState === "done" && (
                <button
                  type="button"
                  onClick={() => { setRunState("idle"); setRunData(null); }}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Detail / results body */}
          <div className="p-5">
            {runState === "idle" && (
              <div className="flex flex-wrap gap-8">
                <div className="min-w-[220px] flex-1 space-y-3">
                  <p className="text-sm leading-6 text-slate-600">{selectedReport.description}</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best Used For</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedReport.recommendedUse}</p>
                  </div>
                  {hasEndpoint && (
                    <p className="text-xs font-medium text-green-700">✓ Live data available — configure options above and click Run Report.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuration Inputs</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedReport.inputs.map((input) => (
                        <span key={input} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Output Formats</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedReport.outputs.map((output) => (
                        <span key={output} className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {runState === "loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <svg className="h-6 w-6 animate-spin text-green-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-500">Generating {selectedReport.title}...</p>
              </div>
            )}

            {runState === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">Report failed</p>
                <p className="mt-1 text-sm text-red-700">{runError}</p>
                <button
                  type="button"
                  onClick={() => void runReport()}
                  className="mt-3 text-xs font-semibold text-red-700 hover:text-red-900"
                >
                  Try again →
                </button>
              </div>
            )}

            {runState === "done" && runData !== null && (
              <div className="space-y-3">
                {/* View Full Report at top */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {Array.isArray(runData) ? `${(runData as unknown[]).length.toLocaleString()} rows` : "Summary data"} · {runWindowLabel} · {runDateBasis === "fiscal" ? "Fiscal" : "Calendar"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowViewer(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h12M3 18h8" />
                    </svg>
                    View Full Report
                  </button>
                </div>
                {Array.isArray(runData)
                  ? <ArrayResultsTable data={runData as Record<string, unknown>[]} />
                  : <KpiResultsGrid data={runData as Record<string, unknown>} />
                }
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Full-page report viewer modal */}
      {showViewer && selectedReport && runData !== null && (
        <ReportViewer
          report={selectedReport}
          data={runData}
          year={runYear}
          onClose={() => setShowViewer(false)}
        />
      )}
    </EnterprisePageShell>
  );
}
