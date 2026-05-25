/** ReportsCommandBar renders the top ribbon for report scope, filters, and export actions. */
"use client";

import ReportsModuleToolbar, {
  type ReportsToolId,
  type ReportsWorkspaceModule,
} from "@/app/components/reports/ReportsModuleToolbar";

interface ReportsCommandBarProps {
  activeModule: ReportsWorkspaceModule;
  activeTool: ReportsToolId;
  year: number;
  yearOptions: number[];
  allYears: boolean;
  includeGrants: boolean;
  recordFilterText: string;
  minValueFilter: number;
  campaignStatusFilter: "all" | "active" | "inactive";
  fromDate: string;
  toDate: string;
  freshnessText?: string;
  lastRefreshText: string;
  onModuleChange: (moduleId: ReportsWorkspaceModule) => void;
  onToolChange: (toolId: ReportsToolId) => void;
  onYearChange: (year: number) => void;
  onAllYearsChange: (value: boolean) => void;
  onToggleGrants: () => void;
  onFilterTextChange: (value: string) => void;
  onMinValueChange: (value: number) => void;
  onCampaignStatusChange: (value: "all" | "active" | "inactive") => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onExport: () => void;
  onServerExport: () => void;
  onPrint: () => void;
}

function RibbonIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-cyan-200 bg-white text-cyan-700 shadow-sm">
      {children}
    </span>
  );
}

/** Top-of-page command ribbon for OShareview report navigation and filter actions. */
export default function ReportsCommandBar({
  activeModule,
  activeTool,
  year,
  yearOptions,
  allYears,
  includeGrants,
  recordFilterText,
  minValueFilter,
  campaignStatusFilter,
  fromDate,
  toDate,
  freshnessText,
  lastRefreshText,
  onModuleChange,
  onToolChange,
  onYearChange,
  onAllYearsChange,
  onToggleGrants,
  onFilterTextChange,
  onMinValueChange,
  onCampaignStatusChange,
  onFromDateChange,
  onToDateChange,
  onExport,
  onServerExport,
  onPrint,
}: ReportsCommandBarProps) {
  const isAdminWorkspace = activeModule === "admin";

  return (
    <section className="overflow-hidden rounded-md border border-cyan-200 bg-[linear-gradient(180deg,#f0f9ff_0%,#ffffff_52%,#f8fafc_100%)] shadow-sm">
      <div className="border-b border-cyan-100 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-2 rounded-sm border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Reports Control Ribbon
            </div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Reports &amp; Analytics</h2>
            <p className="mt-1 text-sm text-slate-600">OyamaREPORTIT CRM for donor, events, compassion, and OGentic reporting workflows</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {freshnessText ? <span>{freshnessText}</span> : null}
              <span>Live refresh {lastRefreshText}</span>
              {isAdminWorkspace ? <span className="font-medium text-cyan-700">Administrative scope active</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[420px] lg:max-w-[520px] lg:flex-1">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
              </svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={onServerExport}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-cyan-200 bg-white px-4 py-3 text-sm font-semibold text-cyan-800 transition-colors hover:bg-cyan-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
              </svg>
              Server CSV
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V4h12v5M6 18h12v2H6zm-1-9h14a2 2 0 0 1 2 2v4H3v-4a2 2 0 0 1 2-2Z" />
              </svg>
              PDF Packet
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-3 py-3 sm:px-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-cyan-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <RibbonIcon>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </RibbonIcon>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Reporting Scope</p>
              <p className="text-xs text-slate-500">Switch modules and report tools without burying the controls in the side rail.</p>
            </div>
          </div>
          <ReportsModuleToolbar
            activeModule={activeModule}
            activeTool={activeTool}
            onModuleChange={onModuleChange}
            onToolChange={onToolChange}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-white/90 p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <RibbonIcon>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </RibbonIcon>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Report Filters</p>
              <p className="text-xs text-slate-500">Year, text filters, campaign status, and admin date ranges are all available in the top ribbon.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Report Year</span>
              <select
                value={year}
                onChange={(event) => onYearChange(Number.parseInt(event.target.value, 10))}
                disabled={allYears}
                className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Search Records</span>
              <input
                value={recordFilterText}
                onChange={(event) => onFilterTextChange(event.target.value)}
                placeholder="Filter by name, status, type..."
                className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Minimum Value</span>
              <input
                type="number"
                min={0}
                value={Number.isFinite(minValueFilter) ? minValueFilter : 0}
                onChange={(event) => onMinValueChange(Math.max(0, Number(event.target.value || 0)))}
                placeholder="0"
                className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Campaign Status</span>
              <select
                value={campaignStatusFilter}
                onChange={(event) => onCampaignStatusChange(event.target.value as "all" | "active" | "inactive")}
                className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All campaigns</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>

            {isAdminWorkspace ? (
              <>
                <label className="space-y-1 text-xs text-slate-600">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">From Date</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => onFromDateChange(event.target.value)}
                    className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  <span className="font-semibold uppercase tracking-wide text-slate-500">To Date</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => onToDateChange(event.target.value)}
                    className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </label>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-500 sm:col-span-2 xl:col-span-2">
                Administrative date-window and future designation-specific report lenses live here when the Admin scope is active.
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={allYears}
                onChange={(event) => onAllYearsChange(event.target.checked)}
                className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              Include all years
            </label>

            <button
              type="button"
              onClick={onToggleGrants}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium transition-colors ${
                includeGrants
                  ? "border-emerald-300 bg-white text-emerald-700"
                  : "border-emerald-200 bg-transparent text-emerald-900 hover:bg-white/70"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Incl. Grants
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
