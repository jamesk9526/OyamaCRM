/** Compact Opportunity Engine panel with optional full-screen modal workspace. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import OpportunityEnginePlaceholderTable from "@/app/components/steward/OpportunityEnginePlaceholderTable";
import type { StewardOpportunityRow } from "@/app/components/steward/steward-signals-types";

type OpportunityAction = "create-task" | "draft-email" | "dismiss";

/**
 * OpportunityEngineCompactPanel keeps the dashboard footprint small while allowing
 * users to open the full Opportunity Engine in a modal when needed.
 */
export default function OpportunityEngineCompactPanel() {
  const [rows, setRows] = useState<StewardOpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<StewardOpportunityRow[]>("/api/steward-signals/opportunities?limit=20");
      setRows(data);
      setLastRefreshedAt(new Date().toISOString());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load opportunities.");
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

  useEffect(() => {
    if (!isModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  /** Performs a confirm-first opportunity action and refreshes compact results. */
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
      window.dispatchEvent(new CustomEvent("steward-signals:analysis-rebuilt"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Action failed.");
    } finally {
      setPendingActionId(null);
    }
  }

  const displayRows = useMemo(() => rows.slice(0, 5), [rows]);

  const urgencyTone = (priority: StewardOpportunityRow["priority"]): string => {
    if (priority === "High") return "border-red-200 bg-red-50 text-red-700";
    if (priority === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-200 bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Compact Queue</p>
          <p className="text-xs text-gray-500">
            {lastRefreshedAt ? `Updated ${new Date(lastRefreshedAt).toLocaleString()}` : "Loading opportunities..."}
          </p>
        </div>
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
            onClick={() => setIsModalOpen(true)}
            className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            Open Workspace
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>
      )}

      <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
        {displayRows.map((row) => (
          <article key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{row.donorName}</p>
                <p className="text-xs text-gray-500">{row.opportunityType}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${urgencyTone(row.priority)}`}>
                {row.priority}
              </span>
            </div>

            <p className="mt-2 text-xs text-gray-700">{row.suggestedAction}</p>
            <p className="mt-1 text-xs text-gray-500">
              Due {new Date(row.dueDateIso).toLocaleDateString()} · {row.channel} · {row.confidence}% confidence
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runAction(row, "create-task")}
                disabled={pendingActionId !== null}
                className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
              >
                {pendingActionId === `${row.id}:create-task` ? "Creating..." : "Create Task"}
              </button>
              <button
                type="button"
                onClick={() => void runAction(row, "draft-email")}
                disabled={pendingActionId !== null}
                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                {pendingActionId === `${row.id}:draft-email` ? "Drafting..." : "Draft Email"}
              </button>
              <Link
                href={`/constituents/${row.constituentId}`}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                View Donor
              </Link>
            </div>
          </article>
        ))}

        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No opportunities found. Signals may be up to date.
          </div>
        )}
      </div>

      {rows.length > displayRows.length && (
        <p className="text-xs text-gray-500">
          Showing {displayRows.length} of {rows.length} opportunities. Open Workspace to review the full queue.
        </p>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 p-3 lg:p-8">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 lg:px-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Opportunity Engine Workspace</h3>
                <p className="text-xs text-gray-500">Full queue review, actions, and explainability details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
              <OpportunityEnginePlaceholderTable />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
