/** Hero panel that turns donor signals into clear, ranked priorities for today. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardDashboardFocusResponse, StewardPriorityCard } from "@/app/components/steward/steward-signals-types";

interface StewardTodaysFocusPanelProps {
  onAnalyzedAtChange?: (value: string) => void;
}

/**
 * StewardTodaysFocusPanel loads dashboard focus context and highlights the
 * highest-priority donor recommendation with immediate next-step actions.
 */
export default function StewardTodaysFocusPanel({ onAnalyzedAtChange }: StewardTodaysFocusPanelProps) {
  const [data, setData] = useState<StewardDashboardFocusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"draft" | "task" | null>(null);
  const [expandedPriorityId, setExpandedPriorityId] = useState<string | null>(null);

  async function loadFocus() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<StewardDashboardFocusResponse>("/api/steward-signals/dashboard-focus");
      setData(response);
      onAnalyzedAtChange?.(response.analyzedAt);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard focus.");
    } finally {
      setLoading(false);
    }
  }

  /** Runs a confirm-first opportunity action for today's top priority. */
  async function runTopPriorityAction(kind: "draft" | "task", priority: StewardPriorityCard) {
    const actionLabel = kind === "draft" ? "draft an email" : "create a follow-up task";
    if (!window.confirm(`Do you want to ${actionLabel} for ${priority.donorName}?`)) return;

    setPendingAction(kind);
    setError(null);
    setNotice(null);
    try {
      const endpoint = kind === "draft"
        ? `/api/steward-signals/opportunities/${priority.id}/draft-email`
        : `/api/steward-signals/opportunities/${priority.id}/create-task`;

      const response = await apiFetch<{ message?: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });

      setNotice(response.message ?? "Action completed.");
      await loadFocus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  useEffect(() => {
    void loadFocus();

    const handleRebuild = () => {
      void loadFocus();
    };

    window.addEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    return () => {
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    };
  }, []);

  const topPriority = data?.topPriorities[0] ?? null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Today's Steward Focus</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">Top stewardship decisions for today</h2>
          <p className="mt-1 text-sm text-gray-600">
            {loading
              ? "Analyzing donor signals..."
              : `Scope: ${data?.scope ?? "Donor CRM"} · Last analyzed ${data?.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : "just now"}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadFocus()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh Focus"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-3 text-sm text-green-700">{notice}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(data?.focusLines ?? []).map((line) => (
          <article key={line.id} className="rounded-xl border border-emerald-100 bg-white/90 p-3">
            <p className="text-2xl font-bold text-gray-900">{line.count}</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{line.title}</p>
            <p className="mt-1 text-xs text-gray-500">{line.detail}</p>
          </article>
        ))}
      </div>

      <article className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Today's Top Priority</p>

        {!topPriority ? (
          <p className="mt-2 text-sm text-gray-600">No urgent priorities were found for today.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-gray-900">Reconnect with {topPriority.donorName}</p>
                <p className="text-sm text-gray-700">Why: {topPriority.why}</p>
                <p className="text-sm text-gray-700">Suggested action: {topPriority.suggestedAction}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <p><span className="font-semibold text-gray-700">Confidence:</span> {topPriority.confidence}%</p>
                <p className="mt-1"><span className="font-semibold text-gray-700">Urgency:</span> {topPriority.urgency}</p>
                <p className="mt-1"><span className="font-semibold text-gray-700">Due:</span> {new Date(topPriority.dueDateIso).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/constituents/${topPriority.constituentId}`}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                View Donor
              </Link>
              <button
                type="button"
                onClick={() => void runTopPriorityAction("draft", topPriority)}
                disabled={pendingAction !== null}
                className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {pendingAction === "draft" ? "Drafting..." : "Draft Email"}
              </button>
              <button
                type="button"
                onClick={() => void runTopPriorityAction("task", topPriority)}
                disabled={pendingAction !== null}
                className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                {pendingAction === "task" ? "Creating..." : "Create Task"}
              </button>
              <Link
                href="/automations"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Add to Steward Path
              </Link>
              <button
                type="button"
                onClick={() => setExpandedPriorityId((current) => current === topPriority.id ? null : topPriority.id)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Explain Signal
              </button>
            </div>

            {expandedPriorityId === topPriority.id && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-700">Signal evidence</p>
                <p className="mt-1">{topPriority.evidence}</p>
                <p className="mt-1">Channel recommendation: {topPriority.suggestedChannel}</p>
              </div>
            )}
          </>
        )}
      </article>

      {data && data.topPriorities.length > 1 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">More high-priority decisions</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {data.topPriorities.slice(1, 5).map((priority: StewardPriorityCard) => (
              <article key={priority.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{priority.donorName}</p>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {priority.urgency}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{priority.why}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
