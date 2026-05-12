/** Steward Signals deterministic task suggestions table (non-AI). */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface TaskSuggestionRow {
  id: string;
  opportunityId: string;
  constituentId: string;
  donorName: string;
  title: string;
  description: string;
  taskType: "THANK_YOU" | "FOLLOW_UP";
  priority: "HIGH" | "MEDIUM" | "LOW";
  channel: string;
  dueDateIso: string;
  confidence: number;
  confidenceReason: string;
  reason: string;
}

/**
 * StewardTaskSuggestionsTable shows deterministic, explainable task suggestions
 * derived from live donor signals without model-generated content.
 */
export default function StewardTaskSuggestionsTable() {
  const [rows, setRows] = useState<TaskSuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<TaskSuggestionRow[]>("/api/steward-signals/task-suggestions?limit=40");
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
  async function createTask(row: TaskSuggestionRow) {
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

  const priorityClass = (priority: TaskSuggestionRow["priority"]): string => {
    if (priority === "HIGH") return "bg-red-50 text-red-700 border-red-200";
    if (priority === "MEDIUM") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

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
    </div>
  );
}
