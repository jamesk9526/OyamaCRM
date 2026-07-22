"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetchResponse } from "@/app/lib/auth-client";

interface LetterPrintRouteProps {
  templateId: string;
  constituentId?: string;
}

function fileNameFromDisposition(value: string | null, fallback: string): string {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1]?.trim() || fallback;
}

/**
 * The print route intentionally displays the same server-rendered PDF used by
 * template previews and generated letters. This prevents browser-print drift.
 */
export default function LetterPrintRoute({ templateId, constituentId }: LetterPrintRouteProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("letter-preview.pdf");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/templates/${encodeURIComponent(templateId)}/sample-pdf?preview=1&inline=1`, {
        method: "POST",
        body: JSON.stringify(constituentId ? { constituentId } : {}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || `Production PDF preview failed (${response.status}).`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Production PDF preview returned an empty file.");
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setFileName(fileNameFromDisposition(response.headers.get("content-disposition"), "letter-preview.pdf"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load the production letter PDF.");
    } finally {
      setLoading(false);
    }
  }, [constituentId, templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  function openForPrinting() {
    if (!pdfUrl) return;
    const opened = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(pdfUrl);
  }

  return (
    <main className="min-h-[100dvh] bg-slate-200 py-6 print:bg-white print:p-0">
      <div className="non-printing mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div>
          <Link href={`/oyama-letters/templates/${encodeURIComponent(templateId)}`} className="font-semibold text-slate-700 hover:text-emerald-700">Back to builder</Link>
          <p className="mt-1 text-xs text-slate-600">Production PDF — the same renderer used for preview, print, and generated letters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{loading ? "Rendering..." : "Refresh"}</button>
          {pdfUrl ? <a href={pdfUrl} download={fileName} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Download PDF</a> : null}
          <button type="button" onClick={openForPrinting} disabled={!pdfUrl} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Print</button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl px-3 print:max-w-none print:p-0">
        {loading ? <div className="flex min-h-[75vh] items-center justify-center rounded-md bg-white text-sm font-semibold text-slate-600 shadow-sm">Rendering production letter PDF...</div> : null}
        {!loading && error ? <div className="rounded-md border border-amber-200 bg-white p-5 text-sm text-amber-800 shadow-sm">{error}</div> : null}
        {!loading && !error && pdfUrl ? (
          <object title="Production letter PDF" data={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`} type="application/pdf" className="min-h-[82vh] w-full rounded-md border border-slate-300 bg-white shadow-sm print:min-h-screen print:border-0 print:shadow-none">
            <p className="p-5 text-sm text-slate-700">This browser cannot display the PDF inline. Use Download PDF or Print above.</p>
          </object>
        ) : null}
      </div>
    </main>
  );
}
