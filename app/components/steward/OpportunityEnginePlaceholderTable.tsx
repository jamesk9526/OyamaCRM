/** Opportunity Engine table for live donor action recommendations. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardOpportunityRow } from "@/app/components/steward/steward-signals-types";

type StewardAiRuntimeStatus =
  | "disabled"
  | "not_configured"
  | "connecting"
  | "connected"
  | "thinking"
  | "running_task"
  | "error"
  | "fallback";

interface StewardAiRuntimeState {
  enabled: boolean;
  status: StewardAiRuntimeStatus;
  model: string;
}

type OpportunityAction = "create-task" | "draft-email" | "dismiss";

/**
 * OpportunityEnginePlaceholderTable renders a live queue and uses explicit
 * confirm-first action buttons for task creation, email drafting, and dismissal.
 */
export default function OpportunityEnginePlaceholderTable() {
  const [rows, setRows] = useState<StewardOpportunityRow[]>([]);
  const [runtime, setRuntime] = useState<StewardAiRuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [explainedId, setExplainedId] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const [runtimeState, data] = await Promise.all([
        apiFetch<StewardAiRuntimeState>("/api/steward-ai/status"),
        apiFetch<StewardOpportunityRow[]>("/api/steward-signals/opportunities?limit=60"),
      ]);

      setRuntime(runtimeState);
      setRows(data);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load opportunities.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();

    const handleRebuild = () => {
      void loadRows();
    };

    window.addEventListener("steward-signals:analysis-rebuilt", handleRebuild);

    return () => {
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    };
  }, []);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading opportunity queue...";
    if (rows.length === 0) return "No opportunities found. Signals may be up to date.";
    return null;
  }, [loading, rows.length]);

  const aiEnhanced = runtime?.status === "connected" || runtime?.status === "thinking" || runtime?.status === "running_task";
  const modeLabel = aiEnhanced
    ? `Enhanced by Steward AI${runtime?.model ? ` · ${runtime.model}` : ""}`
    : "Steward AI runtime unavailable. Opportunity data is paused.";
  const modeTone = aiEnhanced
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";

  /** Performs a confirm-first API mutation and refreshes the queue on success. */
  async function runAction(row: StewardOpportunityRow, action: OpportunityAction) {
    const promptByAction: Record<OpportunityAction, string> = {
      "create-task": `Create follow-up task for ${row.donorName}?`,
      "draft-email": `Create stewardship draft email for ${row.donorName}?`,
      dismiss: `Dismiss this opportunity for ${row.donorName}?`,
    };

    if (!window.confirm(promptByAction[action])) return;

    setPendingActionId(`${row.id}:${action}`);
    setNotice(null);
    setError(null);

    try {
      const response = await apiFetch<{ message?: string }>(`/api/steward-signals/opportunities/${row.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });

      setNotice(response.message ?? "Action completed.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPendingActionId(null);
    }
  }

  const actionButtonClass = "px-2 py-1 rounded border text-xs font-medium transition-colors";

  const urgencyTone = (priority: StewardOpportunityRow["priority"]): string => {
    if (priority === "High") return "border-red-200 bg-red-50 text-red-700";
    if (priority === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-200 bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-2">
      {(error || notice) && (
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>
      )}

      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${modeTone}`}>
        {modeLabel}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {lastRefreshedAt ? `Updated ${new Date(lastRefreshedAt).toLocaleString()}` : "Loading queue..."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        <button
          type="button"
          onClick={() => setViewMode("cards")}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${viewMode === "cards" ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Dashboard Cards
        </button>
        <button
          type="button"
          onClick={() => setViewMode("table")}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${viewMode === "table" ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Data Table
        </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{row.donorName}</p>
                  <p className="text-xs text-gray-500">{row.opportunityType}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${urgencyTone(row.priority)}`}>
                  {row.priority}
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Why Steward found this</p>
              <p className="mt-1 text-sm text-gray-700">{row.reason}</p>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested action</p>
              <p className="mt-1 text-sm text-gray-700">{row.suggestedAction}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <p><span className="font-semibold text-gray-700">Channel:</span> {row.channel}</p>
                <p><span className="font-semibold text-gray-700">Owner:</span> {row.ownerName}</p>
                <p><span className="font-semibold text-gray-700">Due:</span> {new Date(row.dueDateIso).toLocaleDateString()}</p>
                <p><span className="font-semibold text-gray-700">Confidence:</span> {row.confidence}%</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/constituents/${row.constituentId}`}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Donor
                </Link>
                <button
                  type="button"
                  onClick={() => runAction(row, "draft-email")}
                  disabled={pendingActionId !== null}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {pendingActionId === `${row.id}:draft-email` ? "Drafting..." : "Draft Email"}
                </button>
                <button
                  type="button"
                  onClick={() => runAction(row, "create-task")}
                  disabled={pendingActionId !== null}
                  className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                >
                  {pendingActionId === `${row.id}:create-task` ? "Creating..." : "Create Task"}
                </button>
                <Link
                  href="/steward-paths"
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Add to Steward Path
                </Link>
                <button
                  type="button"
                  onClick={() => setExplainedId((current) => current === row.id ? null : row.id)}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Explain
                </button>
                <button
                  type="button"
                  onClick={() => runAction(row, "dismiss")}
                  disabled={pendingActionId !== null}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                >
                  {pendingActionId === `${row.id}:dismiss` ? "Dismissing..." : "Dismiss"}
                </button>
              </div>

              {explainedId === row.id && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">Signal confidence detail</p>
                  <p className="mt-1">{row.confidenceReason}</p>
                  <p className="mt-1">Status: {row.status}</p>
                </div>
              )}
            </article>
          ))}

          {emptyMessage && (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 lg:col-span-2">
              {emptyMessage}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Priority", "Donor", "Opportunity", "Reason", "Suggested Action", "Channel", "Due", "Owner", "Status", "Confidence", "Actions"].map((header) => (
                  <th key={header} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.priority === "High"
                          ? "bg-red-50 text-red-700"
                          : row.priority === "Medium"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{row.donorName}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.opportunityType}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[260px]">{row.reason}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[300px]">{row.suggestedAction}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.channel}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(row.dueDateIso).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.ownerName}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.confidence}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <button
                        onClick={() => runAction(row, "create-task")}
                        disabled={pendingActionId !== null}
                        className={`${actionButtonClass} border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-60`}
                      >
                        {pendingActionId === `${row.id}:create-task` ? "Creating..." : "Create Task"}
                      </button>
                      <button
                        onClick={() => runAction(row, "draft-email")}
                        disabled={pendingActionId !== null}
                        className={`${actionButtonClass} border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60`}
                      >
                        {pendingActionId === `${row.id}:draft-email` ? "Drafting..." : "Draft Email"}
                      </button>
                      <button
                        onClick={() => runAction(row, "dismiss")}
                        disabled={pendingActionId !== null}
                        className={`${actionButtonClass} border-gray-300 text-gray-600 bg-white hover:bg-gray-100 disabled:opacity-60`}
                      >
                        {pendingActionId === `${row.id}:dismiss` ? "Dismissing..." : "Dismiss"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {emptyMessage && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-500">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
