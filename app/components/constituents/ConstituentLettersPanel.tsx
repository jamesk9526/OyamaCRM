/** Constituent profile panel showing generated letters history and quick actions. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ConstituentLetterItem {
  id: string;
  category: string;
  status: string;
  generatedAt: string;
  printedAt?: string | null;
  mailedAt?: string | null;
  emailSentAt?: string | null;
  template?: {
    id: string;
    name: string;
  };
  emailCampaign?: {
    id: string;
  } | null;
}

interface ConstituentLettersPanelProps {
  constituentId: string;
  canGenerate?: boolean;
  disabledReason?: string;
}

/** Fetches and renders one constituent's generated letter timeline summary. */
export default function ConstituentLettersPanel({ constituentId, canGenerate = true, disabledReason = "Letter generation is unavailable for this constituent." }: ConstituentLettersPanelProps) {
  const [letters, setLetters] = useState<ConstituentLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ConstituentLetterItem[]>(`/api/letters/constituents/${constituentId}/generated`);
      setLetters(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load letter history.");
    } finally {
      setLoading(false);
    }
  }, [constituentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Letters & Printables</h2>
          <p className="text-xs text-gray-500 mt-0.5">Mailing and generation history for this contact. Creating a PDF does not record a mailing.</p>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate ? (
            <Link href={`/oyama-letters/generate?constituentId=${constituentId}`} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">Generate Letter</Link>
          ) : (
            <button type="button" disabled title={disabledReason} className="cursor-not-allowed rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">Generate Letter</button>
          )}
          <button onClick={() => void load()} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</div>}

      {!loading && letters.length > 0 ? <p className="mt-3 text-xs text-slate-600">Review prior mailings before repeating outreach. Showing up to 100 recent letter records.</p> : null}
      <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-500">Loading letter history...</p>
        ) : letters.length === 0 ? (
          <p className="text-sm text-gray-500">No letters generated yet for this constituent.</p>
        ) : (
          (showAll ? letters : letters.slice(0, 8)).map((letter) => (
            <div key={letter.id} className="rounded-lg border border-gray-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{letter.template?.name || "Template"}</p>
                <span className="text-xs text-gray-500">{letter.status.replaceAll("_", " ")}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {letter.category.replaceAll("_", " ")} · {new Date(letter.generatedAt).toLocaleDateString()}
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <div><dt className="inline font-medium">Generated: </dt><dd className="inline">{new Date(letter.generatedAt).toLocaleDateString()}</dd></div>
                <div><dt className="inline font-medium">Printed: </dt><dd className="inline">{letter.printedAt ? new Date(letter.printedAt).toLocaleDateString() : "Not recorded"}</dd></div>
                <div><dt className="inline font-medium">Mailed: </dt><dd className="inline">{letter.mailedAt ? new Date(letter.mailedAt).toLocaleDateString() : "Not recorded"}</dd></div>
                {letter.emailSentAt ? <div><dt className="inline font-medium">Email sent: </dt><dd className="inline">{new Date(letter.emailSentAt).toLocaleDateString()}</dd></div> : null}
              </dl>
              {letter.emailCampaign?.id && (
                <Link href={`/communications/${letter.emailCampaign.id}`} className="text-xs text-blue-700 underline mt-1 inline-block">
                  Open email draft
                </Link>
              )}
            </div>
          ))
        )}
      </div>
      {!loading && letters.length > 8 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 min-h-10 text-xs font-semibold text-[var(--crm-accent)] hover:underline">{showAll ? "Show recent eight" : `Show all ${letters.length} loaded letters`}</button> : null}
    </section>
  );
}
