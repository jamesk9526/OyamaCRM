"use client";

import { useState } from "react";
import { apiFetchResponse } from "@/app/lib/auth-client";

type Props = ({ letterIds: string[]; constituentIds?: never } | { constituentIds: string[]; letterIds?: never }) & { title?: string };

/** The IDs belong to an actual PDF part, never the mutable audience picker. */
export default function MatchingLabelsDownload({ letterIds, constituentIds, title = "Labels in letter order" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startPosition, setStartPosition] = useState(1);
  const [showGuides, setShowGuides] = useState(false);
  const count = (letterIds ?? constituentIds ?? []).length;
  async function download() {
    if (busy || !count) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await apiFetchResponse("/api/letters/labels/avery-5160.pdf", {
        method: "POST", body: JSON.stringify({ letterIds, constituentIds, requireAllRecipients: true, startPosition, showGuides }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error?.message || "Matching labels could not be created.");
      }
      const rendered = Number(response.headers.get("X-Labels-Rendered"));
      if (rendered !== count) throw new Error("The label count does not match this letter part. No download was started; review the recipients.");
      const blob = await response.blob();
      if (!blob.size || !response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("The label export did not return a PDF. Please retry.");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${count}_${new Date().toISOString().slice(0, 10)}.pdf`;
      anchor.hidden = true; document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(objectUrl); }, 30_000);
      setNotice(`${count} labels downloaded in this letter part’s order. Print at Actual size / 100%.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Matching labels could not be created."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 space-y-2 rounded-[2px] border border-[#d1d1d1] bg-white p-3">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || !count} onClick={() => void download()} className="min-h-10 rounded-[2px] border border-[#0f6cbd] px-3 text-xs font-semibold text-[#0f6cbd] hover:bg-[#eff6fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6cbd] disabled:opacity-50">{busy ? "Preparing labels…" : `${title} (${count})`}</button>
      <label className="text-xs text-slate-600">First label position<select disabled={busy} value={startPosition} onChange={(event) => setStartPosition(Number(event.target.value))} className="ml-2 min-h-9 rounded-[2px] border border-[#8a8886] bg-white px-2">{Array.from({ length: 30 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
      <label className="flex min-h-9 items-center gap-2 text-xs text-slate-600"><input type="checkbox" disabled={busy} checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />Alignment guides</label>
    </div>
    <p className="text-xs text-slate-500">Avery 5160 · same recipients and order as this letter PDF part. Unavailable recipients stop the export.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="text-xs text-emerald-800">{notice}</p>}
  </div>;
}
