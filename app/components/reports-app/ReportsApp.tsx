// First-class Donor CRM Reports app with prebuilt reports, live runners, and builder lite.

"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import ReportBuilderLite from "@/app/components/reports-app/ReportBuilderLite";
import ReportCard from "@/app/components/reports-app/ReportCard";
import ReportCategoryRail from "@/app/components/reports-app/ReportCategoryRail";
import ReportResultsWorkspace from "@/app/components/reports-app/ReportResultsWorkspace";
import {
  DEFAULT_REPORT_FILTERS,
  exportRowsToCsv,
  runLiveReport,
} from "@/app/components/reports-app/report-data-adapter";
import { DEFAULT_REPORT_ID, REPORT_CATEGORIES, REPORT_DEFINITIONS } from "@/app/components/reports-app/report-registry";
import type { BuilderDraft, ReportCategoryId, ReportFilters, ReportRunResult, SavedReportView } from "@/app/components/reports-app/report-types";

type AppMode = "home" | "runner" | "builder" | "presentation";

function normalizeDownloadName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function iconPath(name: "search" | "download" | "save" | "presentation" | "external") {
  const paths = {
    search: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z",
    download: "M12 3v12m0 0 4-4m-4 4-4-4M5 19h14",
    save: "M5 5h11l3 3v11H5V5zm3 0v5h8M8 19v-6h8v6",
    presentation: "M4 5h16v11H4V5zm4 16 4-5 4 5",
    external: "M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5",
  };
  return paths[name];
}

function Icon({ name }: { name: "search" | "download" | "save" | "presentation" | "external" }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={iconPath(name)} />
    </svg>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 2600);
    return () => window.clearTimeout(timeout);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl" role="status">
      {message}
    </div>
  );
}

