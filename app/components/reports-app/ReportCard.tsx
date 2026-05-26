// Searchable report card with quick actions for the Reports home.

"use client";

import ReportStatusBadge from "@/app/components/reports-app/ReportStatusBadge";
import type { ReportDefinition } from "@/app/components/reports-app/report-types";

interface ReportCardProps {
  report: ReportDefinition;
  selected: boolean;
  onPreview: (reportId: string) => void;
  onRun: (reportId: string) => void;
  onExportCsv: (reportId: string) => void;
  onExportPdf: (reportId: string) => void;
  onCreateLetterList: (reportId: string) => void;
  onSaveView: (reportId: string) => void;
}

function CardIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19V5m0 14h14M9 15l3-4 3 2 4-6" />
      </svg>
    </span>
  );
}

function SmallAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      }`}
    >
      {label}
    </button>
  );
}

export default function ReportCard({
  report,
  selected,
  onPreview,
  onRun,
  onExportCsv,
  onExportPdf,
  onCreateLetterList,
  onSaveView,
}: ReportCardProps) {
  const runnable = report.status !== "Coming Soon";
  return (
    <article
      className={`flex min-h-[15rem] flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:border-blue-200 ${
        selected ? "border-blue-300 shadow-[inset_3px_0_0_#2563eb]" : "border-slate-200"
      }`}
      data-testid="report-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CardIcon />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">{report.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{report.purpose}</p>
          </div>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Source</dt>
          <dd className="mt-1 text-slate-700">{report.sourceModule}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Last Run</dt>
          <dd className="mt-1 text-slate-700">{report.lastRun}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {report.outputs.map((output) => (
          <span key={output} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {output}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onRun(report.id)}
            disabled={!runnable}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
              runnable
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            Run Report
          </button>
          <SmallAction label="Preview" onClick={() => onPreview(report.id)} disabled={!runnable} />
          <SmallAction label="Export CSV" onClick={() => onExportCsv(report.id)} disabled={!runnable} />
          <SmallAction label="Export PDF" onClick={() => onExportPdf(report.id)} disabled={!runnable} />
          <SmallAction label="Create Letter List" onClick={() => onCreateLetterList(report.id)} disabled={!report.outputs.includes("Letter List")} />
          <SmallAction label="Save View" onClick={() => onSaveView(report.id)} disabled={!runnable} />
        </div>
      </div>
    </article>
  );
}
