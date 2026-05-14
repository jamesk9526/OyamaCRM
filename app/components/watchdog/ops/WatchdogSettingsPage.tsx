// Settings and policy controls for Watchdog operations workspace.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchWatchdogBackupPolicies,
  fetchWatchdogDatabaseConfig,
  fetchWatchdogSettings,
  saveWatchdogDatabaseConfig,
  saveWatchdogSettings,
} from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogDatabaseSettingsCard from "@/app/components/watchdog/ops/WatchdogDatabaseSettingsCard";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogBackupPolicy, WatchdogDatabaseConfigResponse } from "@/app/components/watchdog/ops/types";

/** Renders persisted Watchdog settings and linked backup policy visibility. */
export default function WatchdogSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [settingsJson, setSettingsJson] = useState("");
  const [policies, setPolicies] = useState<WatchdogBackupPolicy[]>([]);
  const [databaseConfig, setDatabaseConfig] = useState<WatchdogDatabaseConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsPayload, policyItems, databasePayload] = await Promise.all([
        fetchWatchdogSettings(),
        fetchWatchdogBackupPolicies(),
        fetchWatchdogDatabaseConfig(),
      ]);
      setSettings(settingsPayload);
      setSettingsJson(JSON.stringify(settingsPayload, null, 2));
      setPolicies(policyItems);
      setDatabaseConfig(databasePayload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Watchdog settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const parsed = JSON.parse(settingsJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Settings JSON must be an object.");
      }

      const saved = await saveWatchdogSettings(parsed as Record<string, unknown>);
      setSettings(saved);
      setSettingsJson(JSON.stringify(saved, null, 2));
      setMessage("Watchdog settings saved.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDatabaseSettings(payload: {
    confirmationText: string;
    databaseUrl?: string;
    watchdogDatabaseUrl?: string;
    watchdogEncryptionKey?: string;
    jwtSecret?: string;
    nextPublicApiUrl?: string;
  }) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await saveWatchdogDatabaseConfig(payload);
      setDatabaseConfig(response);
      setMessage(`Database settings updated (${response.updatedKeys.join(", ")}).`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save database settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Settings & Policies"
        description="Backup schedules, retention, encryption policy, restore approval settings, and alerts configuration."
        actions={(
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        )}
      />

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading settings...</div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Watchdog Settings JSON</h2>
                <StatusChip status="Working" />
              </div>
              <p className="mt-1 text-sm text-slate-700">
                This payload is persisted through Watchdog settings storage. Unsupported keys are ignored by current workflows.
              </p>
              <textarea
                value={settingsJson}
                onChange={(event) => setSettingsJson(event.target.value)}
                className="mt-3 min-h-[420px] w-full rounded-lg border border-slate-300 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
                className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Settings
              </button>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Backup Policies</h2>
              <p className="mt-1 text-sm text-slate-700">Policy schedule and retention are managed from the Backups dashboard.</p>
              <ul className="mt-3 space-y-2">
                {policies.length === 0 ? (
                  <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No policies found.</li>
                ) : (
                  policies.map((policy) => (
                    <li key={policy.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{policy.policyName}</p>
                        <StatusChip status={policy.enabled ? "Working" : "Partially Working"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-700">{policy.backupScope} • {policy.cronExpression}</p>
                      <p className="text-xs text-slate-600">Retention {policy.retentionDays} days • Target {policy.storageTarget}</p>
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Settings save is fully persisted. Individual policy schedule editing remains in /watchdog/backups to keep changes auditable.
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                Current payload loaded: {settings ? "yes" : "no"}
              </div>
            </article>
          </section>

          <WatchdogDatabaseSettingsCard
            configPayload={databaseConfig}
            busy={busy}
            onSave={handleSaveDatabaseSettings}
          />
        </>
      )}
    </div>
  );
}
