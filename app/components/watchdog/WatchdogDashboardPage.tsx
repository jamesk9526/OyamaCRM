// Main dashboard composition for OyamaWatchdog module.
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WatchdogStatusCards from "@/app/components/watchdog/WatchdogStatusCards";
import WatchdogSecurityFeed from "@/app/components/watchdog/WatchdogSecurityFeed";
import WatchdogVaultPanel from "@/app/components/watchdog/WatchdogVaultPanel";
import WatchdogBackupPanel from "@/app/components/watchdog/WatchdogBackupPanel";
import { WatchdogBackupItem, WatchdogSecurityFeedItem, WatchdogStatusData, WatchdogVaultItem } from "@/app/components/watchdog/types";

/** WatchdogDashboardPage loads and renders the OyamaWatchdog module starter dashboard. */
export default function WatchdogDashboardPage() {
  const [status, setStatus] = useState<WatchdogStatusData | null>(null);
  const [feedItems, setFeedItems] = useState<WatchdogSecurityFeedItem[]>([]);
  const [vaultItems, setVaultItems] = useState<WatchdogVaultItem[]>([]);
  const [backupItems, setBackupItems] = useState<WatchdogBackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);

  /** Loads all dashboard datasets in parallel. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, feedData, vaultData, backupData] = await Promise.all([
        apiFetch<WatchdogStatusData>("/api/watchdog/status"),
        apiFetch<{ items: WatchdogSecurityFeedItem[] }>("/api/watchdog/security-feed?limit=40"),
        apiFetch<{ items: WatchdogVaultItem[] }>("/api/watchdog/vault"),
        apiFetch<{ items: WatchdogBackupItem[] }>("/api/watchdog/backups?limit=25"),
      ]);

      setStatus(statusData);
      setFeedItems(Array.isArray(feedData.items) ? feedData.items : []);
      setVaultItems(Array.isArray(vaultData.items) ? vaultData.items : []);
      setBackupItems(Array.isArray(backupData.items) ? backupData.items : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load OyamaWatchdog dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Applies one incident action then refreshes the feed. */
  const applyIncidentAction = useCallback(async (
    item: WatchdogSecurityFeedItem,
    action: "acknowledge" | "escalate" | "resolve",
  ) => {
    const [source, eventRef] = item.id.split(":");
    if (!eventRef || (source !== "audit" && source !== "external")) {
      setError("Unexpected event identifier; cannot apply incident action.");
      return;
    }

    setActingKey(`${item.id}:${action}`);
    setError(null);
    try {
      await apiFetch("/api/watchdog/security-feed/actions", {
        method: "POST",
        body: JSON.stringify({
          source: source === "audit" ? "audit" : "watchdog",
          eventRef,
          action,
        }),
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to apply incident action.");
    } finally {
      setActingKey(null);
    }
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">OyamaWatchdog Security Command</h1>
          <p className="text-sm text-slate-400 mt-0.5">Dedicated admin-only security CRM for vault operations, telemetry, and cross-module monitoring.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-600 text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-8 text-slate-300">Loading security telemetry...</div>
      ) : (
        <>
          <WatchdogStatusCards data={status} />
          <WatchdogSecurityFeed items={feedItems} onAction={applyIncidentAction} actingKey={actingKey} />
          <WatchdogVaultPanel items={vaultItems} onRefresh={load} />
          <WatchdogBackupPanel items={backupItems} onRefresh={load} />

          <section id="access" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Fine-Grained Access</h2>
            <p className="text-xs text-slate-400 mt-1">
              Access controls are enforced by permission keys like watchdog:view_logs and watchdog:vault:read_secret.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Configure explicit allow/deny flags from Settings &gt; Users &gt; Fine-grained Permissions using matching permission strings.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
