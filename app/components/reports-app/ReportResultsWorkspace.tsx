// Split report runner workspace with filters, KPI cards, Recharts, and a data grid.

"use client";

import { ReportDonutSummary, ReportTrendChart } from "@/app/components/reports-app/ReportCharts";
import ReportStatusBadge from "@/app/components/reports-app/ReportStatusBadge";
import type { ReportFilters, ReportRunResult, ReportTableRow } from "@/app/components/reports-app/report-types";

interface ReportResultsWorkspaceProps {
  result: ReportRunResult | null;
  filters: ReportFilters;
  loading: boolean;
  error: string | null;
  onFilterChange: (next: ReportFilters) => void;
  onRun: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onSaveView: () => void;
  onCreateLetterList: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function FieldLabel({ children }: { children: string }) {
  return <label className="text-[11px] font-semibold text-slate-600">{children}</label>;
}

function TextInput({
  value,
  onChange,
  type = "text",
}: {
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
    />
  );
}

function SelectInput({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
    >
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function FilterPanel({ filters, onFilterChange, disabled }: { filters: ReportFilters; onFilterChange: (next: ReportFilters) => void; disabled?: boolean }) {
  function patch(update: Partial<ReportFilters>) {
    onFilterChange({ ...filters, ...update });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="reports-filter-panel">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400">Guided filters use live API fields only.</span>
      </div>
      <fieldset disabled={disabled} className="grid gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <FieldLabel>Date From</FieldLabel>
          <TextInput type="date" value={filters.dateFrom} onChange={(value) => patch({ dateFrom: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Date To</FieldLabel>
          <TextInput type="date" value={filters.dateTo} onChange={(value) => patch({ dateTo: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Min Amount</FieldLabel>
          <TextInput type="number" value={filters.amountMin} onChange={(value) => patch({ amountMin: Number(value) || 0 })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Max Amount</FieldLabel>
          <TextInput type="number" value={filters.amountMax} onChange={(value) => patch({ amountMax: Number(value) || 0 })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Donor Type</FieldLabel>
          <SelectInput value={filters.donorType} options={["All", "Constituent", "Individual", "Household", "Church", "Organization"]} onChange={(value) => patch({ donorType: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Designation</FieldLabel>
          <SelectInput value={filters.designation} options={["All", "General Fund", "Building Fund", "Missions", "Youth Ministry"]} onChange={(value) => patch({ designation: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Campaign</FieldLabel>
          <SelectInput value={filters.campaign} options={["All", "Annual Fund", "Spring Appeal", "Capital Campaign", "Leadership Gifts"]} onChange={(value) => patch({ campaign: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Payment Type</FieldLabel>
          <SelectInput value={filters.paymentType} options={["All", "ACH", "Cash", "Check", "Credit Card", "Wire"]} onChange={(value) => patch({ paymentType: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Event</FieldLabel>
          <TextInput value={filters.event} onChange={(value) => patch({ event: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Recurring Status</FieldLabel>
          <SelectInput value={filters.recurringStatus} options={["All", "Recurring", "One-time"]} onChange={(value) => patch({ recurringStatus: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Church / Organization</FieldLabel>
          <TextInput value={filters.organization} onChange={(value) => patch({ organization: value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Follow-Up Status</FieldLabel>
          <SelectInput value={filters.followUpStatus} options={["All", "Open", "Completed", "Overdue", "Not Needed"]} onChange={(value) => patch({ followUpStatus: value })} />
        </div>
      </fieldset>
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] text-emerald-700">{hint}</p>
    </div>
  );
}

function ReportDataGrid({ rows }: { rows: ReportTableRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-b-xl bg-white text-sm text-slate-400" data-testid="reports-empty-data">
        No live rows matched the selected report and filters.
      </div>
    );
  }

  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto" data-testid="reports-data-grid">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-semibold uppercase tracking-[0.12em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, index) => (
            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
              {headers.map((header) => (
                <td key={header} className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {typeof row[header] === "number" && /amount|raised|giving|value|goal/i.test(header)
                    ? formatCurrency(Number(row[header]))
                    : String(row[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        <span>Displaying 1 - {Math.min(12, rows.length)} of {rows.length}</span>
        <span>Live CRM data</span>
      </div>
    </div>
  );
}

export default function ReportResultsWorkspace({
  result,
  filters,
  loading,
  error,
  onFilterChange,
  onRun,
  onExportCsv,
  onExportPdf,
  onSaveView,
  onCreateLetterList,
}: ReportResultsWorkspaceProps) {
  const report = result?.report;

  return (
    <div className="space-y-4" data-testid="reports-runner">
      {report ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-950">{report.title}</h1>
              <ReportStatusBadge status={report.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{report.purpose}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSaveView} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Save View</button>
            <button type="button" onClick={onExportCsv} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export CSV</button>
            <button type="button" onClick={onExportPdf} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export PDF</button>
            <button type="button" onClick={onRun} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700" data-testid="reports-run-report">Run Report</button>
          </div>
        </div>
      ) : null}

      <FilterPanel filters={filters} onFilterChange={onFilterChange} disabled={loading} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">Running live report...</div>
      ) : result ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Total Donations" value={formatCurrency(result.kpis.totalDonations)} hint="Filtered total" />
            <KpiCard label="Total Donors" value={result.kpis.donorCount.toLocaleString()} hint="Visible unique records" />
            <KpiCard label="Average Gift" value={formatCurrency(result.kpis.averageGift)} hint="From returned rows" />
            <KpiCard label="Largest Gift" value={formatCurrency(result.kpis.largestGift)} hint="Highest visible value" />
            <KpiCard label="Transactions" value={result.kpis.transactions.toLocaleString()} hint="Rows returned" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.42fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">Giving Trend</h2>
                  <p className="text-xs text-slate-500">Rendered with Recharts from live API response rows.</p>
                </div>
              </div>
              <ReportTrendChart data={result.yearComparison.length > 0 ? result.yearComparison : result.trend} type={result.report.primaryChart} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950">Giving by Designation</h2>
              <p className="mb-3 text-xs text-slate-500">Uses returned designation fields when available.</p>
              {result.designationBreakdown.length > 0 ? (
                <ReportDonutSummary data={result.designationBreakdown} />
              ) : (
                <div className="flex h-[13rem] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                  No designation breakdown returned.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Report Data Grid</h2>
                <p className="text-xs text-slate-500">{result.rows.length.toLocaleString()} live rows returned</p>
              </div>
              <button type="button" onClick={onCreateLetterList} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Create Letter List
              </button>
            </div>
            <ReportDataGrid rows={result.rows} />
          </section>
        </>
      ) : null}
    </div>
  );
}
