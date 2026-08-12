"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import DonationAudienceTool from "@/app/components/donor-reports/DonationAudienceTool";
import {
  getStoredReportingYearMode,
  setStoredReportingYearMode,
  type ReportingYearMode,
} from "@/app/lib/fiscal-year";

type ReportKey =
  | "batch-receipts"
  | "unacknowledged-gifts"
  | "donations"
  | "donations-by-designation"
  | "lifetime-giving"
  | "monthly-giving"
  | "comprehensive-donor-analysis"
  | "donor-files"
  | "giving-capacity-interest"
  | "donor-follow-up"
  | "donor-notes"
  | "first-time-donors"
  | "lapsed-donors"
  | "lapsed-donor-history"
  | "never-given"
  | "top-donors"
  | "payment-method-summary"
  | "designation-performance"
  | "crm-performance-scorecard"
  | "recurring-giving"
  | "campaign-performance";

type ColumnType = "currency" | "date" | "number" | "text";
type MatrixValueType = "currency" | "number" | "decimal";

interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  source: string;
  capabilities: string;
  scope: "date" | "year" | "lapse" | "none";
  group: "Gift reports" | "Donor reports";
  supportsPayment?: boolean;
  supportsDesignation?: boolean;
  supportsLimit?: boolean;
  defaultRange?: "month-to-date";
}

interface ReportColumn {
  key: string;
  label: string;
  type?: ColumnType;
  linkToDonor?: boolean;
}

interface ReportData {
  report: ReportKey;
  title: string;
  description: string;
  period: { from: string; through: string; label: string } | null;
  summary: Array<{ label: string; value: string | number | null; type?: "currency" | "number" | "text" }>;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  comparisonMatrix?: {
    columns: { currentYear: number; priorYear: number; twoYearsPrior: number };
    labels?: { current: string; prior: string; twoYearsPrior: string };
    sections: Array<{
      label: string;
      rows: Array<{ label: string; current: number; prior: number; twoYearsPrior: number; difference?: number | null; type: MatrixValueType }>;
    }>;
  };
  notices: string[];
  generatedAt: string;
}

interface DesignationOption {
  id: string;
  name: string;
}

