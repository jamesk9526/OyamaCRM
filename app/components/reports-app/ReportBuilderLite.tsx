// Guided custom report builder that starts from live CRM data sources.

"use client";

import { useState } from "react";
import type { BuilderDraft, ReportChartType } from "@/app/components/reports-app/report-types";

interface ReportBuilderLiteProps {
  onClose: () => void;
  onSave: (draft: BuilderDraft) => void;
}

const FIELD_OPTIONS = ["Donor Name", "Amount", "Date", "Payment Type", "Designation", "Campaign", "Follow-Up Status", "Household", "Organization"];
const FILTER_OPTIONS = ["Date Range", "Amount Range", "Donor Type", "Designation", "Campaign", "Payment Type", "Recurring Donor Status", "Giving Capacity", "Donor Tags"];
const CHART_TYPES: Array<{ id: ReportChartType; label: string }> = [
  { id: "line", label: "Line" },
  { id: "bar", label: "Bar" },
  { id: "donut", label: "Donut" },
  { id: "stacked-bar", label: "Stacked Bar" },
  { id: "none", label: "None" },
];

export default function ReportBuilderLite({ onClose, onSave }: ReportBuilderLiteProps) {
  const [draft, setDraft] = useState<BuilderDraft>({
    dataSource: "Donations",
    fields: ["Donor Name", "Amount", "Date", "Designation"],
    filters: ["Date Range", "Amount Range"],
    grouping: "Designation",
    sorting: "Amount desc",
    chartType: "bar",
    exportFormat: "CSV",
  });

  function toggleField(field: string) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.includes(field) ? current.fields.filter((item) => item !== field) : [...current.fields, field],
    }));
  }

  function toggleFilter(filter: string) {
    setDraft((current) => ({
      ...current,
      filters: current.filters.includes(filter) ? current.filters.filter((item) => item !== filter) : [...current.filters, filter],
    }));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="reports-builder-lite">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Report Builder Lite</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Create a saved report without starting from scratch</h2>
          <p className="mt-1 text-sm text-slate-500">Choose a live data source, fields, filters, grouping, sorting, chart type, and export format.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          <button type="button" onClick={() => onSave(draft)} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700" data-testid="reports-builder-save">Save Custom Report</button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="text-xs font-semibold text-slate-700">Data Source</label>
            <select
              value={draft.dataSource}
              onChange={(event) => setDraft((current) => ({ ...current, dataSource: event.target.value }))}
              className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              <option>Donations</option>
              <option>Constituents</option>
              <option>Campaigns</option>
              <option>Events Donations</option>
              <option>Follow-Up Tasks</option>
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="text-xs font-semibold text-slate-700">Grouping</label>
            <select
              value={draft.grouping}
              onChange={(event) => setDraft((current) => ({ ...current, grouping: event.target.value }))}
              className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              <option>Designation</option>
              <option>Campaign</option>
              <option>Payment Type</option>
              <option>Donor Type</option>
              <option>Month</option>
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="text-xs font-semibold text-slate-700">Sorting</label>
            <select
              value={draft.sorting}
              onChange={(event) => setDraft((current) => ({ ...current, sorting: event.target.value }))}
              className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              <option>Amount desc</option>
              <option>Amount asc</option>
              <option>Date desc</option>
              <option>Donor Name asc</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">Fields</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FIELD_OPTIONS.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleField(field)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    draft.fields.includes(field) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">Filters</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => toggleFilter(filter)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    draft.filters.includes(filter) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">Chart Type</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CHART_TYPES.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, chartType: chart.id }))}
                  className={`h-9 rounded-md border text-xs font-semibold ${
                    draft.chartType === chart.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {chart.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">Export Format</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["CSV", "PDF", "Board Summary"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, exportFormat: format }))}
                  className={`h-9 rounded-md border text-xs font-semibold ${
                    draft.exportFormat === format ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
