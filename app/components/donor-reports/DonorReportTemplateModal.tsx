// DonorReportTemplateModal hosts donor report template selection and report execution in one workspace modal.
"use client";

import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import {
  DONOR_REPORT_CATEGORIES,
  type DonorReportCategory,
  type DonorReportDefinition,
} from "@/app/components/donor-reports/donor-report-catalog";

type CategoryFilter = "All" | DonorReportCategory;
type ReportScopeFilter = "YEAR" | "ALL_YEARS";
type ReportDateBasis = "calendar" | "fiscal";
type RunState = "idle" | "loading" | "done" | "error";

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

interface DonorReportTemplateModalProps {
  onClose: () => void;
  filteredReports: DonorReportDefinition[];
  selectedReport: DonorReportDefinition;
  query: string;
  category: CategoryFilter;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onSelectReport: (report: DonorReportDefinition) => void;
  runYear: number;
  onRunYearChange: (value: number) => void;
  runScope: ReportScopeFilter;
  onRunScopeChange: (value: ReportScopeFilter) => void;
  runDateBasis: ReportDateBasis;
  onRunDateBasisChange: (value: ReportDateBasis) => void;
  runFromDate: string;
  onRunFromDateChange: (value: string) => void;
  runToDate: string;
  onRunToDateChange: (value: string) => void;
  runLimit: ReportLimit;
  onRunLimitChange: (value: ReportLimit) => void;
  runState: RunState;
  hasEndpoint: boolean;
  runError: string | null;
  onRunReport: () => void;
}

export default function DonorReportTemplateModal({
  onClose,
  filteredReports,
  selectedReport,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onSelectReport,
  runYear,
  onRunYearChange,
  runScope,
  onRunScopeChange,
  runDateBasis,
  onRunDateBasisChange,
  runFromDate,
  onRunFromDateChange,
  runToDate,
  onRunToDateChange,
  runLimit,
  onRunLimitChange,
  runState,
  hasEndpoint,
  runError,
  onRunReport,
}: DonorReportTemplateModalProps) {
  return (
    <WorkspaceSetupModal
      title="Run Donor Report"
      subtitle="Choose a donor report template, tune the live run settings, and launch the report from this workspace modal."
      checklist={[
        "1. Search or filter templates",
        "2. Select the donor report you want",
        "3. Tune scope, basis, dates, and rows",
        "4. Run the report",
      ]}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search templates</span>
                <input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Search reports, inputs, or outcomes..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</span>
                <select
                  value={category}
                  onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                >
                  <option value="All">All categories</option>
                  {DONOR_REPORT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              {filteredReports.map((report) => {
                const selected = selectedReport.id === report.id;
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => onSelectReport(report)}
                    className={`group flex min-h-[164px] flex-col rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-sm ${
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
              })}
            </div>

            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No donor reports match those filters.
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected Template</p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">{selectedReport.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedReport.description}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Best Used For</p>
              <p className="mt-1 text-sm text-slate-700">{selectedReport.recommendedUse}</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Run Settings</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Year</span>
                  <input
                    type="number"
                    min={2015}
                    max={new Date().getFullYear() + 1}
                    value={runYear}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10);
                      if (Number.isFinite(y)) onRunYearChange(y);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rows</span>
                  <select
                    value={runLimit}
                    onChange={(e) => onRunLimitChange(Number(e.target.value) as ReportLimit)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  >
                    {REPORT_LIMIT_OPTIONS.map((limitOption) => (
                      <option key={limitOption} value={limitOption}>
                        {limitOption === 5000 ? "All available" : limitOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope</span>
                  <select
                    value={runScope}
                    onChange={(e) => onRunScopeChange(e.target.value as ReportScopeFilter)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  >
                    <option value="YEAR">Selected year</option>
                    <option value="ALL_YEARS">All years</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date basis</span>
                  <select
                    value={runDateBasis}
                    onChange={(e) => onRunDateBasisChange(e.target.value as ReportDateBasis)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  >
                    <option value="calendar">Calendar</option>
                    <option value="fiscal">Fiscal</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</span>
                  <input
                    type="date"
                    value={runFromDate}
                    onChange={(e) => onRunFromDateChange(e.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</span>
                  <input
                    type="date"
                    value={runToDate}
                    onChange={(e) => onRunToDateChange(e.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-400"
                  />
                </label>
              </div>

              {runError ? <p className="mt-3 text-xs font-medium text-rose-600">{runError}</p> : null}

              <button
                type="button"
                disabled={!hasEndpoint || runState === "loading"}
                onClick={onRunReport}
                className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  hasEndpoint && runState !== "loading"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                {runState === "loading" ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running report
                  </>
                ) : "Run Report"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceSetupModal>
  );
}
