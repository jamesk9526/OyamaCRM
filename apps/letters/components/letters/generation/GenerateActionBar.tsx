/** Focused command bar for the OyamaLetters generation workspace. */
"use client";

import Link from "next/link";
import type { GenerationStatus } from "./letters-generation-types";

interface GenerateActionBarProps {
  title: string;
  subtitle: string;
  status: GenerationStatus;
  primaryLabel: string;
  canGeneratePdf: boolean;
  canDownloadPdf: boolean;
  canPrintPdf: boolean;
  working: boolean;
  isBatch: boolean;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onDownloadPdf: () => void;
  onPrintPdf: () => void;
  onSaveDraft: () => void;
  onSaveToRecord: () => void;
  onCreateTask: () => void;
  onMarkPrinted: () => void;
}

/** Renders concise icon-style document production actions. */
export default function GenerateActionBar({
  title,
  subtitle,
  status,
  primaryLabel,
  canGeneratePdf,
  canDownloadPdf,
  canPrintPdf,
  working,
  isBatch,
  onPreview,
  onGeneratePdf,
  onDownloadPdf,
  onPrintPdf,
  onSaveDraft,
  onSaveToRecord,
  onCreateTask,
  onMarkPrinted,
}: GenerateActionBarProps) {
  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white/92 px-3 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mb-3">
        <Link href="/oyama-letters" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950">
          <span aria-hidden="true">‹</span>
          Back to Letters &amp; Printables
        </Link>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-[260px] flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 shadow-inner">
            <span className="text-xl font-bold">≡</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-normal text-slate-950">{title}</h1>
            <p className="truncate text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          <ToolbarButton label="Preview" icon="◉" onClick={onPreview} disabled={working} />
          <ToolbarButton label={primaryLabel} icon="▯" onClick={onGeneratePdf} disabled={working || !canGeneratePdf} primary />
          <ToolbarButton label={isBatch ? "Download ZIP" : "Download"} icon="⇩" onClick={onDownloadPdf} disabled={!canDownloadPdf || working} />
          <ToolbarButton label="Print" icon="▣" onClick={onPrintPdf} disabled={!canPrintPdf || working} />
          <ToolbarButton label="Save Draft" icon="◇" onClick={onSaveDraft} disabled={working} />
          <Link href="/oyama-letters/templates" className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Save Template
          </Link>
          {isBatch ? <ToolbarButton label="Mark Printed" icon="✓" onClick={onMarkPrinted} disabled={!canPrintPdf || working} /> : null}
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="More actions">⋮</button>
        </div>

        <div className="ml-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <span className="flex items-center gap-2 font-semibold text-slate-700"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500 text-[10px] text-emerald-600">✓</span>All changes saved</span>
          <span className="h-4 w-px bg-slate-200" />
          <StatusPill status={status} />
        </div>
      </div>
    </header>
  );
}

function ToolbarButton({ label, icon, onClick, disabled = false, primary = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
        primary ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
      title={label}
    >
      <span className="text-[13px] text-current opacity-75">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: GenerationStatus }) {
  const tone = status === "Generated" || status === "Downloaded" || status === "Printed" || status === "Saved to Record"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Failed" || status === "Missing Merge Fields"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
