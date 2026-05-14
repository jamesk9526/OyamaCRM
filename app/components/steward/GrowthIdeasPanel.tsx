/** Growth Ideas panel for deterministic donor-growth opportunities. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface GrowthIdea {
  id: string;
  title: string;
  whyItMatters: string;
  estimatedDonorCount: number;
  suggestedMessage: string;
  suggestedChannel: "Email" | "Phone" | "Mail" | "Mixed";
  suggestedActionPlan: string;
  suggestedStewardPath: string;
  confidence: number;
}

interface GrowthIdeasResponse {
  ideas: GrowthIdea[];
  scoringSummary: {
    averageRfm: number;
    highPropensityWindowCount: number;
    atRiskCount: number;
  };
  updatedAt: string;
}

/**
 * GrowthIdeasPanel shows deterministic growth opportunities and keeps
 * rationale visible so staff can review before execution.
 */
export default function GrowthIdeasPanel() {
  const [data, setData] = useState<GrowthIdeasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadIdeas() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<GrowthIdeasResponse>("/api/steward-signals/growth-ideas?limit=6");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load growth ideas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIdeas();

    const handleRebuild = () => {
      void loadIdeas();
    };

    window.addEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    return () => {
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    };
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Growth Ideas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleString()}` : "Loading growth opportunities..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadIdeas()}
          disabled={loading}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <SummaryChip label="Average RFM" value={data?.scoringSummary.averageRfm ?? 0} />
        <SummaryChip label="0-30 Propensity" value={data?.scoringSummary.highPropensityWindowCount ?? 0} />
        <SummaryChip label="At-Risk Donors" value={data?.scoringSummary.atRiskCount ?? 0} />
      </div>

      <div className="space-y-2">
        {(data?.ideas ?? []).map((idea) => (
          <article key={idea.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{idea.title}</p>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700">
                Confidence {idea.confidence}%
              </span>
            </div>

            <p className="text-xs text-gray-600">{idea.whyItMatters}</p>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Estimated donors:</span> {idea.estimatedDonorCount} · <span className="font-semibold">Channel:</span> {idea.suggestedChannel}
            </p>
            <p className="text-xs text-gray-700"><span className="font-semibold">Action plan:</span> {idea.suggestedActionPlan}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">Suggested message:</span> {idea.suggestedMessage}</p>
            <p className="text-xs text-gray-500">Steward Path: {idea.suggestedStewardPath}</p>
          </article>
        ))}

        {!loading && (data?.ideas.length ?? 0) === 0 && (
          <p className="text-xs text-gray-500">No growth ideas are currently available for this organization.</p>
        )}
      </div>
    </section>
  );
}

interface SummaryChipProps {
  label: string;
  value: number;
}

function SummaryChip({ label, value }: SummaryChipProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
