/** Center preview canvas for merged HTML, page view, and generated PDF blobs. */
"use client";

import type { BatchResult, PdfPreviewState, PreviewMode, SinglePreview } from "./letters-generation-types";

interface DocumentPreviewPanelProps {
  mode: PreviewMode;
  preview: SinglePreview | null;
  pdfPreview: PdfPreviewState | null;
  batchPreview: BatchResult | null;
  recipientIndex: number;
  recipientCount: number;
  selectedRecipientName: string;
  onModeChange: (mode: PreviewMode) => void;
  onPreviousRecipient: () => void;
  onNextRecipient: () => void;
}

/** Renders the document canvas and true browser PDF preview frame. */
export default function DocumentPreviewPanel({
  mode,
  preview,
  pdfPreview,
  batchPreview,
  recipientIndex,
  recipientCount,
  selectedRecipientName,
  onModeChange,
  onPreviousRecipient,
  onNextRecipient,
}: DocumentPreviewPanelProps) {
  const hasBatchRecipients = recipientCount > 1;

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-100 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          <ModeButton active={mode === "html"} label="Preview Data" onClick={() => onModeChange("html")} />
          <ModeButton active={mode === "pdf"} label="PDF Preview" onClick={() => onModeChange("pdf")} />
          <ModeButton active={mode === "page"} label="Page View" onClick={() => onModeChange("page")} />
        </div>
        {hasBatchRecipients ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <button type="button" onClick={onPreviousRecipient} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">Previous Recipient</button>
            <span>Recipient {recipientIndex + 1} of {recipientCount}</span>
            <button type="button" onClick={onNextRecipient} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">Next Recipient</button>
          </div>
        ) : null}
      </div>

      <div className="min-h-[520px] flex-1 overflow-auto p-4">
        {mode === "pdf" ? (
          <PdfCanvas pdfPreview={pdfPreview} />
        ) : mode === "page" ? (
          <PageCanvas preview={preview} selectedRecipientName={selectedRecipientName} />
        ) : (
          <HtmlCanvas preview={preview} batchPreview={batchPreview} selectedRecipientName={selectedRecipientName} />
        )}
      </div>
    </section>
  );
}

function HtmlCanvas({ preview, batchPreview, selectedRecipientName }: { preview: SinglePreview | null; batchPreview: BatchResult | null; selectedRecipientName: string }) {
  if (!preview) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center">
        <div className="max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h3 className="text-sm font-semibold text-slate-900">No records selected.</h3>
          <p className="mt-2 text-sm text-slate-500">Choose a constituent, saved list, report result, campaign, date range, or filtered segment to generate this document.</p>
          {batchPreview ? <p className="mt-2 text-xs text-slate-500">Batch dry-run found {batchPreview.eligible} eligible records.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[780px]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Merged HTML Preview {selectedRecipientName ? `for ${selectedRecipientName}` : ""}</p>
      <div
        className="min-h-[720px] rounded-sm border border-slate-200 bg-white px-12 py-10 text-[14px] leading-7 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.16)] [&_.merge-field-missing]:rounded [&_.merge-field-missing]:bg-amber-100 [&_.merge-field-missing]:px-1 [&_.merge-field-missing]:font-semibold [&_.merge-field-missing]:text-amber-800 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2"
        dangerouslySetInnerHTML={{ __html: preview.mergedPrintBody }}
      />
    </div>
  );
}

function PageCanvas({ preview, selectedRecipientName }: { preview: SinglePreview | null; selectedRecipientName: string }) {
  if (!preview) return <HtmlCanvas preview={null} batchPreview={null} selectedRecipientName={selectedRecipientName} />;
  return (
    <div className="mx-auto w-full max-w-[850px]">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>Letter page · {selectedRecipientName || "Selected recipient"}</span>
        <span>Fit width</span>
      </div>
      <div className="mx-auto aspect-[8.5/11] max-h-[900px] w-full max-w-[720px] overflow-hidden rounded-sm bg-white p-[7%] shadow-[0_20px_55px_rgba(15,23,42,0.22)]">
        <div className="h-full overflow-hidden text-[clamp(10px,1.2vw,14px)] leading-6 text-slate-900 [&_.merge-field-missing]:rounded [&_.merge-field-missing]:bg-amber-100 [&_.merge-field-missing]:px-1 [&_.merge-field-missing]:font-semibold [&_.merge-field-missing]:text-amber-800" dangerouslySetInnerHTML={{ __html: preview.mergedPrintBody }} />
      </div>
    </div>
  );
}

function PdfCanvas({ pdfPreview }: { pdfPreview: PdfPreviewState | null }) {
  if (!pdfPreview) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center">
        <div className="max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h3 className="text-sm font-semibold text-slate-900">No generated PDF yet.</h3>
          <p className="mt-2 text-sm text-slate-500">Generate PDF to render the actual PDF blob in this browser preview.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[760px] max-w-[980px] flex-col rounded-lg border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold">{pdfPreview.filename}</span>
        <span>{pdfPreview.letterIds.length} generated record{pdfPreview.letterIds.length === 1 ? "" : "s"}</span>
      </div>
      <iframe title="Generated PDF preview" src={pdfPreview.url} className="min-h-0 flex-1 rounded-b-lg" />
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded px-2.5 py-1 text-xs font-semibold ${active ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
      {label}
    </button>
  );
}