function PresentationSummary({ result, onBack }: { result: ReportRunResult | null; onBack: () => void }) {
  if (!result) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">No report has been run yet</h2>
        <p className="mt-2 text-sm text-slate-500">Run a live report before opening the presentation summary.</p>
        <button type="button" onClick={onBack} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Back to Reports</button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm" data-testid="reports-presentation-summary">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Presentation Summary</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{result.report.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{result.report.purpose}</p>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">${Math.round(result.kpis.totalDonations).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Donors</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{result.kpis.donorCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Average Gift</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">${Math.round(result.kpis.averageGift).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Rows</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{result.rows.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-950">Leadership Notes</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <li>Report generated from live OyamaCRM data on {new Date(result.generatedAt).toLocaleString()}.</li>
          <li>Use this summary for board packet review, leadership prep, and donor follow-up planning.</li>
          <li>Exports are placeholders unless a live export action has a backing endpoint or browser CSV generation.</li>
        </ul>
      </div>
    </section>
  );
}

export default function ReportsApp({ initialMode = "home" }: { initialMode?: AppMode }) {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [activeCategory, setActiveCategory] = useState<ReportCategoryId>("all");
  const [search, setSearch] = useState("");
  const [activeReportId, setActiveReportId] = useState(DEFAULT_REPORT_ID);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const activeReport = REPORT_DEFINITIONS.find((report) => report.id === activeReportId) ?? REPORT_DEFINITIONS[0];

  const filteredReports = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return REPORT_DEFINITIONS.filter((report) => {
      const categoryMatches = activeCategory === "all" || report.categoryId === activeCategory;
      const queryMatches = !normalized
        || report.title.toLowerCase().includes(normalized)
        || report.purpose.toLowerCase().includes(normalized)
        || report.quickFilters.some((filter) => filter.toLowerCase().includes(normalized));
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, search]);

  const runReport = useCallback(async (reportId = activeReportId) => {
    const report = REPORT_DEFINITIONS.find((item) => item.id === reportId) ?? activeReport;
    setActiveReportId(report.id);
    setMode("runner");
    setLoading(true);
    setError(null);
    try {
      const nextResult = await runLiveReport(report, filters);
      setResult(nextResult);
      if (report.status === "Coming Soon") {
        setToast(`${report.title} is marked Coming Soon and has no live endpoint yet.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [activeReport, activeReportId, filters]);

  useEffect(() => {
    void runReport(DEFAULT_REPORT_ID);
    // Load the default report once on app open so charts and grid use real data immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveView(reportId = activeReportId) {
    const report = REPORT_DEFINITIONS.find((item) => item.id === reportId) ?? activeReport;
    const view: SavedReportView = {
      id: `view-${Date.now()}`,
      name: `${report.title} view`,
      reportId: report.id,
      createdAt: new Date().toISOString(),
      filters,
    };
    setSavedViews((current) => [view, ...current].slice(0, 8));
    setToast("Saved report view in this browser session.");
  }

  function exportCsv(reportId = activeReportId) {
    const currentRows = result?.report.id === reportId ? result.rows : [];
    if (currentRows.length === 0) {
      setToast("Run the report first. No CSV was exported because no live rows are loaded.");
      return;
    }
    exportRowsToCsv(currentRows, `${normalizeDownloadName(result?.report.title ?? "report")}.csv`);
    setToast("CSV exported from live report rows.");
  }

  function exportPdf() {
    setToast("PDF export placeholder opened. Use browser print until server-side PDF export is wired.");
    window.print();
  }

  function createLetterList(reportId = activeReportId) {
    const report = REPORT_DEFINITIONS.find((item) => item.id === reportId) ?? activeReport;
    if (!report.outputs.includes("Letter List")) {
      setToast("This report does not expose a letter-list output.");
      return;
    }
    setToast("Letter-list handoff placeholder: live persistence route still needed.");
  }

  function saveBuilderDraft(draft: BuilderDraft) {
    const view: SavedReportView = {
      id: `builder-${Date.now()}`,
      name: `${draft.dataSource} custom report`,
      reportId: "custom-builder-starter",
      createdAt: new Date().toISOString(),
      filters,
    };
    setSavedViews((current) => [view, ...current].slice(0, 8));
    setActiveReportId("custom-builder-starter");
    setMode("home");
    setToast("Custom report saved as a guided view. Backend persistence is still partial.");
  }

  function selectReport(reportId: string) {
    setActiveReportId(reportId);
    void runReport(reportId);
  }

  function selectCategory(categoryId: ReportCategoryId) {
    setActiveCategory(categoryId);
    setMode("home");
  }

  return (
    <div className="min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="grid min-h-[calc(100dvh-7rem)] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <ReportCategoryRail
          categories={REPORT_CATEGORIES}
          reports={REPORT_DEFINITIONS}
          savedViews={savedViews}
          activeCategory={activeCategory}
          activeReportId={activeReportId}
          onSelectCategory={selectCategory}
          onSelectReport={selectReport}
          onOpenBuilder={() => setMode("builder")}
        />

        <main className="min-w-0 overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">DonorCRM</Link>
                  <span className="text-xs text-slate-300">/</span>
                  <span className="text-xs font-semibold text-blue-700">Reports</span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">Reports</h1>
                <p className="mt-1 text-sm text-slate-500">Find, run, filter, export, and summarize donor reports using live CRM data.</p>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative min-w-0 sm:w-[22rem]">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reports..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    data-testid="reports-search"
                  />
                </label>
                <button type="button" onClick={() => setMode("presentation")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Icon name="presentation" />
                  Presentation
                </button>
                <button type="button" onClick={() => exportCsv()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Icon name="download" />
                  Export
                </button>
                <button type="button" onClick={() => void runReport(activeReportId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
                  <Icon name="external" />
                  Run Report
                </button>
              </div>
            </div>
          </header>

          <div className="h-[calc(100dvh-13rem)] min-h-[42rem] overflow-y-auto p-4">
            {mode === "home" ? (
              <div className="space-y-4">
                <section className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Prebuilt Reports</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{REPORT_DEFINITIONS.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Working</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{REPORT_DEFINITIONS.filter((report) => report.status === "Working").length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Saved Views</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{savedViews.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Data Source</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">Live CRM APIs</p>
                  </div>
                </section>

                <section className="grid gap-3 xl:grid-cols-3">
                  {filteredReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      selected={report.id === activeReportId}
                      onPreview={(reportId) => selectReport(reportId)}
                      onRun={(reportId) => void runReport(reportId)}
                      onExportCsv={exportCsv}
                      onExportPdf={exportPdf}
                      onCreateLetterList={createLetterList}
                      onSaveView={saveView}
                    />
                  ))}
                </section>
              </div>
            ) : null}

            {mode === "runner" ? (
              <ReportResultsWorkspace
                result={result}
                filters={filters}
                loading={loading}
                error={error}
                onFilterChange={setFilters}
                onRun={() => void runReport(activeReportId)}
                onExportCsv={() => exportCsv(activeReportId)}
                onExportPdf={exportPdf}
                onSaveView={() => saveView(activeReportId)}
                onCreateLetterList={() => createLetterList(activeReportId)}
              />
            ) : null}

            {mode === "builder" ? (
              <ReportBuilderLite onClose={() => setMode("home")} onSave={saveBuilderDraft} />
            ) : null}

            {mode === "presentation" ? (
              <PresentationSummary result={result} onBack={() => setMode(result ? "runner" : "home")} />
            ) : null}
          </div>
        </main>
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
