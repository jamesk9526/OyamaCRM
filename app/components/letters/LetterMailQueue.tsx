/** Mail queue workspace for bulk mailing, return tracking, and address issue handling. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import type { LetterMailQueueItem } from "@/app/components/letters/types";

const FILTERS = ["ALL", "QUEUED_FOR_MAIL", "MAILED", "RETURNED", "ADDRESS_ISSUE", "COMPLETED", "CANCELED", "ARCHIVED"] as const;
const ACTIONS = ["QUEUE_FOR_MAIL", "MARK_MAILED", "MARK_RETURNED", "ADDRESS_ISSUE", "REPRINT", "ARCHIVE"] as const;

/** Converts queue action constants into human-friendly labels. */
function actionLabel(action: (typeof ACTIONS)[number]): string {
  return action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (value) => value.toUpperCase());
}

/** Renders mail queue operations with bulk state transitions and return handling. */
export default function LetterMailQueue() {
  const [items, setItems] = useState<LetterMailQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState<(typeof ACTIONS)[number]>("QUEUE_FOR_MAIL");
  const [note, setNote] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmBulkActionOpen, setConfirmBulkActionOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("queueStatus", filter);
      params.set("limit", "500");
      const result = await apiFetch<LetterMailQueueItem[]>(`/api/letters/generated/queue/mail?${params.toString()}`);
      setItems(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load mail queue.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Reload queue data when the selected status filter changes.
  useEffect(() => {
    void load();
  }, [load]);

  const allVisibleSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedIds.includes(item.id));
  }, [items, selectedIds]);

  /** Toggles one letter row checkbox for bulk actions. */
  function toggleSelected(letterId: string) {
    setSelectedIds((previous) => (
      previous.includes(letterId)
        ? previous.filter((id) => id !== letterId)
        : [...previous, letterId]
    ));
  }

  /** Selects or clears all visible queue records. */
  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((previous) => previous.filter((id) => !items.some((item) => item.id === id)));
      return;
    }

    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const item of items) next.add(item.id);
      return Array.from(next);
    });
  }

  /** Opens the confirmation modal before applying one mail queue action. */
  function requestBulkAction() {
    if (selectedIds.length === 0) {
      setError("Select at least one letter in the queue.");
      return;
    }

    setConfirmBulkActionOpen(true);
  }

  /** Executes one confirmed mail queue action and reloads queue state. */
  async function runBulkAction() {
    setWorking(true);
    setError(null);
    const preparedReturnReason = returnReason.trim();
    if (action === "MARK_RETURNED" && !preparedReturnReason) {
      setWorking(false);
      setError("Return reason is required when marking mail as returned.");
      return;
    }

    try {
      await apiFetch("/api/letters/generated/queue/mail/actions", {
        method: "POST",
        body: JSON.stringify({
          action,
          letterIds: selectedIds,
          note: note.trim() || undefined,
          returnReason: preparedReturnReason || undefined,
        }),
      });
      setSelectedIds([]);
      setConfirmBulkActionOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to apply mail queue action.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mail Queue</h1>
        <p className="mt-0.5 text-sm text-gray-500">Move printed letters into outbound mail, log mailed status, and track returned mail.</p>
      </div>

      <LettersWorkspaceNav />

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((entry) => (
            <button
              key={entry}
              onClick={() => setFilter(entry)}
              className={`px-3 py-1.5 text-sm rounded-full border ${filter === entry ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >
              {entry.replaceAll("_", " ")}
            </button>
          ))}
          <button onClick={() => void load()} className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-gray-300">Refresh</button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="block text-sm text-gray-700">
            Bulk Action Note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note for audit and timeline logs"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-gray-700">
            Return Reason
            <input
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Used when action is Mark Returned"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-gray-700">
            Action
            <select value={action} onChange={(event) => setAction(event.target.value as (typeof ACTIONS)[number])} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {ACTIONS.map((entry) => (
                <option key={entry} value={entry}>{actionLabel(entry)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={requestBulkAction}
              disabled={working || selectedIds.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {working ? "Applying..." : `Apply to ${selectedIds.length}`}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allVisibleSelected} onChange={() => toggleAllVisible()} />
            Select all visible
          </label>
          <p className="text-xs text-gray-500">Selected: {selectedIds.length}</p>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={String(index)} className="h-20 rounded-lg bg-gray-100 animate-pulse" />)
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No letters in this mail queue filter.</p>
          ) : (
            items.map((item) => (
              <label key={item.id} className="flex gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.template?.name || "Template"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.constituent ? `${item.constituent.firstName} ${item.constituent.lastName}` : "No constituent"} · Queue: {item.queueStatus.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Priority: {item.priority} · Generated: {new Date(item.generatedAt).toLocaleString()} {item.mailedAt ? `· Mailed ${new Date(item.mailedAt).toLocaleString()}` : ""}
                  </p>
                  {item.addressWarning && <p className="mt-1 text-xs text-amber-700">{item.addressWarning}</p>}
                  {item.returnReason && <p className="mt-1 text-xs text-rose-700">Return reason: {item.returnReason}</p>}
                  {item.statusNote && <p className="mt-1 text-xs text-gray-600">Note: {item.statusNote}</p>}
                </div>
              </label>
            ))
          )}
        </div>
      </section>

      {confirmBulkActionOpen && (
        <WorkspaceSetupModal
          title="Confirm Mail Queue Action"
          subtitle="Bulk mail actions are audited and update communication workflow records."
          onClose={() => setConfirmBulkActionOpen(false)}
          maxWidthClassName="max-w-lg"
        >
          <div className="px-6 pb-6 pt-14 space-y-5">
            <p className="text-sm text-gray-700">
              Apply {actionLabel(action)} to {selectedIds.length} selected letters?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkActionOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runBulkAction()}
                disabled={working}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {working ? "Applying..." : "Confirm"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}
