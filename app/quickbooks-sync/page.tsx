/**
 * /quickbooks-sync page — Manual QuickBooks sync queue management dashboard.
 * Staff can review pending donations, edit QB fields, and trigger syncs.
 * Only accessible when the QuickBooks plugin is enabled.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import QBSyncQueueTable, { type QBSyncItem } from "@/app/components/quickbooks/QBSyncQueueTable";
import QBConnectionStatus from "@/app/components/quickbooks/QBConnectionStatus";
import { apiFetch } from "@/app/lib/auth-client";

/** Filter tabs for the queue */
const STATUS_FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
  { label: "Synced", value: "SYNCED" },
  { label: "All", value: "" },
] as const;

type FilterValue = (typeof STATUS_FILTERS)[number]["value"];

/**
 * QuickBooks Sync Queue page.
 * Shows connection status banner, filter tabs, queue table, and sync-all button.
 */
export default function QBSyncPage() {
  const { qbEnabled, qbConnected, loading: pluginLoading, refresh: refreshPlugin } = usePlugins();
  const [items, setItems] = useState<QBSyncItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterValue>("PENDING");
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Fetch queue items from the API */
  const fetchItems = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filter) params.set("status", filter);
      const res = await apiFetch(`/api/quickbooks/sync-queue?${params}`) as {
        data: { items: QBSyncItem[]; total: number };
      };
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sync queue.");
    } finally {
      setFetching(false);
    }
  }, [filter, page]);

  // Refetch when filter or page changes
  useEffect(() => {
    if (!pluginLoading) fetchItems();
  }, [fetchItems, pluginLoading]);

  /** Trigger sync-all for all PENDING items */
  async function handleSyncAll() {
    if (!confirm("Sync all pending items to QuickBooks? This will process them one by one.")) return;
    setSyncingAll(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await apiFetch("/api/quickbooks/sync-queue/sync-all", { method: "POST" }) as {
        data: { synced: number; failed: number; total: number };
      };
      setSyncResult({ synced: res.data.synced, failed: res.data.failed });
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync-all failed.");
    } finally {
      setSyncingAll(false);
    }
  }

  /** Connect redirect */
  async function handleConnect() {
    const res = await apiFetch("/api/quickbooks/auth-uri") as { data: { authUri: string } };
    window.location.href = res.data.authUri;
  }

  /** Disconnect */
  async function handleDisconnect() {
    if (!confirm("Disconnect QuickBooks?")) return;
    await apiFetch("/api/quickbooks/disconnect", { method: "POST" });
    refreshPlugin();
  }

  const pendingCount = filter === "PENDING" ? total : items.filter((i) => i.status === "PENDING").length;

  if (pluginLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>;
  }

  if (!qbEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">QuickBooks Sync</h1>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            The QuickBooks plugin is not enabled.{" "}
            <a href="/settings/plugins" className="text-green-700 font-medium hover:underline">
              Go to Settings → Plugins
            </a>{" "}
            to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">QuickBooks Sync Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and manually push donations to QuickBooks. Items are never synced automatically.
          </p>
        </div>
        {qbConnected && (
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || !qbConnected}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {syncingAll ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>Sync All Pending ({pendingCount})</>
            )}
          </button>
        )}
      </div>

      {/* Connection status */}
      <QBConnectionStatus onConnect={handleConnect} onDisconnect={handleDisconnect} />

      {/* Sync-all result banner */}
      {syncResult && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
          syncResult.failed === 0
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-yellow-50 border border-yellow-200 text-yellow-800"
        }`}>
          <span>
            ✓ {syncResult.synced} synced{syncResult.failed > 0 ? ` · ${syncResult.failed} failed (see Failed tab)` : ""}
          </span>
          <button onClick={() => setSyncResult(null)} className="opacity-60 hover:opacity-100 ml-3">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f.value
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 pb-2">{total} item{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Queue table */}
      {fetching ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading queue…</div>
      ) : (
        <QBSyncQueueTable
          items={items}
          onRefresh={fetchItems}
          syncingAll={syncingAll}
        />
      )}
    </div>
  );
}
