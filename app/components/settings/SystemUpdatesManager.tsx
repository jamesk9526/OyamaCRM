"use client";

/**
 * SystemUpdatesManager renders admin controls for release checks,
 * install/rollback actions, maintenance mode, and update history.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type UpdateChannel = "stable" | "beta";
type UpdateStepStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

type UpdateRunStatus = "QUEUED" | "RUNNING" | "FAILED" | "ROLLED_BACK" | "COMPLETED";

interface SystemReleaseSummary {
  tagName: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  notes: string;
}

interface UpdateStepRecord {
  id: string;
  key: string;
  label: string;
  status: UpdateStepStatus;
  command: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

interface UpdateRunRecord {
  id: string;
  type: "INSTALL" | "ROLLBACK";
  requestedVersion: string;
  installedVersion: string | null;
  previousVersion: string | null;
  status: UpdateRunStatus;
  requestedByUserId: string;
  requestedByEmail: string;
  releaseNotes: string | null;
  startedAt: string;
  finishedAt: string | null;
  failureStep: string | null;
  failureMessage: string | null;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  steps: UpdateStepRecord[];
  logs: string[];
}

interface ActiveUpdateJob {
  id: string;
  type: "INSTALL" | "ROLLBACK";
  targetVersion: string;
  status: "QUEUED" | "RUNNING";
  startedAt: string;
  requestedByUserId: string;
  requestedByEmail: string;
}

interface SystemUpdateStatusResponse {
  currentVersion: string;
  maintenanceMode: boolean;
  selectedChannel: UpdateChannel;
  latestRelease: SystemReleaseSummary | null;
  latestCheckedAt: string | null;
  updateConfigured: boolean;
  executionEnabled: boolean;
  activeJob: ActiveUpdateJob | null;
  lastRun: UpdateRunRecord | null;
  backupStatus: UpdateStepStatus | null;
  migrationStatus: UpdateStepStatus | null;
  smokeStatus: UpdateStepStatus | null;
}

interface ReleasesResponse {
  channel: UpdateChannel;
  releases: SystemReleaseSummary[];
  latestRelease: SystemReleaseSummary | null;
  checkedAt: string;
  sourceConfigured: boolean;
}

interface HistoryResponse {
  items: UpdateRunRecord[];
}

function statusClass(status: UpdateStepStatus | UpdateRunStatus | null): string {
  if (!status) return "text-gray-500 bg-gray-100";
  if (status === "SUCCESS" || status === "COMPLETED") return "text-green-700 bg-green-100";
  if (status === "RUNNING" || status === "QUEUED") return "text-blue-700 bg-blue-100";
  if (status === "FAILED") return "text-red-700 bg-red-100";
  if (status === "ROLLED_BACK") return "text-orange-700 bg-orange-100";
  if (status === "SKIPPED") return "text-gray-700 bg-gray-200";
  return "text-gray-700 bg-gray-100";
}

function formatIso(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function SystemUpdatesManager() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<SystemUpdateStatusResponse | null>(null);
  const [releases, setReleases] = useState<SystemReleaseSummary[]>([]);
  const [history, setHistory] = useState<UpdateRunRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  const activeJob = status?.activeJob ?? null;
  const latestRelease = status?.latestRelease ?? releases[0] ?? null;

  const load = useCallback(async (refreshReleases = false) => {
    setError(null);

    try {
      const [statusPayload, releasePayload, historyPayload] = await Promise.all([
        apiFetch<SystemUpdateStatusResponse>("/api/system-updates/status"),
        apiFetch<ReleasesResponse>(`/api/system-updates/releases?refresh=${refreshReleases ? "true" : "false"}`),
        apiFetch<HistoryResponse>("/api/system-updates/history?limit=15"),
      ]);

      setStatus(statusPayload);
      setReleases(releasePayload.releases);
      setHistory(historyPayload.items);
      setSelectedVersion((current) => current || releasePayload.latestRelease?.tagName || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system updates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => {
      void load(false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeJob, load]);

  const installDisabled = useMemo(() => {
    if (busy || loading) return true;
    if (!status) return true;
    if (Boolean(status.activeJob)) return true;
    if (!selectedVersion) return true;
    return false;
  }, [busy, loading, selectedVersion, status]);

  const rollbackDisabled = useMemo(() => {
    if (busy || loading) return true;
    if (!status) return true;
    if (Boolean(status.activeJob)) return true;
    return false;
  }, [busy, loading, status]);

  async function installUpdate() {
    if (!selectedVersion) {
      setError("Choose a release version before installing.");
      return;
    }

    const confirmed = window.confirm(`Install update ${selectedVersion}?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ accepted: boolean; runId: string; version: string }>("/api/system-updates/install", {
        method: "POST",
        body: JSON.stringify({ version: selectedVersion }),
      });
      setSuccess(`Update ${selectedVersion} was queued.`);
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install request failed");
    } finally {
      setBusy(false);
    }
  }

  async function rollbackUpdate() {
    const confirmed = window.confirm("Run rollback to the last known-good version?");
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ accepted: boolean; runId: string; version: string }>("/api/system-updates/rollback", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSuccess("Rollback was queued.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback request failed");
    } finally {
      setBusy(false);
    }
  }

  async function setMaintenance(enabled: boolean) {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ enabled: boolean }>("/api/system-updates/maintenance", {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      setSuccess(enabled ? "Maintenance mode enabled." : "Maintenance mode disabled.");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change maintenance mode");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Loading update manager...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Version</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{status?.currentVersion ?? "-"}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest Release</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{latestRelease?.tagName ?? "Not available"}</p>
          <p className="mt-1 text-xs text-gray-500">Checked: {formatIso(status?.latestCheckedAt)}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Maintenance</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status?.maintenanceMode ? "RUNNING" : "SKIPPED")}`}>
              {status?.maintenanceMode ? "Enabled" : "Disabled"}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Execution Mode</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status?.executionEnabled ? "SUCCESS" : "SKIPPED")}`}>
              {status?.executionEnabled ? "Live execution" : "Dry run"}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">Source configured: {status?.updateConfigured ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Install Update</h2>
            <p className="text-sm text-gray-500">Choose a release tag and run backup, build, migrate, restart, and smoke checks.</p>
          </div>
          {activeJob && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100">
              Active job: {activeJob.type} {activeJob.targetVersion}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <select
            value={selectedVersion}
            onChange={(event) => setSelectedVersion(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
          >
            <option value="">Select release</option>
            {releases.map((release) => (
              <option key={release.tagName} value={release.tagName}>
                {release.tagName} {release.prerelease ? "(beta)" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Refresh Releases
          </button>

          <button
            type="button"
            onClick={() => void installUpdate()}
            disabled={installDisabled}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Install Update
          </button>
        </div>

        {latestRelease?.notes && (
          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Latest release notes</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{latestRelease.notes}</pre>
          </details>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Operations</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void rollbackUpdate()}
            disabled={rollbackDisabled}
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60"
          >
            Rollback Last Failed Update
          </button>

          <button
            type="button"
            onClick={() => void setMaintenance(true)}
            disabled={busy || status?.maintenanceMode === true}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Enable Maintenance Mode
          </button>

          <button
            type="button"
            onClick={() => void setMaintenance(false)}
            disabled={busy || status?.maintenanceMode === false}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Disable Maintenance Mode
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Backup Step</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status?.backupStatus ?? null)}`}>
              {status?.backupStatus ?? "-"}
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Migration Step</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status?.migrationStatus ?? null)}`}>
              {status?.migrationStatus ?? "-"}
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Smoke Test Step</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status?.smokeStatus ?? null)}`}>
              {status?.smokeStatus ?? "-"}
            </span>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {error ?? success}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Update History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No update activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 pr-3">Run</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Requested</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">By</th>
                  <th className="py-2 pr-3">Started</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 text-gray-700 font-mono text-xs">{item.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3 text-gray-700">{item.type}</td>
                    <td className="py-2 pr-3 text-gray-700">{item.requestedVersion}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{item.requestedByEmail || "-"}</td>
                    <td className="py-2 pr-3 text-gray-600">{formatIso(item.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
