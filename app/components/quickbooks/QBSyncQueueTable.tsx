/**
 * QBSyncQueueTable: Displays a paginated table of QuickBooks sync queue items.
 * Staff can edit PENDING/FAILED items, remove items (marks SKIPPED), and trigger individual syncs.
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape of a sync queue item returned by the API */
export interface QBSyncItem {
  id: string;
  status: "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";
  customerName: string | null;
  memo: string | null;
  qbAccount: string | null;
  amount: string | number;
  attemptCount: number;
  errorMessage: string | null;
  qbEntityId: string | null;
  syncedAt: string | null;
  createdAt: string;
  donation?: {
    id: string;
    amount: string | number;
    date: string;
    paymentMethod: string;
    constituent?: { firstName: string; lastName: string };
    campaign?: { name: string };
    designation?: { name: string };
  };
}

interface Props {
  items: QBSyncItem[];
  /** Called after a mutation so the parent can reload the list */
  onRefresh: () => void;
  /** Whether a global sync-all operation is in progress */
  syncingAll?: boolean;
}

/** Status badge colors */
const STATUS_COLORS: Record<QBSyncItem["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SYNCED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-500",
};

/**
 * Inline edit dialog state for a single queue item.
 * Only shown for PENDING or FAILED items.
 */
interface EditState {
  id: string;
  customerName: string;
  memo: string;
  qbAccount: string;
  amount: string;
}

/**
 * QBSyncQueueTable renders the list of sync items with inline edit and action buttons.
 *
 * @param items      - Array of QBSyncItem objects to display
 * @param onRefresh  - Callback to reload items after mutations
 * @param syncingAll - True when a sync-all is in progress (disables buttons)
 */
export default function QBSyncQueueTable({ items, onRefresh, syncingAll = false }: Props) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Trigger individual sync for one item */
  async function handleSync(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      await apiFetch(`/api/quickbooks/sync-queue/${id}/sync`, { method: "POST" });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  /** Remove (mark SKIPPED) a queue item */
  async function handleRemove(id: string) {
    if (!confirm("Remove this item from the queue? This cannot be undone.")) return;
    setRemovingId(id);
    setError(null);
    try {
      await apiFetch(`/api/quickbooks/sync-queue/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setRemovingId(null);
    }
  }

  /** Open the inline edit form for an item */
  function startEdit(item: QBSyncItem) {
    setEditState({
      id: item.id,
      customerName: item.customerName ?? "",
      memo: item.memo ?? "",
      qbAccount: item.qbAccount ?? "",
      amount: String(item.amount ?? ""),
    });
    setError(null);
  }

  /** Save edits to a queue item */
  async function handleSaveEdit() {
    if (!editState) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/quickbooks/sync-queue/${editState.id}`, {
        method: "PUT",
        body: JSON.stringify({
          customerName: editState.customerName || undefined,
          memo: editState.memo || undefined,
          qbAccount: editState.qbAccount || undefined,
          amount: editState.amount ? parseFloat(editState.amount) : undefined,
        }),
      });
      setEditState(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No items in the queue. Add donations to the queue using the <strong>Add to QuickBooks Queue</strong> button when recording a donation.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Inline edit form */}
      {editState && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-900">Edit Queue Item</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={editState.customerName}
                onChange={(e) => setEditState((s) => s && { ...s, customerName: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editState.amount}
                onChange={(e) => setEditState((s) => s && { ...s, amount: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Memo</label>
              <input
                type="text"
                value={editState.memo}
                onChange={(e) => setEditState((s) => s && { ...s, memo: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">QB Account (optional)</label>
              <input
                type="text"
                placeholder="e.g. Donations Income"
                value={editState.qbAccount}
                onChange={(e) => setEditState((s) => s && { ...s, qbAccount: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={() => setEditState(null)}
              className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Donor / Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Memo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.map((item) => {
              const isBusy = syncingAll || syncingId === item.id || removingId === item.id;
              const canEdit = ["PENDING", "FAILED"].includes(item.status);
              const canSync = ["PENDING", "FAILED"].includes(item.status);
              const canRemove = item.status !== "SYNCED";
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.customerName ?? "—"}</p>
                    {item.donation?.constituent && (
                      <p className="text-xs text-gray-400">
                        {item.donation.constituent.firstName} {item.donation.constituent.lastName}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${Number(item.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {item.memo ?? "—"}
                    {item.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5 truncate" title={item.errorMessage}>
                        ⚠ {item.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                    </span>
                    {item.attemptCount > 0 && item.status !== "SYNCED" && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.attemptCount} attempt{item.attemptCount !== 1 ? "s" : ""}</p>
                    )}
                    {item.qbEntityId && (
                      <p className="text-xs text-green-600 mt-0.5">QB: {item.qbEntityId}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && !editState && (
                        <button
                          onClick={() => startEdit(item)}
                          disabled={isBusy}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
                        >
                          Edit
                        </button>
                      )}
                      {canSync && (
                        <button
                          onClick={() => handleSync(item.id)}
                          disabled={isBusy}
                          className="text-xs text-green-700 hover:text-green-900 font-medium disabled:opacity-40"
                        >
                          {syncingId === item.id ? "Syncing…" : "Sync"}
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={isBusy}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
                        >
                          {removingId === item.id ? "Removing…" : "Remove"}
                        </button>
                      )}
                      {item.status === "SYNCED" && (
                        <span className="text-xs text-gray-400">
                          {item.syncedAt ? new Date(item.syncedAt).toLocaleDateString() : "Synced"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
