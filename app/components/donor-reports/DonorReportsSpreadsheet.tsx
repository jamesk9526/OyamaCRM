"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

type ReportKey =
  | "batch-receipts"
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
  | "never-given"
  | "top-donors";

type ColumnType = "currency" | "date" | "number" | "text";
type MatrixValueType = "currency" | "number" | "decimal";

interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  source: string;
  capabilities: string;
  scope: "date" | "year" | "none";
  group: "Gift reports" | "Donor reports";
  supportsPayment?: boolean;
  supportsDesignation?: boolean;
  supportsLimit?: boolean;
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
  { key: "donations", title: "Donations", description: "Print or export a detailed list of completed gifts in a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "donations-by-designation", title: "Donations by Designation", description: "See completed giving grouped by donor and designation.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "lifetime-giving", title: "Lifetime Giving Report", description: "See every giving donor’s lifetime total, first, last, and largest completed gift.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Gift reports" },
  { key: "monthly-giving", title: "Monthly Giving Report", description: "Summarize donor giving for a month or any chosen date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports" },
  { key: "comprehensive-donor-analysis", title: "Comprehensive Donor Analysis", description: "Compare active, new, and repeat donor giving across three calendar years.", source: "Completed donations + first-gift dates", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "donor-files", title: "Donor Files", description: "A contact and mailing-preference directory for current donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "giving-capacity-interest", title: "Donor Files by Giving Capacity and Interest", description: "Review donor tags alongside lifetime giving. Capacity is shown only when stored as a tag.", source: "Donor tags + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-follow-up", title: "Donor Follow-up", description: "Open follow-up tasks tied to donor records, ordered for staff review.", source: "Tasks", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-notes", title: "Donor Notes", description: "A report of profile notes recorded on donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "first-time-donors", title: "First Time Donors", description: "Find donors whose first completed gift falls in the selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports" },
  { key: "lapsed-donors", title: "Lapsed Donors (SYBUNTY)", description: "Find donors who gave in the prior year but not in the selected year.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "never-given", title: "Never Given Report", description: "List donor files with no completed donation record.", source: "Donor files + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "top-donors", title: "Top Donors", description: "Rank donors by completed giving within a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports", supportsLimit: true },
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
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<DesignationOption[]>("/api/designations")
      .then(setDesignations)
      .catch(() => setDesignations([]));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (!selected) return params;
    if (selected.scope === "date") {
      params.set("from", from);
      params.set("through", through);
    }
    if (selected.scope === "year") params.set("year", year);
    if (selected.supportsPayment && paymentMethod) params.set("paymentMethod", paymentMethod);
    if (selected.supportsDesignation && designationId) params.set("designationId", designationId);
    if (selected.supportsLimit) params.set("limit", limit);
    return params;
  }, [selected, from, through, year, paymentMethod, designationId, limit]);

  const loadReport = useCallback(async (definition: ReportDefinition, mode: "open" | "refresh" = "open") => {
    if (mode === "open") setSelected(definition);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (definition.scope === "date") {
        params.set("from", from);
        params.set("through", through);
      }
      if (definition.scope === "year") params.set("year", year);
      if (definition.supportsPayment && paymentMethod) params.set("paymentMethod", paymentMethod);
      if (definition.supportsDesignation && designationId) params.set("designationId", designationId);
      if (definition.supportsLimit) params.set("limit", limit);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const nextReport = await apiFetch<ReportData>(`/api/reports/library/${definition.key}${suffix}`);
      setReport(nextReport);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", `/reports?report=${encodeURIComponent(definition.key)}`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to run this report right now.");
    } finally {
      setLoading(false);
    }
  }, [from, through, year, paymentMethod, designationId, limit]);

  useEffect(() => {
    if (typeof window === "undefined" || selected) return;
    const reportKey = new URLSearchParams(window.location.search).get("report") as ReportKey | null;
    const definition = REPORTS.find((item) => item.key === reportKey);
    if (definition) void loadReport(definition);
  }, [loadReport, selected]);

  const backToLibrary = () => {
    setSelected(null);
    setReport(null);
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

  return (
    <div className="mx-auto max-w-[1720px] space-y-3 py-3 sm:py-4">
      <WorkspaceBreadcrumbBar
        items={[{ label: "Donor CRM", href: "/" }, { label: "Reports" }]}
        statusLabel="Working"
        metadata={selected ? "Live report data" : "Report library"}
        accentTone="blue"
      />

      {selected ? (
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
          loading={loading}
          exporting={exporting}
          error={error}
          onBack={backToLibrary}
          onFromChange={setFrom}
          onThroughChange={setThrough}
          onYearChange={setYear}
          onPaymentMethodChange={setPaymentMethod}
          onDesignationChange={setDesignationId}
          onLimitChange={setLimit}
          onRun={() => void loadReport(selected, "refresh")}
          onExport={() => void handleExport()}
          onPrint={handlePrint}
        />
      ) : (
        <ReportLibrary onRun={(definition) => void loadReport(definition)} />
      )}
    </div>
  );
}

