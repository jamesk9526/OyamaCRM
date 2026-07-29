"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

type SheetKey = "giving" | "designation";
type SortKey = "designationName" | "donorName" | "giftCount" | "totalAmount" | "lastGiftAt";
type SortDirection = "ascending" | "descending";

interface DonorDesignationRow {
  donorId: string;
  donorName: string;
  donorEmail: string | null;
  designationId: string | null;
  designationName: string;
  giftCount: number;
  totalAmount: number;
  lastGiftAt: string;
}

interface DonorDesignationReport {
  report: "donors-by-designation";
  period: {
    key: "month-to-date";
    label: string;
    from: string;
    through: string;
  };
  summary: {
    totalAmount: number;
    giftCount: number;
    donorCount: number;
    designationCount: number;
  };
  rows: DonorDesignationRow[];
  generatedAt: string;
}

const SHEETS: Array<{ key: SheetKey; label: string; detail: string }> = [
  { key: "giving", label: "Month-to-date giving", detail: "The current month through now" },
  { key: "designation", label: "Donors by designation", detail: "One row per donor and designation" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapePrintHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function sheetTitle(activeSheet: SheetKey): string {
  return SHEETS.find((sheet) => sheet.key === activeSheet)?.label ?? "Donor report";
}

/**
 * Lean reporting workbook for Donor CRM. It intentionally begins with two
 * useful, live sheets and one shared MTD data contract rather than reviving
 * the old, disconnected report-builder product.
 */
export default function DonorReportsSpreadsheet() {
  const [report, setReport] = useState<DonorDesignationReport | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetKey>(() => {
    if (typeof window === "undefined") return "giving";
    return new URLSearchParams(window.location.search).get("sheet") === "designation" ? "designation" : "giving";
  });
  const [sortKey, setSortKey] = useState<SortKey>("designationName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReport = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const nextReport = await apiFetch<DonorDesignationReport>("/api/reports/donors-by-designation");
      setReport(nextReport);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the donor report right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const sortedRows = useMemo(() => {
    if (!report) return [];
    return [...report.rows].sort((first, second) => {
      const left = first[sortKey];
      const right = second[sortKey];
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
      return sortDirection === "ascending" ? comparison : -comparison;
    });
  }, [report, sortDirection, sortKey]);

  const changeSort = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => current === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "totalAmount" || nextSortKey === "giftCount" ? "descending" : "ascending");
  };

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const response = await apiFetchResponse("/api/reports/exports/donors-by-designation.csv");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message ?? "You do not have permission to export this report.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `donors-by-designation-mtd-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice("CSV downloaded. It contains the same live MTD rows shown in this workbook.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export this report.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!report) return;
    const title = sheetTitle(activeSheet);
    const summaryRows = [
      ["Period", `${formatDate(report.period.from)} – ${formatDateTime(report.period.through)}`],
      ["Total received", formatCurrency(report.summary.totalAmount)],
      ["Gifts received", String(report.summary.giftCount)],
      ["Donors represented", String(report.summary.donorCount)],
      ["Designations represented", String(report.summary.designationCount)],
    ];
    const table = activeSheet === "giving"
      ? summaryRows.map(([label, value], index) => `<tr><td>${index + 1}</td><td>${escapePrintHtml(label)}</td><td>${escapePrintHtml(value)}</td></tr>`).join("")
      : sortedRows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapePrintHtml(row.designationName)}</td><td>${escapePrintHtml(row.donorName)}</td><td>${escapePrintHtml(row.donorEmail ?? "")}</td><td>${row.giftCount}</td><td>${escapePrintHtml(formatCurrency(row.totalAmount))}</td><td>${escapePrintHtml(formatDate(row.lastGiftAt))}</td></tr>`).join("");
    const headers = activeSheet === "giving"
      ? "<tr><th>#</th><th>Metric</th><th>Value</th></tr>"
      : "<tr><th>#</th><th>Designation</th><th>Donor</th><th>Email</th><th>Gifts</th><th>Total received</th><th>Last gift</th></tr>";
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      return;
    }

    printWindow.document.write(`<!doctype html><html><head><title>${escapePrintHtml(title)}</title><style>body{font-family:Segoe UI,Arial,sans-serif;color:#172033;margin:32px}h1{font-size:22px;margin:0 0 4px}p{color:#52606f;margin:0 0 20px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#e8f1fb;text-align:left;font-weight:700}th,td{border:1px solid #b9c6d3;padding:8px;vertical-align:top}td:first-child{color:#64748b;width:36px;text-align:right}tr:nth-child(even) td{background:#f8fafc}@page{size:landscape;margin:14mm}</style></head><body><h1>${escapePrintHtml(title)}</h1><p>Month to date · ${escapePrintHtml(formatDate(report.period.from))} through ${escapePrintHtml(formatDateTime(report.period.through))}</p><table><thead>${headers}</thead><tbody>${table}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
  };

  const activeSheetDetail = SHEETS.find((sheet) => sheet.key === activeSheet)?.detail ?? "";

  return (
    <div className="donor-reports-workspace mx-auto max-w-[1720px] space-y-3 py-3 sm:py-4">
      <WorkspaceBreadcrumbBar
        items={[{ label: "Donor CRM", href: "/" }, { label: "Reports" }]}
        statusLabel="Working"
        metadata={report ? `Live data through ${formatDateTime(report.period.through)}` : "Loading live donor data"}
        accentTone="blue"
      />

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#edf5fc_56%,#ffffff_100%)] px-4 py-4 sm:px-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#0f6cbd] text-[11px] text-white">R</span>
                Donor reporting workbook
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Reports that start with today’s giving</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">A focused, spreadsheet-style workspace for month-to-date fundraising review. Every total ends at the current moment—not the end of the month.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 rounded-md border border-[#b8d7f1] bg-white/80 px-3 py-2 text-xs sm:grid-cols-4">
              <div><p className="text-slate-500">Period</p><p className="mt-0.5 font-semibold text-slate-900">Month to date</p></div>
              <div><p className="text-slate-500">Received</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatCurrency(report?.summary.totalAmount ?? 0)}</p></div>
              <div><p className="text-slate-500">Gifts</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{report?.summary.giftCount ?? 0}</p></div>
              <div><p className="text-slate-500">Donors</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{report?.summary.donorCount ?? 0}</p></div>
            </div>
          </div>
        </div>

        <WorkspaceRibbon sticky={false} accentTone="blue" tabs={[{ label: "Workbook", active: true }]}> 
          <WorkspaceRibbonGroup label="Data">
            <WorkspaceRibbonButton label={refreshing ? "Refreshing" : "Refresh"} onClick={() => void loadReport("refresh")} disabled={loading || refreshing} accentTone="blue" />
          </WorkspaceRibbonGroup>
          <WorkspaceRibbonGroup label="Output">
            <WorkspaceRibbonButton label={exporting ? "Exporting" : "Export CSV"} onClick={() => void handleExport()} disabled={!report || exporting} accentTone="blue" />
            <WorkspaceRibbonButton label="Print sheet" onClick={handlePrint} disabled={!report} accentTone="blue" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>

        {error ? (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-5">
            <span>{error}</span>
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void loadReport("refresh")}>Try again</button>
          </div>
        ) : null}
        {notice ? <p className="mx-4 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:mx-5">{notice}</p> : null}

        <div className="grid min-h-[580px] grid-cols-1 border-t border-slate-200 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-3 lg:border-b-0 lg:border-r">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Workbook sheets</p>
            <nav className="space-y-1" aria-label="Report sheets">
              {SHEETS.map((sheet) => {
                const active = activeSheet === sheet.key;
                return (
                  <button
                    key={sheet.key}
                    type="button"
                    onClick={() => setActiveSheet(sheet.key)}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${active ? "border-[#0f6cbd] bg-[#e8f2fc] shadow-[inset_3px_0_0_#0f6cbd]" : "border-transparent hover:border-slate-200 hover:bg-white"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={`block text-sm font-semibold ${active ? "text-[#0b5a9d]" : "text-slate-800"}`}>{sheet.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{sheet.detail}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-3">
              <p className="text-xs font-semibold text-slate-700">Built to grow</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">New donor reports will be added as workbook sheets, using the same live, exportable data patterns.</p>
            </div>
          </aside>

          <section className="min-w-0 bg-white p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#b8d7f1] bg-[#f5faff] text-xs font-bold text-[#0f6cbd]">{activeSheet === "giving" ? "Σ" : "ƒ"}</span>
                  <h2 className="text-lg font-semibold text-slate-950">{sheetTitle(activeSheet)}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-600">{activeSheetDetail} · {report ? `${formatDate(report.period.from)} through ${formatDateTime(report.period.through)}` : "Loading period"}</p>
              </div>
              <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{report ? `Last refreshed ${formatDateTime(report.generatedAt)}` : "Refreshing data"}</p>
            </div>

            {loading ? (
              <div className="grid gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300">
                {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-11 animate-pulse bg-white" />)}
              </div>
            ) : activeSheet === "giving" ? (
              <SummarySheet report={report} />
            ) : (
              <DesignationSheet rows={sortedRows} sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function SummarySheet({ report }: { report: DonorDesignationReport | null }) {
  const rows = report ? [
    ["Reporting period", `${formatDate(report.period.from)} through ${formatDateTime(report.period.through)}`],
    ["Total received", formatCurrency(report.summary.totalAmount)],
    ["Gifts received", report.summary.giftCount.toLocaleString("en-US")],
    ["Donors represented", report.summary.donorCount.toLocaleString("en-US")],
    ["Designations represented", report.summary.designationCount.toLocaleString("en-US")],
  ] : [];

  return (
    <div className="overflow-x-auto rounded-md border border-slate-300">
      <table className="min-w-[560px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#f4f8fc] text-left text-xs font-semibold text-slate-700">
            <th className="w-12 border-b border-r border-slate-300 px-3 py-2 text-right text-slate-500">#</th>
            <th className="border-b border-r border-slate-300 px-3 py-2">A · Metric</th>
            <th className="border-b border-slate-300 px-3 py-2">B · Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={label} className="hover:bg-[#f7fbff]">
              <td className="border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-right text-xs tabular-nums text-slate-500">{index + 1}</td>
              <td className="border-b border-r border-slate-200 px-3 py-3 font-medium text-slate-800">{label}</td>
              <td className={`border-b border-slate-200 px-3 py-3 ${label === "Total received" ? "font-semibold tabular-nums text-[#0b5a9d]" : "text-slate-700"}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DesignationSheet({
  rows,
  sortKey,
  sortDirection,
  onSort,
}: {
  rows: DonorDesignationRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const heading = (label: string, key: SortKey, className = "") => (
    <button type="button" onClick={() => onSort(key)} className={`flex w-full items-center gap-1 text-left font-semibold hover:text-[#0b5a9d] ${className}`}>
      {label}<span className={`text-[10px] ${sortKey === key ? "text-[#0f6cbd]" : "text-slate-400"}`}>{sortKey === key ? (sortDirection === "ascending" ? "▲" : "▼") : "↕"}</span>
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-md border border-slate-300">
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#f4f8fc] text-xs text-slate-700 shadow-[0_1px_0_#cbd5e1]">
          <tr>
            <th className="w-12 border-b border-r border-slate-300 px-3 py-2 text-right font-semibold text-slate-500">#</th>
            <th className="min-w-44 border-b border-r border-slate-300 px-3 py-2">{heading("A · Designation", "designationName")}</th>
            <th className="min-w-44 border-b border-r border-slate-300 px-3 py-2">{heading("B · Donor", "donorName")}</th>
            <th className="min-w-52 border-b border-r border-slate-300 px-3 py-2 font-semibold">C · Email</th>
            <th className="w-24 border-b border-r border-slate-300 px-3 py-2">{heading("D · Gifts", "giftCount", "justify-end")}</th>
            <th className="w-36 border-b border-r border-slate-300 px-3 py-2">{heading("E · Total", "totalAmount", "justify-end")}</th>
            <th className="w-36 border-b border-slate-300 px-3 py-2">{heading("F · Last gift", "lastGiftAt")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.donorId}-${row.designationId ?? "general"}`} className="group hover:bg-[#f7fbff]">
              <td className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">{index + 1}</td>
              <td className="border-b border-r border-slate-200 px-3 py-2.5 font-medium text-slate-800">{row.designationName}</td>
              <td className="border-b border-r border-slate-200 px-3 py-2.5"><a href={`/constituents/${encodeURIComponent(row.donorId)}`} className="font-medium text-[#0b5a9d] hover:underline">{row.donorName}</a></td>
              <td className="border-b border-r border-slate-200 px-3 py-2.5 text-slate-600">{row.donorEmail ?? <span className="text-slate-400">No email</span>}</td>
              <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right tabular-nums text-slate-700">{row.giftCount}</td>
              <td className="border-b border-r border-slate-200 px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(row.totalAmount)}</td>
              <td className="border-b border-slate-200 px-3 py-2.5 text-slate-600">{formatDate(row.lastGiftAt)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">No completed donations have been recorded month to date.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
