/**
 * /quickbooks-sync page — Manual QuickBooks sync queue management dashboard.
 * Staff can review pending donations, edit QB fields, and trigger syncs.
 * Only accessible when the QuickBooks plugin is enabled.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import QBSyncQueueTable, { type QBSyncItem } from "@/app/components/quickbooks/QBSyncQueueTable";
import QBConnectionStatus from "@/app/components/quickbooks/QBConnectionStatus";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
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
 * Shows connection status, ribbon-based queue controls, queue table, and sync-all actions.
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
        <WorkspaceBreadcrumbBar
          items={[
            { label: "Donor CRM", href: "/" },
            { label: "QuickBooks Sync" },
          ]}
          statusLabel="Not Enabled"
          metadata="Enable the plugin to access manual sync queue tools"
          primaryAction={<WorkspaceRibbonButton label="Open Plugins" href="/settings/plugins" variant="primary" />}
        />

        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Setup">
            <WorkspaceRibbonButton label="Open Plugins" href="/settings/plugins" variant="primary" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            The QuickBooks plugin is not enabled.{" "}
            <Link href="/settings/plugins" className="text-green-700 font-medium hover:underline">
              Go to Settings → Plugins
            </Link>{" "}
            to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "QuickBooks Sync" },
        ]}
        statusLabel={qbConnected ? "Connected" : "Not Connected"}
        metadata={`${total.toLocaleString()} queue item${total !== 1 ? "s" : ""} · ${pendingCount.toLocaleString()} pending`}
        primaryAction={
          qbConnected
            ? <WorkspaceRibbonButton label={syncingAll ? "Syncing" : `Sync Pending (${pendingCount})`} onClick={handleSyncAll} variant="primary" disabled={syncingAll || !qbConnected} />
            : <WorkspaceRibbonButton label="Connect QuickBooks" onClick={() => void handleConnect()} variant="primary" />
        }
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Queue">
          {STATUS_FILTERS.map((f) => (
            <WorkspaceRibbonButton
              key={f.value || "ALL"}
              label={f.label}
              onClick={() => { setFilter(f.value); setPage(1); }}
              variant={filter === f.value ? "primary" : "secondary"}
            />
          ))}
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Connection">
          <WorkspaceRibbonButton label="Connect" onClick={() => void handleConnect()} disabled={qbConnected} />
          <WorkspaceRibbonButton label="Disconnect" onClick={() => void handleDisconnect()} disabled={!qbConnected} />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void fetchItems()} />
          <WorkspaceRibbonButton label="Sync Pending" onClick={handleSyncAll} variant="primary" disabled={!qbConnected || syncingAll} />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

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