function ReportLibrary({ onRun }: { onRun: (definition: ReportDefinition) => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#edf5fc_58%,#fff_100%)] px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">Donor reporting</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Choose a report</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Every report runs against live, organization-scoped donor data and can be printed or exported after review.</p>
      </div>
      {(["Gift reports", "Donor reports"] as const).map((group) => (
        <div key={group} className="border-b border-slate-200 last:border-b-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-800">{group}</div>
          <div className="grid gap-1 bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
            {REPORTS.filter((report) => report.group === group).map((report) => (
              <article key={report.key} className="flex min-h-[238px] flex-col bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.07)] transition-shadow hover:relative hover:z-10 hover:shadow-md">
                <div className="flex items-start gap-2.5">
                  <DocumentIcon />
                  <div>
                    <h2 className="text-base font-medium leading-5 text-slate-800">{report.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{report.capabilities}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-600">{report.description}</p>
                <p className="mt-1 text-xs text-slate-500">Source: {report.source}</p>
                <button type="button" onClick={() => onRun(report)} className="mt-auto self-end pt-4 text-sm font-medium text-[#0f6cbd] hover:text-[#0b5a9d] hover:underline">Run Report</button>
              </article>
            ))}
          </div>
        </div>
      ))}
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
  loading,
  exporting,
  error,
  onBack,
  onFromChange,
  onThroughChange,
  onYearChange,
  onPaymentMethodChange,
  onDesignationChange,
  onLimitChange,
  onRun,
  onExport,
  onPrint,
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
  loading: boolean;
  exporting: boolean;
  error: string | null;
  onBack: () => void;
  onFromChange: (value: string) => void;
  onThroughChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onRun: () => void;
  onExport: () => void;
  onPrint: () => void;
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
      </div>

      <WorkspaceRibbon sticky={false} accentTone="blue" tabs={[{ label: "Report", active: true }]}> 
        <WorkspaceRibbonGroup label="Run">
          <WorkspaceRibbonButton label={loading ? "Running" : "Run report"} onClick={onRun} disabled={loading} accentTone="blue" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Output">
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
          {definition.supportsPayment ? <FilterField label="Payment type"><select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value)} className="report-input">{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterField> : null}
          {definition.supportsDesignation ? <FilterField label="Designation"><select value={designationId} onChange={(event) => onDesignationChange(event.target.value)} className="report-input"><option value="">All designations</option>{designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}</select></FilterField> : null}
          {definition.supportsLimit ? <FilterField label="Donors shown"><input type="number" min="1" max="1000" value={limit} onChange={(event) => onLimitChange(event.target.value)} className="report-input w-24" /></FilterField> : null}
          {definition.scope === "none" ? <p className="pb-1 text-sm text-slate-600">This report uses the current organization-wide donor record set.</p> : null}
        </div>
      </div>

      {error ? <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {loading ? <ReportLoading /> : report ? <ReportOutput report={report} /> : null}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-slate-700"><span>{label}</span>{children}</label>;
}

function ReportLoading() {
  return <div className="p-4"><div className="grid gap-px overflow-hidden rounded border border-slate-300 bg-slate-200">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-11 animate-pulse bg-white" />)}</div></div>;
}

function ReportOutput({ report }: { report: ReportData }) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {report.summary.map((item) => <div key={item.label} className="min-w-32 rounded border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatCell(item.value, item.type ?? "text")}</p></div>)}
        </div>
        <p className="text-xs text-slate-500">Generated {formatDateTime(report.generatedAt)}{report.period ? ` · ${report.period.label}` : ""}</p>
      </div>
      {report.notices.map((notice) => <p key={notice} className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>)}
      {report.comparisonMatrix ? <ComparisonMatrix matrix={report.comparisonMatrix} /> : <ReportGrid report={report} />}
    </div>
  );
}

function ReportGrid({ report }: { report: ReportData }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-300">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#5d5d5d] text-left text-xs text-white">
          <tr>
            <th className="w-11 border-r border-white/20 px-3 py-2 text-right font-semibold">#</th>
            {report.columns.map((column) => <th key={column.key} className="whitespace-nowrap border-r border-white/20 px-3 py-2 font-semibold last:border-r-0">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, index) => <tr key={`${row.donorId ?? row.taskId ?? index}`} className="hover:bg-[#f7fbff]">
            <td className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs tabular-nums text-slate-500">{index + 1}</td>
            {report.columns.map((column) => <td key={column.key} className={`border-b border-r border-slate-200 px-3 py-2 align-top ${column.type === "currency" || column.type === "number" ? "text-right tabular-nums" : ""}`}>
              {column.linkToDonor && typeof row.donorId === "string" ? <Link href={`/constituents/${encodeURIComponent(row.donorId)}`} className="font-medium text-[#0f6cbd] hover:underline">{formatCell(row[column.key] ?? null, column.type ?? "text")}</Link> : formatCell(row[column.key] ?? null, column.type ?? "text")}
            </td>)}
          </tr>)}
          {report.rows.length === 0 ? <tr><td colSpan={report.columns.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">No matching records were found for this report.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonMatrix({ matrix }: { matrix: NonNullable<ReportData["comparisonMatrix"]> }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-300">
      <table className="min-w-[820px] w-full border-collapse text-sm">
        <thead className="bg-[#5d5d5d] text-white">
          <tr><th className="w-36 border-r border-white/20 px-3 py-2 text-left font-semibold">Donor group</th><th className="min-w-60 border-r border-white/20 px-3 py-2 text-left font-semibold">Metric</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">Current year<br />{matrix.columns.currentYear}</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">Prior year<br />{matrix.columns.priorYear}</th><th className="border-r border-white/20 px-3 py-2 text-right font-semibold">Two years prior<br />{matrix.columns.twoYearsPrior}</th><th className="px-3 py-2 text-right font-semibold">vs. prior year</th></tr>
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

function matrixPrintTable(matrix: NonNullable<ReportData["comparisonMatrix"]>): string {
  const rows = matrix.sections.flatMap((section) => section.rows.map((row, index) => `<tr>${index === 0 ? `<td class="group" rowspan="${section.rows.length}">${escapeHtml(section.label)}</td>` : ""}<td>${escapeHtml(row.label)}</td><td>${escapeHtml(formatCell(row.current, row.type))}</td><td>${escapeHtml(formatCell(row.prior, row.type))}</td><td>${escapeHtml(formatCell(row.twoYearsPrior, row.type))}</td><td class="${typeof row.difference === "number" && row.difference < 0 ? "negative" : ""}">${row.difference == null ? "" : escapeHtml(formatCell(row.difference, row.type))}</td></tr>`)).join("");
  return `<table><thead><tr><th>Donor group</th><th>Metric</th><th>Current year ${matrix.columns.currentYear}</th><th>Prior year ${matrix.columns.priorYear}</th><th>Two years prior ${matrix.columns.twoYearsPrior}</th><th>vs. prior year</th></tr></thead><tbody>${rows}</tbody></table>`;
}
