// Restore center for guarded recovery workflows.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  executeWatchdogRestore,
  fetchWatchdogRestoreJobs,
  fetchWatchdogRestorePoints,
  runWatchdogRestoreDryRun,
} from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogRestoreJob, WatchdogRestorePoint } from "@/app/components/watchdog/ops/types";

/** Renders restore point inspection, dry-run risk review, and guarded execution flow. */
export default function WatchdogRestorePage() {
  const [restorePoints, setRestorePoints] = useState<WatchdogRestorePoint[]>([]);
  const [jobs, setJobs] = useState<WatchdogRestoreJob[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const [lastDryRun, setLastDryRun] = useState<{
    id: string;
    status: string;
    riskLevel: string;
    warnings: string[];
    createdAt: string;
  } | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [reason, setReason] = useState("Emergency recovery validation");
  const [useBreakGlass, setUseBreakGlass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPoint = useMemo(() => {
    return restorePoints.find((point) => point.id === selectedBackupId) ?? null;
  }, [restorePoints, selectedBackupId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [points, restoreJobs] = await Promise.all([
        fetchWatchdogRestorePoints(),
        fetchWatchdogRestoreJobs(),
      ]);
      setRestorePoints(points);
      setJobs(restoreJobs);
      if (!selectedBackupId && points[0]) {
        setSelectedBackupId(points[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load restore workspace.");
    } finally {
      setLoading(false);
    }
  }, [selectedBackupId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleDryRun() {
    if (!selectedBackupId) return;
    setBusyAction("dry-run");
    setError(null);
    setMessage(null);
    try {
      const response = await runWatchdogRestoreDryRun(selectedBackupId);
      setLastDryRun(response.dryRun);
      setMessage(`Dry-run result: ${response.dryRun.status} (${response.dryRun.riskLevel}).`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dry-run request failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExecuteRestore() {
    if (!selectedBackupId || !lastDryRun) return;
    setBusyAction("execute");
    setError(null);
    setMessage(null);
    try {
      const response = await executeWatchdogRestore({
        backupId: selectedBackupId,
        dryRunId: lastDryRun.id,
        confirmationText,
        reason,
        breakGlass: useBreakGlass,
      });
      setMessage(`Restore job ${response.restoreJobId} completed. Pre-restore backup: ${response.preRestoreBackupId ?? "none"}.`);
      setLastDryRun(null);
      setConfirmationText("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Restore execution failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Restore Center"
        description="Dry-run-first restore workflow with typed confirmation, pre-restore backup, and audited execution."
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading restore workspace...</div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Restore Points</h2>
              <div className="mt-3 space-y-2">
                {restorePoints.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No restore points available.</p>
                ) : (
                  restorePoints.map((point) => (
                    <button
                      key={point.id}
                      type="button"
                      onClick={() => {
                        setSelectedBackupId(point.id);
                        setLastDryRun(null);
                        setConfirmationText("");
                      }}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                        point.id === selectedBackupId
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                        <StatusChip status={point.verificationStatus === "VERIFIED" ? "Working" : point.verificationStatus === "FAILED" ? "Broken" : "Partially Working"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">Created {new Date(point.createdAt).toLocaleString()}</p>
                      {point.blockedReason ? (
                        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">{point.blockedReason}</p>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Restore Dry-Run</h2>
              {selectedPoint ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    Selected restore point: <span className="font-semibold">{selectedPoint.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Primary rows: {selectedPoint.primaryRowCount.toLocaleString()} • Watchdog rows: {selectedPoint.watchdogRowCount.toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDryRun()}
                    disabled={busyAction !== null}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Run Restore Dry-Run
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Select a restore point first.</p>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Risk Report</p>
                {lastDryRun ? (
                  <>
                    <p className="mt-1 text-sm text-slate-900">Status: {lastDryRun.status}</p>
                    <p className="text-sm text-slate-900">Risk level: {lastDryRun.riskLevel}</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {lastDryRun.warnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No dry-run has been executed for the current selection.</p>
                )}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Execute Restore</h2>
            <p className="mt-1 text-sm text-slate-700">
              Restore execution requires a passing dry-run, typed confirmation, and automatically creates a pre-restore backup.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700">
                Type restore point label or ID to confirm
                <input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder={selectedPoint ? selectedPoint.label : "Restore point label"}
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Reason
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Incident reason"
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={useBreakGlass}
                onChange={(event) => setUseBreakGlass(event.target.checked)}
              />
              Use break-glass mode (only when verification failed and permission allows)
            </label>

            <button
              type="button"
              onClick={() => void handleExecuteRestore()}
              disabled={
                busyAction !== null
                || !selectedPoint
                || !lastDryRun
                || lastDryRun.status !== "DRY_RUN_PASSED"
                || !confirmationText.trim()
                || !reason.trim()
              }
              className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Execute Restore
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Restore Jobs</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={4}>No restore jobs yet.</td>
                    </tr>
                  ) : (
                    jobs.slice(0, 20).map((job) => (
                      <tr key={job.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-800">{job.id}</td>
                        <td className="py-2 pr-3"><StatusChip status={job.status === "COMPLETED" ? "Working" : job.status === "FAILED" ? "Broken" : "Partially Working"} /></td>
                        <td className="py-2 pr-3 text-slate-700">{job.riskLevel}</td>
                        <td className="py-2 text-slate-700">{new Date(job.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
