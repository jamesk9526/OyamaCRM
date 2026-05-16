/** Daily Steward Thought card with one-per-day persistence and admin refresh support. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface DailyThoughtResponse {
  thought: {
    title: string;
    message: string;
    reason: string;
    sourceType: "ai";
  };
  dateKey: string;
  generatedAt: string;
  context: {
    firstTimeDonorsThisMonth: number;
    thankYousNeeded: number;
    atRiskCount: number;
    monthlyGivingCandidates: number;
    highOpportunityCount: number;
  };
  canRegenerate: boolean;
  aiError?: string;
}

/**
 * DailyStewardThoughtCard surfaces one actionable thought per day and keeps
 * regeneration explicit and permission-aware.
 */
export default function DailyStewardThoughtCard() {
  const [data, setData] = useState<DailyThoughtResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function loadThought() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<DailyThoughtResponse>("/api/steward-signals/daily-thought");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Daily Steward Thought.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThought();
  }, []);

  async function regenerateThought() {
    if (!data?.canRegenerate) return;
    if (!window.confirm("Regenerate today's Steward Thought now?")) return;

    setRegenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<DailyThoughtResponse>("/api/steward-signals/daily-thought/regenerate", {
        method: "POST",
      });
      setData(response);
      setNotice("Daily Steward Thought regenerated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate Daily Steward Thought.");
    } finally {
      setRegenerating(false);
    }
  }

  function looksLeakedThought(value: string): boolean {
    const normalized = String(value || "").toLowerCase();
    return [
      "key constraints",
      "signal context",
      "system prompt",
      "key elements",
      "firsttimedonorsthismonth",
      "thankyousneeded",
      "atriskcount",
      "monthlygivingcandidates",
      "<think>",
      "</think>",
    ].some((marker) => normalized.includes(marker));
  }

  const hasLeakedContent = Boolean(
    data && (
      looksLeakedThought(data.thought.title)
      || looksLeakedThought(data.thought.message)
      || looksLeakedThought(data.thought.reason)
    )
  );

  const displayTitle = hasLeakedContent
    ? "Daily Steward Thought Unavailable"
    : (loading ? "Loading..." : data?.thought.title || "Today's Steward Thought");

  const displayMessage = hasLeakedContent
    ? "Steward AI returned internal prompt text instead of a final thought. Click Refresh Thought to request a clean response."
    : (loading ? "Preparing today's guidance..." : data?.thought.message);

  const displayReason = hasLeakedContent
    ? "Awaiting a valid AI-generated thought."
    : (data?.thought.reason || "Signal evidence is loading.");

  const sourceBadge = "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Daily Steward Thought</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.generatedAt ? `Generated ${new Date(data.generatedAt).toLocaleString()}` : "Loading today's thought..."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${sourceBadge}`}>
            AI Generated
          </span>
          {data?.canRegenerate && (
            <button
              type="button"
              onClick={() => void regenerateThought()}
              disabled={regenerating}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              {regenerating ? "Regenerating..." : "Refresh Thought"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {hasLeakedContent && (
        <p className="text-xs text-amber-700">
          Internal AI reasoning text was blocked from display to keep this card donor-safe.
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-semibold text-gray-900">
          {displayTitle}
        </p>
        <p className="text-sm text-gray-700 mt-2 leading-relaxed">
          {displayMessage}
        </p>
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Why this thought?</p>
        <p className="text-xs text-green-700 mt-1">{displayReason}</p>
      </div>

      <p className="text-[11px] text-gray-500">
        In development: direct "Explain" and "Save note" actions from this card will be connected to the Steward side panel and reporting flow.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-[11px]">
        <Metric label="First-Time This Month" value={data?.context.firstTimeDonorsThisMonth} />
        <Metric label="Thank-Yous Needed" value={data?.context.thankYousNeeded} />
        <Metric label="At-Risk" value={data?.context.atRiskCount} />
        <Metric label="Monthly Candidates" value={data?.context.monthlyGivingCandidates} />
        <Metric label="High Opportunity" value={data?.context.highOpportunityCount} />
      </div>

      {data?.aiError && (
        <p className="text-[11px] text-amber-700">AI note: {data.aiError}</p>
      )}
    </article>
  );
}

interface MetricProps {
  label: string;
  value: number | undefined;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
      <p className="text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value ?? 0}</p>
    </div>
  );
}
