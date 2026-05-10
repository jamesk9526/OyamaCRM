// Full CRM backup and restore panel for OyamaWatchdog.
"use client";

import { useMemo, useState } from "react";
import { apiFetch, getAccessToken, refreshAccessToken } from "@/app/lib/auth-client";
import { WatchdogBackupItem } from "@/app/components/watchdog/types";

interface Props {
  items: WatchdogBackupItem[];
  onRefresh: () => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** WatchdogBackupPanel provides full CRM export/import controls owned by Watchdog admins. */
export default function WatchdogBackupPanel({ items, onRefresh }: Props) {
  const [label, setLabel] = useState("");
  const [includeWatchdogDb, setIncludeWatchdogDb] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [items],
  );

  /** Performs an authenticated request for non-JSON download responses. */
  async function fetchWithAuth(path: string): Promise<Response> {
    const token = getAccessToken();
    const request = async (accessToken: string | null) => {
      const headers = accessToken
        ? ({ Authorization: `Bearer ${accessToken}` } as HeadersInit)
        : ({} as HeadersInit);
      return fetch(`${API_BASE}${path}`, {
        method: "GET",
        credentials: "include",
        headers,
      });
    };

    let response = await request(token);
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        response = await request(refreshed);
      }
    }
    return response;
  }

  /** Triggers full CRM export and saves backup payload in Watchdog. */
  async function handleExport(): Promise<void> {
    setExporting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch("/api/watchdog/backups/export", {
        method: "POST",
        body: JSON.stringify({
          label: label.trim() || undefined,
          includeWatchdogDatabase: includeWatchdogDb,
        }),
      });

      setSuccess("Full CRM backup exported and stored in Watchdog.");
      setLabel("");
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup export failed.");
    } finally {
      setExporting(false);
    }
  }

  /** Restores full CRM state from one saved Watchdog backup record. */
  async function handleRestore(backupId: string): Promise<void> {
    const confirmed = window.confirm(
      "This will restore the full CRM database to the selected backup state. Continue?",
    );
    if (!confirmed) return;

    setRestoringId(backupId);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch("/api/watchdog/backups/import", {
        method: "POST",
        body: JSON.stringify({
          backupId,
          includeWatchdogDatabase: includeWatchdogDb,
        }),
      });

      setSuccess(`Full CRM restore completed from backup ${backupId}.`);
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup restore failed.");
    } finally {
      setRestoringId(null);
    }
  }

  /** Downloads one backup payload as JSON for external archiving. */
  async function handleDownloadJson(backupId: string): Promise<void> {
    setDownloadingId(backupId);
    setError(null);

    try {
      const payload = await apiFetch<{ item: WatchdogBackupItem; backup: unknown }>(`/api/watchdog/backups/${backupId}`);
      const json = JSON.stringify(payload.backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `watchdog-backup-${backupId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup JSON download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  /** Downloads one backup SQL dump with authenticated direct fetch. */
  async function handleDownloadSql(backupId: string): Promise<void> {
    setDownloadingId(backupId);
    setError(null);

    try {
      const response = await fetchWithAuth(`/api/watchdog/backups/${backupId}/sql`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `SQL download failed (${response.status})`);
      }

      const sqlText = await response.text();
      const blob = new Blob([sqlText], { type: "text/plain" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `watchdog-backup-${backupId}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup SQL download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section id="backup" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Full CRM Export And Backup</h2>
        <p className="text-xs text-slate-400 mt-1">
          Export complete CRM state (SQL + JSON), store backups in Watchdog, and restore from the exact point-in-time snapshot.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Backup label (optional)"
          className="md:col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100"
        />
        <label className="flex items-center gap-2 text-xs text-slate-300 border border-slate-700 rounded-lg px-3 py-2 bg-slate-800/60">
          <input
            type="checkbox"
            checked={includeWatchdogDb}
            onChange={(event) => setIncludeWatchdogDb(event.target.checked)}
          />
          Include Watchdog DB
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
        >
          {exporting ? "Exporting..." : "Export Full CRM Backup"}
        </button>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="px-3 py-2 text-xs rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
        >
          Refresh Backup List
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-700">
              <th className="py-2 pr-3">Label</th>
              <th className="py-2 pr-3">Rows</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Restored</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={5}>
                  No backups yet. Export one full snapshot to start.
                </td>
              </tr>
            )}

            {sortedItems.map((item) => {
              const busy = restoringId === item.id || downloadingId === item.id;
              return (
                <tr key={item.id} className="border-b border-slate-800/80">
                  <td className="py-2 pr-3 text-slate-200">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.id}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    <div>Primary: {item.primaryRowCount.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500">Watchdog: {item.watchdogRowCount.toLocaleString()}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-300">
                    {item.restoredAt ? new Date(item.restoredAt).toLocaleString() : "Not restored"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDownloadJson(item.id)}
                        className="px-2 py-1 text-[11px] rounded border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDownloadSql(item.id)}
                        className="px-2 py-1 text-[11px] rounded border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                      >
                        SQL
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRestore(item.id)}
                        className="px-2 py-1 text-[11px] rounded border border-amber-500/50 text-amber-200 hover:bg-amber-900/30 disabled:opacity-60"
                      >
                        {restoringId === item.id ? "Restoring..." : "Restore"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
