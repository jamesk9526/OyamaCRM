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
}

/** Fetches and renders one constituent's generated letter timeline summary. */
export default function ConstituentLettersPanel({ constituentId }: ConstituentLettersPanelProps) {
  const [letters, setLetters] = useState<ConstituentLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
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
          <p className="text-xs text-gray-500 mt-0.5">Generated communication history for this constituent.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/letters-printables/generate?constituentId=${constituentId}`}
            className="px-3 py-1.5 text-xs rounded-lg text-white bg-green-600 hover:bg-green-700"
          >
            Generate Letter
          </Link>
          <button onClick={() => void load()} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</div>}

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-500">Loading letter history...</p>
        ) : letters.length === 0 ? (
          <p className="text-sm text-gray-500">No letters generated yet for this constituent.</p>
        ) : (
          letters.slice(0, 8).map((letter) => (
            <div key={letter.id} className="rounded-lg border border-gray-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{letter.template?.name || "Template"}</p>
                <span className="text-xs text-gray-500">{letter.status.replaceAll("_", " ")}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {letter.category.replaceAll("_", " ")} · {new Date(letter.generatedAt).toLocaleDateString()}
              </p>
              {letter.emailCampaign?.id && (
                <Link href={`/communications/${letter.emailCampaign.id}`} className="text-xs text-blue-700 underline mt-1 inline-block">
                  Open email draft
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
