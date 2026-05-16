/** Contextual Steward AI side panel for explain/research/draft actions in dashboard workflow. */
"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardResearchResponse } from "@/app/components/steward/steward-signals-types";

interface StewardSignalsAiSidePanelProps {
  analyzedAt?: string | null;
}

/**
 * StewardSignalsAiSidePanel provides a review-first assistant surface for
 * explaining signals, researching donor groups, and launching draft workflows.
 */
export default function StewardSignalsAiSidePanel({ analyzedAt }: StewardSignalsAiSidePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StewardResearchResponse | null>(null);

  async function runAssistantPrompt(nextPrompt?: string) {
    const payloadPrompt = (nextPrompt ?? prompt).trim();
    if (!payloadPrompt) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<StewardResearchResponse>("/api/steward-signals/research", {
        method: "POST",
        body: JSON.stringify({
          mode: "research",
          query: payloadPrompt,
          limit: 8,
        }),
      });
      setPrompt(payloadPrompt);
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Assistant request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Steward AI Panel</p>
        <h3 className="mt-1 text-sm font-semibold text-gray-900">Research and explain this dashboard</h3>
        <p className="mt-1 text-xs text-gray-500">
          {analyzedAt ? `Signal data refreshed ${new Date(analyzedAt).toLocaleString()}` : "Signals are loading."}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Steward Research Mode</label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="Show me donors who gave last spring but not this spring."
          className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void runAssistantPrompt()}
          disabled={loading}
          className="mt-2 w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Ask Steward"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="space-y-2">
        {[
          "Explain this signal trend in plain language.",
          "Which donors need a handwritten note this month?",
          "Compare lapsed risk vs monthly giving potential.",
          "Find donors with rising generosity and low engagement.",
        ].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => void runAssistantPrompt(item)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            {item}
          </button>
        ))}
      </div>

      {result && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assistant Result</p>
          <p className="text-sm text-gray-800">{result.summary}</p>
          <p className="text-xs text-gray-600">Confidence {result.confidence}% · {result.donorCount} donors</p>
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600">
            {result.reasoning}
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Human Review Required</p>
        <p className="text-xs text-amber-700">
          Steward suggests and drafts, but does not send messages, change records, or enroll donors without explicit confirmation.
        </p>
      </div>

      <div className="grid gap-2">
        <Link href="/steward-signals/email-draft-studio" className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-center text-xs font-medium text-blue-700 hover:bg-blue-100">
          Draft Communication
        </Link>
        <Link href="/reports" className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50">
          Create Report
        </Link>
      </div>
    </aside>
  );
}
