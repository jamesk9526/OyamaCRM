/** Growth Ideas panel for donor-growth opportunities. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardResearchResponse } from "@/app/components/steward/steward-signals-types";

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
 * GrowthIdeasPanel shows growth opportunities and keeps
 * rationale visible so staff can review before execution.
 */
export default function GrowthIdeasPanel() {
  const [data, setData] = useState<GrowthIdeasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cohortPreviewByIdea, setCohortPreviewByIdea] = useState<Record<string, StewardResearchResponse | null>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /** Maps growth idea IDs to research presets for cohort preview. */
  function ideaPreset(ideaId: string): string {
    if (ideaId === "monthly-giving-candidates") return "monthly-candidates";
    if (ideaId === "lapse-reconnect") return "drifting-cadence";
    if (ideaId === "first-gift-second-gift") return "handwritten-thank-you";
    if (ideaId === "gift-anniversary") return "campaign-responders";
    return "general-opportunity-scan";
  }

  async function loadIdeaPreview(ideaId: string) {
    if (cohortPreviewByIdea[ideaId]) return;
    setPreviewLoadingId(ideaId);
    setError(null);

    try {
      const response = await apiFetch<StewardResearchResponse>("/api/steward-signals/research", {
        method: "POST",
        body: JSON.stringify({
          mode: "research",
          preset: ideaPreset(ideaId),
          limit: 12,
        }),
      });

      setCohortPreviewByIdea((current) => ({
        ...current,
        [ideaId]: response,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load donor cohort preview.");
    } finally {
      setPreviewLoadingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Growth Ideas 2.0</h2>
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
      {notice && <p className="text-xs text-amber-700">{notice}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <SummaryChip label="Average RFM" value={data?.scoringSummary.averageRfm ?? 0} />
        <SummaryChip label="0-30 Propensity" value={data?.scoringSummary.highPropensityWindowCount ?? 0} />
        <SummaryChip label="At-Risk Donors" value={data?.scoringSummary.atRiskCount ?? 0} />
      </div>

      <div className="space-y-2">
        {(data?.ideas ?? []).map((idea) => (
          <article key={idea.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
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
            <p className="text-xs text-gray-500">Suggested Steward Path: {idea.suggestedStewardPath}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextExpanded = expandedId === idea.id ? null : idea.id;
                  setExpandedId(nextExpanded);
                  if (nextExpanded) {
                    void loadIdeaPreview(idea.id);
                  }
                }}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {expandedId === idea.id ? "Hide Donor Cohort" : "View Donor Cohort"}
              </button>
              <button
                type="button"
                onClick={() => setNotice("Create Segment integration is in development. Use Donor Research and Constituents filters as a temporary path.")}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Create Segment
              </button>
              <Link href="/communications" className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                Draft Campaign
              </Link>
              <Link href="/steward-paths" className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                Add to Steward Path
              </Link>
              <Link href="/reports" className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                Create Report
              </Link>
            </div>

            {expandedId === idea.id && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                {previewLoadingId === idea.id ? (
                  <p className="text-xs text-gray-500">Loading donor cohort preview...</p>
                ) : cohortPreviewByIdea[idea.id] ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Donor Cohort Preview</p>
                    <p className="mt-1 text-xs text-gray-600">{cohortPreviewByIdea[idea.id]?.summary}</p>
                    <div className="mt-2 grid gap-1">
                      {(cohortPreviewByIdea[idea.id]?.donors ?? []).slice(0, 6).map((donor) => (
                        <div key={`${idea.id}-${donor.constituentId}`} className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                          {donor.donorName} · Opportunity {donor.opportunityScore} · Lapse {donor.lapseRisk}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">Expected outcome: prioritize higher-confidence donors first and batch review tasks before outreach.</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">No cohort preview is available yet.</p>
                )}
              </div>
            )}
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