const REPORTS: ReportDefinition[] = [
  { key: "batch-receipts", title: "Batch Receipts", description: "Review a receipt-ready register grouped by donor before creating receipt communications.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "unacknowledged-gifts", title: "Unacknowledged Gifts", description: "Find completed gifts that still need a recorded thank-you, then review the donor before starting a letter or email.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "donations", title: "Donations", description: "Print or export a detailed list of completed gifts in a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "donations-by-designation", title: "Donations by Designation", description: "See completed giving grouped by donor and designation.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true, defaultRange: "month-to-date" },
  { key: "lifetime-giving", title: "Lifetime Giving Report", description: "See every giving donor’s lifetime total, first, last, and largest completed gift.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Gift reports" },
  { key: "monthly-giving", title: "Monthly Giving Report", description: "Summarize donor giving for a month or any chosen date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", defaultRange: "month-to-date" },
  { key: "comprehensive-donor-analysis", title: "Comprehensive Donor Analysis", description: "Compare active, new, and repeat donor giving across three reporting years.", source: "Completed donations + first-gift dates", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "donor-files", title: "Donor Files", description: "A contact and mailing-preference directory for current donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "giving-capacity-interest", title: "Donor Files by Giving Capacity and Interest", description: "Review donor tags alongside lifetime giving. Capacity is shown only when stored as a tag.", source: "Donor tags + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-follow-up", title: "Donor Follow-up", description: "Open follow-up tasks tied to donor records, ordered for staff review.", source: "Tasks", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-notes", title: "Donor Notes", description: "A report of profile notes recorded on donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "first-time-donors", title: "First Time Donors", description: "Find donors whose first completed gift falls in the selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports" },
  { key: "lapsed-donors", title: "Lapsed Donors (SYBUNTY)", description: "Find donors who gave in the prior year but not in the selected year.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "lapsed-donor-history", title: "Lapsed Donor History", description: "Find all stored lapsed donors, donors whose last gift falls in a selected year range, or donors who have not given since a selected year.", source: "All completed donation history + donor files", capabilities: "Grid, CSV, Print, Outreach, Audience list", scope: "lapse", group: "Donor reports" },
  { key: "never-given", title: "Never Given Report", description: "List donor files with no completed donation record.", source: "Donor files + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "top-donors", title: "Top Donors", description: "Rank donors by completed giving within a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports", supportsLimit: true },
  { key: "payment-method-summary", title: "Payment Method Summary", description: "Compare gift volume, donor count, and giving by payment method.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports" },
  { key: "designation-performance", title: "Designation Performance", description: "Compare giving across funds and designations, including donor reach.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports" },
  { key: "crm-performance-scorecard", title: "CRM Performance Scorecard", description: "Compare growth, donor reach, gift activity, and recurring giving to the prior equal period.", source: "Completed donations", capabilities: "Grid, Visual, Insights", scope: "date", group: "Donor reports" },
  { key: "recurring-giving", title: "Recurring Giving", description: "Review recurring gifts and the donors sustaining recurring revenue in a selected period.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "campaign-performance", title: "Campaign Performance", description: "Rank campaign-attributed giving by revenue, gifts, and donor reach.", source: "Completed donations + campaigns", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
];

const PAYMENT_METHODS = [
  ["", "All payment methods"],
  ["CREDIT_CARD", "Credit card"],
  ["ACH", "ACH"],
  ["CHECK", "Check"],
  ["WIRE", "Wire"],
  ["STOCK", "Stock"],
  ["IN_KIND", "In kind"],
  ["CASH", "Cash"],
  ["ONLINE", "Online"],
] as const;

function localDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentYearStart(): string {
  return localDateInput(new Date(new Date().getFullYear(), 0, 1));
}

function lastMonthToDateRange(): { from: string; through: string } {
  const today = new Date();
  const priorMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  return { from: localDateInput(priorMonth), through: localDateInput(new Date(priorMonth.getFullYear(), priorMonth.getMonth(), Math.min(today.getDate(), lastDay))) };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | number | null): string {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatCell(value: string | number | null, type: ColumnType | MatrixValueType = "text"): string {
  if (value == null || value === "") return "—";
  if (type === "currency") return formatCurrency(Number(value));
  if (type === "date") return formatDate(value);
  if (type === "decimal") return Number(value).toFixed(1);
  if (type === "number") return Number(value).toLocaleString("en-US");
  return String(value);
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 shrink-0 text-slate-700">
      <path d="M6.5 2.75h7l4 4v14.5H6.5a1.75 1.75 0 0 1-1.75-1.75V4.5A1.75 1.75 0 0 1 6.5 2.75Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 2.75v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DonorReportsSpreadsheet() {
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [from, setFrom] = useState(currentYearStart);
  const [through, setThrough] = useState(() => localDateInput(new Date()));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [limit, setLimit] = useState("25");
  const [lapseMode, setLapseMode] = useState<"all" | "lastGiftRange" | "notSince">("all");
  const [lapseFromYear, setLapseFromYear] = useState(() => String(new Date().getFullYear() - 2));
  const [lapseThroughYear, setLapseThroughYear] = useState(() => String(new Date().getFullYear()));
  const [lapseNotSinceYear, setLapseNotSinceYear] = useState(() => String(new Date().getFullYear() - 1));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingMode, setReportingMode] = useState<ReportingYearMode>("calendar");
  const [activeTool, setActiveTool] = useState<"donation-audience" | null>(null);
  const [displayMode, setDisplayMode] = useState<"grid" | "visual">("grid");
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    setReportingMode(getStoredReportingYearMode());
    const syncMode = () => setReportingMode(getStoredReportingYearMode());
    window.addEventListener("reporting-year-mode:changed", syncMode);
    return () => window.removeEventListener("reporting-year-mode:changed", syncMode);
  }, []);

  useEffect(() => {
    void apiFetch<DesignationOption[]>("/api/designations")
      .then(setDesignations)
      .catch(() => setDesignations([]));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (!selected) return params;
    params.set("dateBasis", reportingMode);
    if (selected.scope === "date") {
      params.set("from", from);
      params.set("through", through);
    }
    if (selected.scope === "year") params.set("year", year);
    if (selected.scope === "lapse") {
      params.set("lapseMode", lapseMode);
      params.set("lapseFromYear", lapseFromYear);
      params.set("lapseThroughYear", lapseThroughYear);
      params.set("lapseNotSinceYear", lapseNotSinceYear);
    }
    if (selected.supportsPayment && paymentMethod) params.set("paymentMethod", paymentMethod);
    if (selected.supportsDesignation && designationId) params.set("designationId", designationId);
    if (selected.supportsLimit) params.set("limit", limit);
    return params;
  }, [selected, from, through, year, lapseMode, lapseFromYear, lapseThroughYear, lapseNotSinceYear, paymentMethod, designationId, limit, reportingMode]);

  const loadReport = useCallback(async (definition: ReportDefinition, mode: "open" | "refresh" = "open") => {
    if (mode === "open") setSelected(definition);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("dateBasis", reportingMode);
      if (definition.scope === "date") {
        const effectiveFrom = mode === "open" && definition.defaultRange === "month-to-date"
          ? localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
          : from;
        if (effectiveFrom !== from) setFrom(effectiveFrom);
        params.set("from", effectiveFrom);
        params.set("through", through);
      }
      if (definition.scope === "year") params.set("year", year);
      if (definition.scope === "lapse") {
        params.set("lapseMode", lapseMode);
        params.set("lapseFromYear", lapseFromYear);
        params.set("lapseThroughYear", lapseThroughYear);
        params.set("lapseNotSinceYear", lapseNotSinceYear);
      }
      if (definition.supportsPayment && paymentMethod) params.set("paymentMethod", paymentMethod);
      if (definition.supportsDesignation && designationId) params.set("designationId", designationId);
      if (definition.supportsLimit) params.set("limit", limit);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const nextReport = await apiFetch<ReportData>(`/api/reports/library/${definition.key}${suffix}`);
      setReport(nextReport);
      setShowInsights(definition.key === "crm-performance-scorecard");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", `/reports?report=${encodeURIComponent(definition.key)}`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to run this report right now.");
    } finally {
      setLoading(false);
    }
  }, [from, through, year, lapseMode, lapseFromYear, lapseThroughYear, lapseNotSinceYear, paymentMethod, designationId, limit, reportingMode]);

  useEffect(() => {
    if (typeof window === "undefined" || selected) return;
    const reportKey = new URLSearchParams(window.location.search).get("report") as ReportKey | null;
    const definition = REPORTS.find((item) => item.key === reportKey);
    if (definition) void loadReport(definition);
  }, [loadReport, selected]);

  const backToLibrary = () => {
    setSelected(null);
    setReport(null);
    setDisplayMode("grid");
    setError(null);
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/reports");
  };

  const handleExport = async () => {
    if (!selected) return;
    setExporting(true);
    setError(null);
    try {
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiFetchResponse(`/api/reports/exports/library/${selected.key}.csv${suffix}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message ?? "Unable to export this report.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selected.key}-${localDateInput(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export this report.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }
    const summary = report.summary.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(formatCell(item.value, item.type ?? "text"))}</li>`).join("");
    const table = report.comparisonMatrix
      ? matrixPrintTable(report.comparisonMatrix)
      : `<table><thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(formatCell(row[column.key] ?? null, column.type ?? "text"))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(report.title)}</title><style>body{font-family:Segoe UI,Arial,sans-serif;color:#172033;margin:28px}h1{font-size:22px;margin:0 0 4px}p{color:#52606f;margin:0 0 16px}ul{display:flex;gap:20px;padding:0;flex-wrap:wrap;list-style:none;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#5b5b5b;color:#fff;text-align:left}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top}.group{background:#666;color:#fff;font-weight:700;white-space:nowrap}.negative{color:#c10f1a;font-weight:700}@page{size:landscape;margin:12mm}</style></head><body><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.description)}${report.period ? ` · ${escapeHtml(report.period.label)}` : ""}</p><ul>${summary}</ul>${table}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 120);
  };

  const handleGenerateLetters = (currentReport: ReportData) => {
    const constituentIds = Array.from(new Set(currentReport.rows.map((row) => typeof row.donorId === "string" ? row.donorId : "").filter(Boolean)));
    if (constituentIds.length === 0) {
      setError("This report does not contain donor rows that can be sent to letter generation.");
      return;
    }
    const temporaryListId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `report-${Date.now()}`;
    window.sessionStorage.setItem(`oyama-letters:temporary-recipient-list:${temporaryListId}`, JSON.stringify({
      name: `${currentReport.title} recipients`,
      constituentIds,
      donationIds: currentReport.rows.map((row) => typeof row.donationId === "string" ? row.donationId : "").filter(Boolean),
      createdAt: new Date().toISOString(),
    }));
    window.location.assign(`/oyama-letters/generate?mode=batch&temporaryListId=${encodeURIComponent(temporaryListId)}&source=report&reportTitle=${encodeURIComponent(currentReport.title)}`);
  };

  return (
    <div className="mx-auto max-w-[1720px] space-y-3 py-3 sm:py-4">
      <WorkspaceBreadcrumbBar
        items={[{ label: "Donor CRM", href: "/" }, { label: "Reports" }]}
        statusLabel="Working"
        metadata={activeTool ? "Report tool" : selected ? "Live report data" : "Report library"}
        accentTone="blue"
      />

      {activeTool === "donation-audience" ? <DonationAudienceTool onBack={() => setActiveTool(null)} /> : selected ? (
        <ReportRunner
          definition={selected}
          report={report}
          designations={designations}
          from={from}
          through={through}
          year={year}
          paymentMethod={paymentMethod}
          designationId={designationId}
          limit={limit}
          lapseMode={lapseMode}
          lapseFromYear={lapseFromYear}
          lapseThroughYear={lapseThroughYear}
          lapseNotSinceYear={lapseNotSinceYear}
          loading={loading}
          exporting={exporting}
          error={error}
          reportingMode={reportingMode}
          onReportingModeChange={(mode) => {
            setStoredReportingYearMode(mode);
            setReportingMode(mode);
          }}
          onBack={backToLibrary}
          onFromChange={setFrom}
          onThroughChange={setThrough}
          onYearChange={setYear}
          onPaymentMethodChange={setPaymentMethod}
          onDesignationChange={setDesignationId}
          onLimitChange={setLimit}
          onLapseModeChange={setLapseMode}
          onLapseFromYearChange={setLapseFromYear}
          onLapseThroughYearChange={setLapseThroughYear}
          onLapseNotSinceYearChange={setLapseNotSinceYear}
          onRun={() => void loadReport(selected, "refresh")}
          onExport={() => void handleExport()}
          onPrint={handlePrint}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          onShowInsights={() => setShowInsights(true)}
          onGenerateLetters={() => report ? handleGenerateLetters(report) : undefined}
        />
      ) : (
        <ReportLibrary onRun={(definition) => void loadReport(definition)} onOpenDonationAudience={() => setActiveTool("donation-audience")} />
      )}
      {showInsights && report && selected?.key === "crm-performance-scorecard" ? <PerformanceInsightsModal report={report} onClose={() => setShowInsights(false)} /> : null}
    </div>
  );
}

function ReportLibrary({ onRun, onOpenDonationAudience }: { onRun: (definition: ReportDefinition) => void; onOpenDonationAudience: () => void }) {
  const [reportSearch, setReportSearch] = useState("");
  const normalizedSearch = reportSearch.trim().toLowerCase();
  const filteredReports = REPORTS.filter((report) => !normalizedSearch || [report.title, report.description, report.source, report.capabilities].some((value) => value.toLowerCase().includes(normalizedSearch)));
  return (
    <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#edf5fc_58%,#fff_100%)] px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">Donor reporting</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Choose a report</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Every report runs against live, organization-scoped donor data and can be printed or exported after review.</p>
      </div>
      <div className="grid gap-px border-b border-slate-200 bg-slate-200 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="bg-emerald-50 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Audience workflow</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Donation date-range audience</h2><p className="mt-1 text-sm text-slate-600">Review donors in a period, then create letters or email.</p></div><button type="button" onClick={onOpenDonationAudience} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Open tool</button></div></div>
        <div className="bg-white px-5 py-4"><label htmlFor="report-library-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Find a report</label><div className="mt-2 flex items-center gap-2"><input id="report-library-search" type="search" value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Giving, retention, campaign..." className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><span className="shrink-0 text-xs font-medium text-slate-500">{filteredReports.length} of {REPORTS.length}</span></div></div>
      </div>
      {(["Gift reports", "Donor reports"] as const).map((group) => (
        filteredReports.some((report) => report.group === group) ? <div key={group} className="border-b border-slate-200 last:border-b-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-800">{group}</div>
          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredReports.filter((report) => report.group === group).map((report) => (
              <article key={report.key} title={`${report.title}: ${report.description}`} className="group flex min-h-[220px] flex-col bg-white p-5 transition-all hover:relative hover:z-10 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-2.5">
                  <DocumentIcon />
                  <div>
                    <h2 className="text-base font-medium leading-5 text-slate-800">{report.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{report.capabilities}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-600">{report.description}</p>
                <p className="mt-1 text-xs text-slate-500" title="The live CRM records used to build this report">Source: {report.source}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4"><span className="text-[11px] font-medium text-slate-500">{report.scope === "date" ? "Date filters" : report.scope === "year" ? "Year comparison" : report.scope === "lapse" ? "Lapse history filters" : "All records"}</span><button type="button" onClick={() => onRun(report)} className="rounded-md bg-[#0f6cbd] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b5a9d]">Run report</button></div>
              </article>
            ))}
          </div>
        </div> : null
      ))}
      {filteredReports.length === 0 ? <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-800">No reports match “{reportSearch}”</p><button type="button" onClick={() => setReportSearch("")} className="mt-2 text-sm font-medium text-blue-700 hover:underline">Clear search</button></div> : null}
    </section>
  );
}

function ReportRunner({
  definition,
  report,
  designations,
  from,
  through,
  year,
  paymentMethod,
  designationId,
  limit,
  lapseMode,
  lapseFromYear,
  lapseThroughYear,
  lapseNotSinceYear,
  loading,
  exporting,
  error,
  reportingMode,
  onReportingModeChange,
  onBack,
  onFromChange,
  onThroughChange,
  onYearChange,
  onPaymentMethodChange,
  onDesignationChange,
  onLimitChange,
  onLapseModeChange,
  onLapseFromYearChange,
  onLapseThroughYearChange,
  onLapseNotSinceYearChange,
  onRun,
  onExport,
  onPrint,
  displayMode,
  onDisplayModeChange,
  onShowInsights,
  onGenerateLetters,
}: {
  definition: ReportDefinition;
  report: ReportData | null;
  designations: DesignationOption[];
  from: string;
  through: string;
  year: string;
  paymentMethod: string;
  designationId: string;
  limit: string;
  lapseMode: "all" | "lastGiftRange" | "notSince";
  lapseFromYear: string;
  lapseThroughYear: string;
  lapseNotSinceYear: string;
  loading: boolean;
  exporting: boolean;
  error: string | null;
  reportingMode: ReportingYearMode;
  onReportingModeChange: (mode: ReportingYearMode) => void;
  onBack: () => void;
  onFromChange: (value: string) => void;
  onThroughChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onLapseModeChange: (value: "all" | "lastGiftRange" | "notSince") => void;
  onLapseFromYearChange: (value: string) => void;
  onLapseThroughYearChange: (value: string) => void;
  onLapseNotSinceYearChange: (value: string) => void;
  onRun: () => void;
  onExport: () => void;
  onPrint: () => void;
  displayMode: "grid" | "visual";
  onDisplayModeChange: (mode: "grid" | "visual") => void;
  onShowInsights: () => void;
  onGenerateLetters: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#edf5fc_58%,#fff_100%)] px-4 py-4 sm:px-5">
        <button type="button" onClick={onBack} className="text-sm font-medium text-[#0f6cbd] hover:underline">← All reports</button>
        <div className="mt-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">Donor report</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{definition.title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{definition.description}</p>
          </div>
          <p className="text-xs text-slate-500">Source: {definition.source}</p>
        </div>
        <div className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Reporting year basis">
          {(["calendar", "fiscal"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onReportingModeChange(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${reportingMode === mode ? "bg-[#0f6cbd] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {mode === "calendar" ? "Calendar year" : "Fiscal year"}
            </button>
          ))}
        </div>
      </div>

      <WorkspaceRibbon sticky={false} accentTone="blue" tabs={[{ label: "Report", active: true }]}> 
        <WorkspaceRibbonGroup label="Run">
          <WorkspaceRibbonButton label={loading ? "Running" : "Run report"} onClick={onRun} disabled={loading} accentTone="blue" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Output">
          <WorkspaceRibbonButton label="Grid" onClick={() => onDisplayModeChange("grid")} disabled={!report || displayMode === "grid"} accentTone="blue" />
          <WorkspaceRibbonButton label="Visual" onClick={() => onDisplayModeChange("visual")} disabled={!report || displayMode === "visual"} accentTone="blue" />
          {definition.key === "crm-performance-scorecard" ? <WorkspaceRibbonButton label="AI insights" onClick={onShowInsights} disabled={!report} accentTone="blue" /> : null}
          <WorkspaceRibbonButton label={exporting ? "Exporting" : "Export CSV"} onClick={onExport} disabled={!report || exporting} accentTone="blue" />
          <WorkspaceRibbonButton label="Print report" onClick={onPrint} disabled={!report} accentTone="blue" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {definition.scope === "date" ? <>
            <FilterField label="Start date"><input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} className="report-input" /></FilterField>
            <FilterField label="End date"><input type="date" value={through} onChange={(event) => onThroughChange(event.target.value)} className="report-input" /></FilterField>
          </> : null}
          {definition.scope === "year" ? <FilterField label="Comparison year"><input type="number" min="2000" max="2100" value={year} onChange={(event) => onYearChange(event.target.value)} className="report-input w-32" /></FilterField> : null}
          {definition.scope === "lapse" ? <>
            <FilterField label="Lapsed donor view"><select value={lapseMode} onChange={(event) => onLapseModeChange(event.target.value as "all" | "lastGiftRange" | "notSince")} className="report-input min-w-56"><option value="all">All marked lapsed</option><option value="lastGiftRange">Last gift year range</option><option value="notSince">No gift since year</option></select></FilterField>
            {lapseMode === "lastGiftRange" ? <><FilterField label="Last gift from"><input type="number" min="1900" max="2100" value={lapseFromYear} onChange={(event) => onLapseFromYearChange(event.target.value)} className="report-input w-28" /></FilterField><FilterField label="Last gift through"><input type="number" min="1900" max="2100" value={lapseThroughYear} onChange={(event) => onLapseThroughYearChange(event.target.value)} className="report-input w-28" /></FilterField></> : null}
            {lapseMode === "notSince" ? <FilterField label="No completed gift since"><input type="number" min="1900" max="2100" value={lapseNotSinceYear} onChange={(event) => onLapseNotSinceYearChange(event.target.value)} className="report-input w-32" /></FilterField> : null}
          </> : null}
          {definition.supportsPayment ? <FilterField label="Payment type"><select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value)} className="report-input">{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterField> : null}
          {definition.supportsDesignation ? <FilterField label="Designation"><select value={designationId} onChange={(event) => onDesignationChange(event.target.value)} className="report-input"><option value="">All designations</option>{designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}</select></FilterField> : null}
          {definition.supportsLimit ? <FilterField label="Donors shown"><input type="number" min="1" max="1000" value={limit} onChange={(event) => onLimitChange(event.target.value)} className="report-input w-24" /></FilterField> : null}
          {definition.scope === "none" ? <p className="pb-1 text-sm text-slate-600">This report uses the current organization-wide donor record set.</p> : null}
          {definition.scope === "lapse" && lapseMode === "all" ? <p className="max-w-xl pb-1 text-sm text-slate-600">Includes every donor currently marked Lapsed and summarizes their full completed-gift history.</p> : null}
        </div>
        {definition.scope === "date" ? <div className="mt-3 flex flex-wrap gap-2"><span className="pt-1 text-xs font-medium text-slate-600">Quick range:</span><button type="button" onClick={() => { const range = lastMonthToDateRange(); onFromChange(range.from); onThroughChange(range.through); }} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">Last month to date</button><button type="button" onClick={() => { const today = new Date(); onFromChange(localDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29))); onThroughChange(localDateInput(today)); }} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">Last 30 days</button></div> : null}
      </div>

      {error ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {loading ? <ReportLoading /> : report ? <ReportOutput report={report} displayMode={displayMode} onGenerateLetters={onGenerateLetters} /> : null}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-slate-700"><span>{label}</span>{children}</label>;
}

function ReportLoading() {
  return <div className="p-4"><div className="grid gap-px overflow-hidden rounded border border-slate-300 bg-slate-200">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-11 animate-pulse bg-white" />)}</div></div>;
}

function ReportOutput({ report, displayMode, onGenerateLetters }: { report: ReportData; displayMode: "grid" | "visual"; onGenerateLetters: () => void }) {
  const donorRowCount = report.rows.filter((row) => typeof row.donorId === "string").length;
  const [showAudienceDialog, setShowAudienceDialog] = useState(false);
  const [audienceName, setAudienceName] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [savingAudience, setSavingAudience] = useState(false);
  const [audienceMessage, setAudienceMessage] = useState<string | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const donorRows = report.rows.filter((row) => typeof row.donorId === "string");
  const audienceDonorIds = Array.from(new Set(donorRows.map((row) => String(row.donorId))));
  const audienceEmails = Array.from(new Set(donorRows
    .filter((row) => typeof row.email === "string")
    .map((row) => String(row.email).trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))));

  useEffect(() => {
    if (!showAudienceDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingAudience) setShowAudienceDialog(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [savingAudience, showAudienceDialog]);

  function openAudienceDialog() {
    setAudienceName(`${report.title}${report.period?.label ? ` — ${report.period.label}` : ""}`);
    setAudienceDescription(`Saved from ${report.title}. ${report.description}`);
    setAudienceError(null);
    setShowAudienceDialog(true);
  }

  async function saveAudience() {
    if (!audienceName.trim() || audienceDonorIds.length === 0) return;
    setSavingAudience(true);
    setAudienceError(null);
    try {
      await apiFetch("/api/email-campaigns/lists", {
        method: "POST",
        body: JSON.stringify({
          name: audienceName.trim(),
          description: audienceDescription.trim(),
          recipientEmails: audienceEmails,
        }),
      });
      setShowAudienceDialog(false);
      setAudienceMessage(`Contacts Manager audience “${audienceName.trim()}” saved with ${audienceEmails.length.toLocaleString()} recipient email${audienceEmails.length === 1 ? "" : "s"}.`);
    } catch (requestError) {
      setAudienceError(requestError instanceof Error ? requestError.message : "Unable to save this audience.");
    } finally {
      setSavingAudience(false);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {report.summary.map((item) => <div key={item.label} title={`Live report metric: ${item.label}`} className="group min-w-32 rounded border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:border-blue-300 hover:bg-blue-50"><p className="text-xs text-slate-500">{item.label}<span className="ml-1 inline-block text-[10px] text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">ⓘ</span></p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatCell(item.value, item.type ?? "text")}</p></div>)}
        </div>
        <p className="text-xs text-slate-500">Generated {formatDateTime(report.generatedAt)}{report.period ? ` · ${report.period.label}` : ""}</p>
      </div>
      {donorRowCount > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"><div><p className="text-sm font-semibold text-emerald-950">Turn this report into outreach</p><p className="text-xs text-emerald-800">Open letter generation with {donorRowCount.toLocaleString()} donors, or save its email-bearing donors for later.</p></div><div className="flex flex-wrap gap-2">{report.report === "lapsed-donor-history" ? <button type="button" onClick={openAudienceDialog} className="rounded-md border border-emerald-700 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Save as audience list</button> : null}<button type="button" onClick={onGenerateLetters} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800">Generate letters →</button></div></div> : null}
      {audienceMessage ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><span>{audienceMessage}</span><div className="flex items-center gap-3"><Link href="/contacts-manager/lists" className="font-semibold hover:underline">Open audience lists →</Link><button type="button" onClick={() => setAudienceMessage(null)} className="font-semibold hover:underline">Dismiss</button></div></div> : null}
      {report.notices.map((notice) => <p key={notice} className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>)}
      {displayMode === "visual" ? <VisualReport report={report} /> : report.comparisonMatrix ? <ComparisonMatrix matrix={report.comparisonMatrix} /> : <ReportGrid report={report} />}
      {showAudienceDialog ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAudience) setShowAudienceDialog(false); }}><section role="dialog" aria-modal="true" aria-labelledby="save-lapsed-audience-title" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5"><div><h2 id="save-lapsed-audience-title" className="text-lg font-semibold text-slate-950">Save to Contacts Manager</h2><p className="mt-1 text-sm text-slate-600">Create a reusable audience list from this Lapsed Donor History result.</p></div><button type="button" onClick={() => setShowAudienceDialog(false)} disabled={savingAudience} aria-label="Close save audience dialog" className="rounded p-1 text-xl leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button></div><div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5"><div className="grid grid-cols-2 gap-2"><div className="rounded bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">Report donors</p><p className="font-semibold tabular-nums text-slate-900">{audienceDonorIds.length.toLocaleString()}</p></div><div className="rounded bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">Recipient emails</p><p className="font-semibold tabular-nums text-slate-900">{audienceEmails.length.toLocaleString()}</p></div></div>{audienceDonorIds.length > audienceEmails.length ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{(audienceDonorIds.length - audienceEmails.length).toLocaleString()} donor{audienceDonorIds.length - audienceEmails.length === 1 ? " has" : "s have"} no email and cannot be stored in the current Contacts Manager audience-list format.</p> : null}<label htmlFor="lapsed-audience-name" className="mt-4 block text-sm font-semibold text-slate-800">Audience name</label><input id="lapsed-audience-name" autoFocus value={audienceName} onChange={(event) => setAudienceName(event.target.value)} maxLength={160} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><label htmlFor="lapsed-audience-description" className="mt-4 block text-sm font-semibold text-slate-800">Notes <span className="font-normal text-slate-500">(optional)</span></label><textarea id="lapsed-audience-description" value={audienceDescription} onChange={(event) => setAudienceDescription(event.target.value)} rows={4} className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><p className="mt-3 text-xs leading-5 text-slate-500">The list is saved in Contacts Manager. Email suppression and opt-out rules are still enforced when the list is used.</p>{audienceError ? <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{audienceError}</p> : null}</div><div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5"><button type="button" onClick={() => setShowAudienceDialog(false)} disabled={savingAudience} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void saveAudience()} disabled={savingAudience || !audienceName.trim() || audienceEmails.length === 0} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{savingAudience ? "Saving audience..." : "Save audience"}</button></div></section></div> : null}
    </div>
  );
}

function ReportGrid({ report }: { report: ReportData }) {
  return (
    <div className="rounded border border-slate-300">
      <div className="divide-y divide-slate-200 lg:hidden">
        {report.rows.map((row, index) => <article key={`${row.donorId ?? row.taskId ?? index}`} className="p-3.5">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Row {index + 1}</span>{typeof row.donorId === "string" ? <Link href={`/constituents/${encodeURIComponent(row.donorId)}`} className="text-xs font-semibold text-blue-700 hover:underline">Open donor →</Link> : null}</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {report.columns.map((column) => <div key={column.key} className="min-w-0 rounded-md bg-slate-50 px-2.5 py-2"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{column.label}</dt><dd className={`mt-0.5 break-words text-sm text-slate-900 ${column.type === "currency" || column.type === "number" ? "font-semibold tabular-nums" : ""}`}>{column.linkToDonor && typeof row.donorId === "string" ? <Link href={`/constituents/${encodeURIComponent(row.donorId)}`} className="font-medium text-blue-700 hover:underline">{formatCell(row[column.key] ?? null, column.type ?? "text")}</Link> : formatCell(row[column.key] ?? null, column.type ?? "text")}</dd></div>)}
          </dl>
        </article>)}
        {report.rows.length === 0 ? <div className="px-4 py-12 text-center text-sm text-slate-500">No matching records were found for this report.</div> : null}
      </div>
      <div className="hidden overflow-x-auto lg:block">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#5d5d5d] text-left text-xs text-white">
          <tr>
            <th className="w-11 border-r border-white/20 px-3 py-2 text-right font-semibold">#</th>
            {report.columns.map((column) => <th key={column.key} className="whitespace-nowrap border-r border-white/20 px-3 py-2 font-semibold last:border-r-0">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, index) => <tr key={`${row.donorId ?? row.taskId ?? index}`} title="Hover a value to inspect its source field" className="group hover:bg-[#f7fbff]">
            <td className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs tabular-nums text-slate-500">{index + 1}</td>
            {report.columns.map((column) => <td key={column.key} title={`${column.label}: ${formatCell(row[column.key] ?? null, column.type ?? "text")}`} className={`border-b border-r border-slate-200 px-3 py-2 align-top ${column.type === "currency" || column.type === "number" ? "text-right tabular-nums" : ""}`}>
              {column.linkToDonor && typeof row.donorId === "string" ? <Link href={`/constituents/${encodeURIComponent(row.donorId)}`} className="font-medium text-[#0f6cbd] hover:underline">{formatCell(row[column.key] ?? null, column.type ?? "text")}</Link> : formatCell(row[column.key] ?? null, column.type ?? "text")}
            </td>)}
          </tr>)}
          {report.rows.length === 0 ? <tr><td colSpan={report.columns.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">No matching records were found for this report.</td></tr> : null}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ComparisonMatrix({ matrix }: { matrix: NonNullable<ReportData["comparisonMatrix"]> }) {
  const currentLabel = matrix.labels?.current ?? `Current year ${matrix.columns.currentYear}`;
  const priorLabel = matrix.labels?.prior ?? `Prior year ${matrix.columns.priorYear}`;
  const twoYearsPriorLabel = matrix.labels?.twoYearsPrior ?? `Two years prior ${matrix.columns.twoYearsPrior}`;
  return (
    <div className="overflow-x-auto rounded border border-slate-300">
      <table className="min-w-[820px] w-full border-collapse text-sm">
        <thead className="bg-[#5d5d5d] text-white">
          <tr><th className="w-36 border-r border-white/20 px-3 py-2 text-left font-semibold">Donor group</th><th className="min-w-60 border-r border-white/20 px-3 py-2 text-left font-semibold">Metric</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">{currentLabel}</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">{priorLabel}</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">{twoYearsPriorLabel}</th><th className="px-3 py-2 text-right font-semibold">Change</th></tr>
        </thead>
        <tbody>
          {matrix.sections.flatMap((section) => section.rows.map((row, index) => <tr key={`${section.label}-${row.label}`} className="hover:bg-[#f7fbff]">
            {index === 0 ? <td rowSpan={section.rows.length} className="border-b border-r border-slate-200 bg-[#666] px-3 py-2 align-top font-semibold text-white">{section.label}</td> : null}
            <td className="border-b border-r border-slate-200 px-3 py-2 text-slate-800">{row.label}</td>
            <td className="border-b border-r border-slate-200 px-3 py-2 text-right tabular-nums">{formatCell(row.current, row.type)}</td>
            <td className="border-b border-r border-slate-200 px-3 py-2 text-right tabular-nums">{formatCell(row.prior, row.type)}</td>
            <td className="border-b border-r border-slate-200 px-3 py-2 text-right tabular-nums">{formatCell(row.twoYearsPrior, row.type)}</td>
            <td className={`border-b border-slate-200 px-3 py-2 text-right tabular-nums ${typeof row.difference === "number" && row.difference < 0 ? "font-semibold text-red-600" : ""}`}>{row.difference == null ? "" : formatCell(row.difference, row.type)}</td>
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}

const VISUAL_COLORS = ["#0f6cbd", "#0f766e", "#7c3aed", "#d97706", "#db2777", "#475569", "#16a34a", "#dc2626"];
type VisualConfig = { rows: Array<Record<string, string | number | null>>; labelKey: string; metrics: string[]; labels: string[]; title: string };

function VisualReport({ report }: { report: ReportData }) {
  const visual = useMemo<VisualConfig | null>(() => {
    if (report.comparisonMatrix) {
      const rows: VisualConfig["rows"] = report.comparisonMatrix.sections.flatMap((section) => section.rows.map((row) => ({ label: `${section.label}: ${row.label}`, current: row.current, prior: row.prior })));
      return { rows, labelKey: "label", metrics: ["current", "prior"], labels: [report.comparisonMatrix.labels?.current ?? `${report.comparisonMatrix.columns.currentYear}`, report.comparisonMatrix.labels?.prior ?? `${report.comparisonMatrix.columns.priorYear}`], title: "Current and prior period comparison" };
    }
    const textColumn = report.columns.find((column) => column.type !== "currency" && column.type !== "number" && column.type !== "date" && !column.linkToDonor);
    const metricColumns = report.columns.filter((column) => column.type === "currency" || column.type === "number").slice(0, 2);
    if (!textColumn || metricColumns.length === 0) return null;
    return { rows: report.rows.slice(0, 12).map((row) => ({ ...row, [textColumn.key]: String(row[textColumn.key] ?? "Unlabeled") })), labelKey: textColumn.key, metrics: metricColumns.map((column) => column.key), labels: metricColumns.map((column) => column.label), title: `${metricColumns.map((column) => column.label).join(" and ")} by ${textColumn.label.toLowerCase()}` };
  }, [report]);

  if (!visual || visual.rows.length === 0) return <div className="rounded border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600">This report has no numeric data to visualize for the current filters. Try a different range or return to the grid.</div>;
  const isBreakdown = !report.comparisonMatrix && visual.metrics.length > 0;
  const pieData = visual.rows.map((row) => ({ name: String(row[visual.labelKey]), value: Number(row[visual.metrics[0]] ?? 0) }));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">{visual.title}</h3>
        <p className="mt-1 text-xs text-slate-500">Showing up to 12 rows from the current live report.</p>
        <div className="mt-4 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visual.rows} margin={{ top: 12, right: 12, left: 8, bottom: 48 }}>
              <XAxis dataKey={visual.labelKey} angle={-28} textAnchor="end" interval={0} height={82} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value, name) => [Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }), String(name)]} />
              <Legend />
              {visual.metrics.map((metric, index) => <Bar key={metric} dataKey={metric} name={visual.labels[index]} fill={VISUAL_COLORS[index]} radius={[3, 3, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      {isBreakdown ? <section className="rounded border border-slate-200 bg-white p-4"><h3 className="text-sm font-semibold text-slate-900">{visual.labels[0]} mix</h3><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100} paddingAngle={2}>{pieData.map((entry, index) => <Cell key={entry.name} fill={VISUAL_COLORS[index % VISUAL_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} /></PieChart></ResponsiveContainer></div><ul className="space-y-1 text-xs text-slate-600">{pieData.map((entry, index) => <li key={entry.name} className="flex justify-between gap-2"><span className="truncate"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: VISUAL_COLORS[index % VISUAL_COLORS.length] }} />{entry.name}</span><span className="tabular-nums">{entry.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></li>)}</ul></section> : null}
    </div>
  );
}

function PerformanceInsightsModal({ report, onClose }: { report: ReportData; onClose: () => void }) {
  const metrics = report.comparisonMatrix?.sections.flatMap((section) => section.rows) ?? [];
  const positive = metrics.filter((metric) => metric.difference != null && metric.difference > 0).length;
  const declining = metrics.filter((metric) => metric.difference != null && metric.difference < 0);
  const score = metrics.length ? Math.round((positive / metrics.length) * 100) : 0;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="performance-insights-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">AI-assisted performance review</p><h2 id="performance-insights-title" className="mt-1 text-xl font-semibold text-slate-950">Selected-period CRM insights</h2><p className="mt-1 text-sm text-slate-600">Transparent signals calculated from the live report and its prior equal period.</p></div><button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close insights">×</button></div>
      <div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-3"><InsightCard label="Performance signal" value={`${score}/100`} detail={`${positive} improving metrics`} /><InsightCard label="Attention signals" value={String(declining.length)} detail={declining.length ? declining.map((metric) => metric.label).join(", ") : "No declining tracked metric"} /><InsightCard label="User AI score" value="Not available" detail="No validated per-user AI scoring data is stored in this report." /></div><div className="rounded-lg border border-slate-200"><div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Metric explanations</div><div className="divide-y divide-slate-100">{metrics.map((metric) => <div key={metric.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span className="font-medium text-slate-800">{metric.label}</span><span className={metric.difference != null && metric.difference < 0 ? "font-semibold tabular-nums text-red-700" : "font-semibold tabular-nums text-emerald-700"}>{metric.difference == null ? "No prior-period baseline" : `${metric.difference > 0 ? "+" : ""}${formatCell(metric.difference, metric.type)}`}</span></div>)}</div></div><p className="text-xs leading-5 text-slate-500">These are decision-support signals, not predictions or donor propensity scores. Add a governed AI scoring source before treating any user-level AI score as operational data.</p></div>
    </section>
  </div>;
}

function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs leading-4 text-slate-500">{detail}</p></div>;
}

function matrixPrintTable(matrix: NonNullable<ReportData["comparisonMatrix"]>): string {
  const rows = matrix.sections.flatMap((section) => section.rows.map((row, index) => `<tr>${index === 0 ? `<td class="group" rowspan="${section.rows.length}">${escapeHtml(section.label)}</td>` : ""}<td>${escapeHtml(row.label)}</td><td>${escapeHtml(formatCell(row.current, row.type))}</td><td>${escapeHtml(formatCell(row.prior, row.type))}</td><td>${escapeHtml(formatCell(row.twoYearsPrior, row.type))}</td><td class="${typeof row.difference === "number" && row.difference < 0 ? "negative" : ""}">${row.difference == null ? "" : escapeHtml(formatCell(row.difference, row.type))}</td></tr>`)).join("");
  return `<table><thead><tr><th>Donor group</th><th>Metric</th><th>Current year ${matrix.columns.currentYear}</th><th>Prior year ${matrix.columns.priorYear}</th><th>Two years prior ${matrix.columns.twoYearsPrior}</th><th>vs. prior year</th></tr></thead><tbody>${rows}</tbody></table>`;
}
