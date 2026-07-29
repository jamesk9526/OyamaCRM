// Backup operations dashboard for Watchdog.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, getAccessToken, refreshAccessToken } from "@/app/lib/auth-client";
import {
  createEnvironmentManifestBackup,
  createWatchdogBackupPolicy,
  fetchWatchdogBackupCoverage,
  fetchWatchdogBackupPolicies,
  fetchWatchdogBackups,
  fetchWatchdogBackupVerifications,
  runWatchdogFullBackupNow,
  updateWatchdogBackupPolicy,
  verifyWatchdogBackup,
} from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogBackupPolicy, WatchdogBackupRecord, WatchdogBackupVerification } from "@/app/components/watchdog/ops/types";

/** Performs an authenticated binary request, including one normal token refresh retry. */
async function fetchBackupPackage(path: string, init: RequestInit): Promise<Response> {
  const send = async (token: string | null) => fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const token = getAccessToken();
  let response = await send(token);
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }
  return response;
}

/** Renders backup scopes, policies, history, and verification controls. */
export default function WatchdogBackupsPage() {
  const [coverage, setCoverage] = useState<Array<{ scope: string; label: string; status: string; implemented: boolean; reason?: string }>>([]);
  const [moduleScopes, setModuleScopes] = useState<string[]>([]);
  const [backups, setBackups] = useState<WatchdogBackupRecord[]>([]);
  const [policies, setPolicies] = useState<WatchdogBackupPolicy[]>([]);
  const [verifications, setVerifications] = useState<WatchdogBackupVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portableExporting, setPortableExporting] = useState(false);
  const [portableRestoring, setPortableRestoring] = useState(false);
  const [portableFile, setPortableFile] = useState<File | null>(null);
  const [portableConfirmation, setPortableConfirmation] = useState("");
  const [portableReason, setPortableReason] = useState("");

  const [newPolicyName, setNewPolicyName] = useState("Nightly Full Platform");
  const [newPolicyScope, setNewPolicyScope] = useState("FULL_PLATFORM");
  const [newPolicyCron, setNewPolicyCron] = useState("0 2 * * *");
  const [newPolicyRetention, setNewPolicyRetention] = useState("90");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coverageData, backupItems, policyItems, verificationItems] = await Promise.all([
        fetchWatchdogBackupCoverage(),
        fetchWatchdogBackups(),
        fetchWatchdogBackupPolicies(),
        fetchWatchdogBackupVerifications(),
      ]);
      setCoverage(coverageData.scopes);
      setModuleScopes(coverageData.moduleScopes);
      setBackups(backupItems);
      setPolicies(policyItems);
      setVerifications(verificationItems);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load backup workspace.");
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

  const verificationMap = useMemo(() => {
    const map = new Map<string, WatchdogBackupVerification>();
    verifications.forEach((verification) => {
      if (!map.has(verification.backupId)) {
        map.set(verification.backupId, verification);
      }
    });
    return map;
  }, [verifications]);

  const failedVerifications = useMemo(() => {
    return verifications.filter((verification) => verification.status === "FAILED");
  }, [verifications]);

  async function handleRunBackup(scopeLabel: string, label: string) {
    setBusyAction(scopeLabel);
    setError(null);
    setMessage(null);
    try {
      await runWatchdogFullBackupNow({
        label,
        includeWatchdogDatabase: true,
      });
      setMessage(`Backup job started: ${label}`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup job failed to start.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateManifest() {
    setBusyAction("manifest");
    setError(null);
    setMessage(null);
    try {
      const result = await createEnvironmentManifestBackup();
      setMessage(`Environment manifest created with ${result.manifest.entryCount} redacted entries.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Environment manifest creation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePortableExport() {
    setPortableExporting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchBackupPackage("/api/watchdog/ops/backups/package/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeWatchdogDatabase: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Backup package export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const filename = response.headers.get("content-disposition")?.match(/filename=([^;]+)/i)?.[1]?.replace(/"/g, "")
        ?? `oyamacrm-full-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage("Portable CRM backup downloaded. Keep the ZIP in protected storage; it contains complete CRM data and media.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not download the portable backup package.");
    } finally {
      setPortableExporting(false);
    }
  }

  async function handlePortableRestore() {
    if (!portableFile) {
      setError("Choose an OyamaCRM backup ZIP before restoring.");
      return;
    }
    if (portableConfirmation.trim() !== "RESTORE") {
      setError('Type RESTORE exactly to confirm the package restore.');
      return;
    }
    if (portableReason.trim().length < 12) {
      setError("Add a restore reason of at least 12 characters for the audit record.");
      return;
    }
    if (!window.confirm("This replaces current CRM database records and the entire uploads library. A pre-restore database snapshot and a recoverable media directory are created first. Continue?")) {
      return;
    }
    setPortableRestoring(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchBackupPackage("/api/watchdog/ops/backups/package/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "X-Oyama-Restore-Execute": "true",
          "X-Oyama-Restore-Confirmation": "RESTORE",
          "X-Oyama-Restore-Reason": portableReason.trim(),
        },
        body: await portableFile.arrayBuffer(),
      });
      const payload = await response.json().catch(() => null) as {
        error?: { message?: string };
        restoredAssetCount?: number;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? `Package restore failed (${response.status}).`);
      }
      setMessage(`Portable restore completed. ${payload?.restoredAssetCount ?? 0} media files were restored.`);
      setPortableFile(null);
      setPortableConfirmation("");
      setPortableReason("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not restore the portable backup package.");
    } finally {
      setPortableRestoring(false);
    }
  }

  async function handleVerifyBackup(backupId: string) {
    setBusyAction(`verify:${backupId}`);
    setError(null);
    setMessage(null);
    try {
      const verification = await verifyWatchdogBackup(backupId);
      setMessage(`Verification completed for ${backupId}: ${verification.status}`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup verification failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreatePolicy() {
    setBusyAction("create-policy");
    setError(null);
    setMessage(null);
    try {
      await createWatchdogBackupPolicy({
        policyName: newPolicyName.trim() || "Backup Policy",
        backupScope: newPolicyScope,
        cronExpression: newPolicyCron.trim() || "0 2 * * *",
        retentionDays: Number(newPolicyRetention) || 90,
        storageTarget: "watchdog-default",
        encrypted: true,
        enabled: true,
      });
      setMessage("Backup policy created.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create backup policy.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTogglePolicy(policy: WatchdogBackupPolicy) {
    setBusyAction(`policy:${policy.id}`);
    setError(null);
    setMessage(null);
    try {
      await updateWatchdogBackupPolicy({
        id: policy.id,
        patch: {
          enabled: !policy.enabled,
        },
      });
      setMessage(`${policy.policyName} ${policy.enabled ? "disabled" : "enabled"}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update backup policy.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Backups"
        description="Central backup creation, scheduling, verification, retention, and storage policy workspace."
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading backup workspace...</div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Backup Overview</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => void handleRunBackup("full", `full-platform-${new Date().toISOString()}`)}
                disabled={busyAction !== null}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run Full Backup Now
              </button>
              <button
                type="button"
                onClick={() => void handleRunBackup("database", `database-${new Date().toISOString()}`)}
                disabled={busyAction !== null}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run Database Backup Now
              </button>
              <button
                type="button"
                onClick={() => void handleCreateManifest()}
                disabled={busyAction !== null}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export Redacted Environment Manifest
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-[linear-gradient(135deg,#f0fdf4,#ffffff_55%)] p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Portable Full CRM Package</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                  Download one re-importable ZIP with the full CRM database snapshot, SQL, settings stored in the database, and every local upload
                  (images, video, documents, letter assets, email assets, and trivia media). The package checks database and file integrity on import.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handlePortableExport()}
                disabled={portableExporting || portableRestoring}
                className="rounded-lg bg-[#0f6cbd] px-3 py-2 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portableExporting ? "Preparing package..." : "Download full backup ZIP"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 border-t border-emerald-100 pt-4 lg:grid-cols-[1.15fr_0.8fr_1.3fr_auto] lg:items-end">
              <label className="block text-xs font-medium text-slate-700">
                Backup ZIP
                <input
                  type="file"
                  accept="application/zip,.zip"
                  onChange={(event) => setPortableFile(event.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 file:mr-2 file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Type RESTORE
                <input
                  value={portableConfirmation}
                  onChange={(event) => setPortableConfirmation(event.target.value)}
                  placeholder="RESTORE"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Why are you restoring?
                <input
                  value={portableReason}
                  onChange={(event) => setPortableReason(event.target.value)}
                  placeholder="Required audit reason"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => void handlePortableRestore()}
                disabled={portableRestoring || portableExporting || !portableFile}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portableRestoring ? "Restoring..." : "Restore package"}
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              Restore is admin-only and replaces current CRM data and uploads. A database restore point is created first; the prior uploads directory is retained on the server as a recovery copy until the restore is verified.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Backup Scopes</h2>
            <p className="mt-1 text-xs text-slate-600">Module scope options: {moduleScopes.join(", ")}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((scope) => (
                    <tr key={scope.scope} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">{scope.label}</td>
                      <td className="py-2 pr-3"><StatusChip status={scope.status} /></td>
                      <td className="py-2 text-slate-700">{scope.reason ?? "Implemented in current workspace."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Scheduled Policies</h2>
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-medium text-slate-700">
                  Policy Name
                  <input
                    value={newPolicyName}
                    onChange={(event) => setNewPolicyName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Scope
                  <select
                    value={newPolicyScope}
                    onChange={(event) => setNewPolicyScope(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {coverage.map((scope) => (
                      <option key={scope.scope} value={scope.scope}>{scope.scope}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Cron Expression
                  <input
                    value={newPolicyCron}
                    onChange={(event) => setNewPolicyCron(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Retention Days
                  <input
                    value={newPolicyRetention}
                    onChange={(event) => setNewPolicyRetention(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleCreatePolicy()}
                  disabled={busyAction !== null}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create Policy
                </button>
              </div>

              <ul className="mt-3 space-y-2">
                {policies.length === 0 ? (
                  <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No policies configured.</li>
                ) : (
                  policies.map((policy) => (
                    <li key={policy.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{policy.policyName}</p>
                        <StatusChip status={policy.enabled ? "Working" : "Partially Working"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{policy.backupScope} • {policy.cronExpression} • Retention {policy.retentionDays} days</p>
                      <button
                        type="button"
                        onClick={() => void handleTogglePolicy(policy)}
                        disabled={busyAction !== null}
                        className="mt-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {policy.enabled ? "Disable" : "Enable"}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Backup History</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                      <th className="py-2 pr-3">Backup</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Verification</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={4}>No backups available.</td>
                      </tr>
                    ) : (
                      backups.map((backup) => {
                        const verification = verificationMap.get(backup.id);
                        return (
                          <tr key={backup.id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-900">
                              <p className="font-medium">{backup.label}</p>
                              <p className="text-xs text-slate-500">{backup.id}</p>
                            </td>
                            <td className="py-2 pr-3 text-slate-700">{new Date(backup.createdAt).toLocaleString()}</td>
                            <td className="py-2 pr-3">
                              {verification ? <StatusChip status={verification.status === "VERIFIED" ? "Working" : verification.status === "FAILED" ? "Broken" : "Partially Working"} /> : <StatusChip status="Not Implemented" />}
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => void handleVerifyBackup(backup.id)}
                                disabled={busyAction !== null}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Verify
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Verification Results</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Backup ID</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Checksum</th>
                    <th className="py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={4}>No verification records yet.</td>
                    </tr>
                  ) : (
                    verifications.slice(0, 20).map((verification) => (
                      <tr key={verification.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{verification.backupId}</td>
                        <td className="py-2 pr-3"><StatusChip status={verification.status === "VERIFIED" ? "Working" : verification.status === "FAILED" ? "Broken" : "Partially Working"} /></td>
                        <td className="py-2 pr-3 text-slate-700">{verification.checksumMatches === null ? "n/a" : verification.checksumMatches ? "match" : "mismatch"}</td>
                        <td className="py-2 text-slate-700">{new Date(verification.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {failedVerifications.length > 0 ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {failedVerifications.length} failed verification job(s) need review before restore execution.
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
