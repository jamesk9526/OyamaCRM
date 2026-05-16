/** Steward Signals task suggestions table. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardTaskSuggestionRow } from "@/app/components/steward/steward-signals-types";

/**
 * StewardTaskSuggestionsTable shows explainable task suggestions derived
 * from live donor stewardship signals.
 */
export default function StewardTaskSuggestionsTable() {
  const [rows, setRows] = useState<StewardTaskSuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<StewardTaskSuggestionRow[]>("/api/steward-signals/task-suggestions?limit=40");
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggested tasks.");
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

  /** Creates a task from the linked opportunity via confirm-first endpoint. */
  async function createTask(row: StewardTaskSuggestionRow) {
    if (!window.confirm(`Create suggested task for ${row.donorName}?`)) return;

    setPendingId(row.id);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<{ message?: string }>(`/api/steward-signals/opportunities/${row.opportunityId}/create-task`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });

      setNotice(response.message ?? "Task created.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setPendingId(null);
    }
  }

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading suggested tasks...";
    if (rows.length === 0) return "No suggested tasks right now.";
    return null;
  }, [loading, rows.length]);

  const priorityClass = (priority: StewardTaskSuggestionRow["priority"]): string => {
    if (priority === "HIGH") return "bg-red-50 text-red-700 border-red-200";
    if (priority === "MEDIUM") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const groupedRows = useMemo(() => {
    const groups: Record<"Thank" | "Reconnect" | "Invite" | "Upgrade" | "Research" | "Follow Up" | "Review", StewardTaskSuggestionRow[]> = {
      Thank: [],
      Reconnect: [],
      Invite: [],
      Upgrade: [],
      Research: [],
      "Follow Up": [],
      Review: [],
    };

    const classify = (row: StewardTaskSuggestionRow): keyof typeof groups => {
      const context = `${row.title} ${row.reason} ${row.description}`.toLowerCase();
      if (row.taskType === "THANK_YOU" || context.includes("thank")) return "Thank";
      if (context.includes("reconnect") || context.includes("lapse") || context.includes("cadence")) return "Reconnect";
      if (context.includes("event") || context.includes("invite")) return "Invite";
      if (context.includes("monthly") || context.includes("second-gift") || context.includes("upgrade")) return "Upgrade";
      if (context.includes("major") || context.includes("review")) return "Research";
      if (row.priority === "HIGH") return "Review";
      return "Follow Up";
    };

    for (const row of rows) {
      groups[classify(row)].push(row);
    }

    return groups;
  }, [rows]);

  return (
    <div className="space-y-2">
      {(error || notice) && (
        <div className="flex items-center justify-between gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void loadRows()}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode("board")}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${viewMode === "board" ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Action Board
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

      {viewMode === "board" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {(Object.entries(groupedRows) as Array<[keyof typeof groupedRows, StewardTaskSuggestionRow[]]>).map(([group, items]) => (
            <article key={group} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{group}</p>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  {items.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {items.length === 0 ? "No recommendations in this group." : `${items.length} stewardship actions ready for review.`}
              </p>

              <div className="mt-3 space-y-2">
                {items.slice(0, 3).map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{row.donorName}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityClass(row.priority)}`}>
                        {row.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-700">{row.reason}</p>
                    <p className="mt-1 text-xs text-gray-500">Due {new Date(row.dueDateIso).toLocaleDateString()} · {row.channel} · {row.confidence}% confidence</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => createTask(row)}
                        disabled={pendingId !== null}
                        className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        {pendingId === row.id ? "Creating..." : "Create Task"}
                      </button>
                      <Link
                        href={`/constituents/${row.constituentId}`}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View Donor
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
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
              {["Priority", "Donor", "Task", "Reason", "Channel", "Due", "Confidence", "Action"].map((header) => (
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
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityClass(row.priority)}`}>
                    {row.priority}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">{row.donorName}</td>
                <td className="px-3 py-2 text-gray-700 min-w-[260px]">
                  <p className="font-medium text-gray-900">{row.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{row.taskType}</p>
                </td>
                <td className="px-3 py-2 text-gray-600 min-w-[300px]">{row.reason}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.channel}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(row.dueDateIso).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-gray-600 min-w-[240px]">
                  <p className="whitespace-nowrap">{row.confidence}%</p>
                  <p className="text-xs text-gray-500 mt-1">{row.confidenceReason}</p>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => createTask(row)}
                    disabled={pendingId !== null}
                    className="px-2 py-1 rounded border text-xs font-medium border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-60 transition-colors"
                  >
                    {pendingId === row.id ? "Creating..." : "Create Task"}
                  </button>
                </td>
              </tr>
            ))}
            {emptyMessage && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
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
