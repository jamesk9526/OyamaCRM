/** Opportunity Engine table for live donor action recommendations. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface OpportunityRow {
  id: string;
  constituentId: string;
  donorName: string;
  priority: "High" | "Medium" | "Low";
  opportunityType: string;
  reason: string;
  suggestedAction: string;
  channel: string;
  dueDateIso: string;
  ownerName: string;
  status: "Queued" | "Needs Review";
  confidence: number;
}

type OpportunityAction = "create-task" | "draft-email" | "dismiss";

/**
 * OpportunityEnginePlaceholderTable renders a live queue and uses explicit
 * confirm-first action buttons for task creation, email drafting, and dismissal.
 */
export default function OpportunityEnginePlaceholderTable() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<OpportunityRow[]>("/api/steward-signals/opportunities?limit=60");
      setRows(data);
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
    const intervalId = window.setInterval(() => {
      void loadRows();
    }, 30000);

    return () => {
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
      window.clearInterval(intervalId);
    };
  }, []);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading opportunity queue...";
    if (rows.length === 0) return "No opportunities found. Signals may be up to date.";
    return null;
  }, [loading, rows.length]);

  /** Performs a confirm-first API mutation and refreshes the queue on success. */
  async function runAction(row: OpportunityRow, action: OpportunityAction) {
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

  return (
    <div className="space-y-2">
      {(error || notice) && (
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>
      )}

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
    </div>
  );
}
