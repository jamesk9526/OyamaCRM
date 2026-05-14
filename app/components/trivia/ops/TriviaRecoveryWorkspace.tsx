"use client";

import { useMemo, useState } from "react";
import type {
  TriviaConnectionStatus,
  TriviaEvent,
  TriviaEventAuditEvent,
  TriviaEventSnapshot,
  TriviaLiveState,
  TriviaScoreAction,
} from "@/app/apps/trivia/lib/trivia-types";
import type { TriviaSyncMode } from "@/app/apps/trivia/lib/trivia-state-provider";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaRecoveryWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
  syncMode: TriviaSyncMode;
  connectionStatus: TriviaConnectionStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  snapshots: TriviaEventSnapshot[];
  auditEntries: TriviaEventAuditEvent[];
  onSetSyncMode: (mode: TriviaSyncMode) => void;
  onRefreshFromServer: () => Promise<void>;
  onCreateSnapshot: (label: string) => Promise<TriviaEventSnapshot>;
  onLoadSnapshots: () => Promise<TriviaEventSnapshot[]>;
  onRecoverSnapshot: (snapshotId: string) => Promise<void>;
  onLoadAudit: () => Promise<TriviaEventAuditEvent[]>;
  onExportState: () => string;
  onImportJson: (json: string) => { ok: boolean; message: string };
}

function connectionTone(status: TriviaConnectionStatus): string {
  if (status === "connected") return "text-emerald-200 border-emerald-500/50 bg-emerald-500/15";
  if (status === "reconnecting") return "text-amber-200 border-amber-500/50 bg-amber-500/15";
  return "text-rose-200 border-rose-500/50 bg-rose-500/15";
}

/** Recovery center for snapshots, sync mode switching, and operational audit review. */
export default function TriviaRecoveryWorkspace({
  event,
  live,
  scoreHistory,
  syncMode,
  connectionStatus,
  lastSyncedAt,
  syncError,
  snapshots,
  auditEntries,
  onSetSyncMode,
  onRefreshFromServer,
  onCreateSnapshot,
  onLoadSnapshots,
  onRecoverSnapshot,
  onLoadAudit,
  onExportState,
  onImportJson,
}: TriviaRecoveryWorkspaceProps) {
  const [snapshotLabel, setSnapshotLabel] = useState("Night-of checkpoint");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const newestSnapshot = useMemo(() => snapshots[0] ?? null, [snapshots]);

  async function runTask(task: () => Promise<void>) {
    setIsBusy(true);
    try {
      await task();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Recovery operation failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function downloadStatePackage() {
    const payload = onExportState();
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${event.id}-state-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("State package exported.");
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    const content = await file.text();
    const result = onImportJson(content);
    setStatusMessage(result.message);
  }

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Sync And Persistence Controls</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSetSyncMode("local")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${syncMode === "local" ? "bg-cyan-600 text-white" : "border border-slate-500 text-slate-200"}`}
            >
              Local Mode
            </button>
            <button
              type="button"
              onClick={() => onSetSyncMode("server")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${syncMode === "server" ? "bg-emerald-600 text-white" : "border border-slate-500 text-slate-200"}`}
            >
              Server Mode
            </button>
            <button
              type="button"
              disabled={isBusy || syncMode !== "server"}
              onClick={() => runTask(async () => {
                await onRefreshFromServer();
                setStatusMessage("Refreshed state from server.");
              })}
              className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-50"
            >
              Pull Latest Server State
            </button>
            <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${connectionTone(connectionStatus)}`}>
              {connectionStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-300">Last sync: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Not synced yet"}</p>
          {syncError ? <p className="mt-1 text-xs text-rose-300">{syncError}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <h2 className="text-sm font-semibold text-white">Import / Export</h2>
          <div className="mt-2 flex flex-col gap-2">
            <button type="button" onClick={downloadStatePackage} className="rounded-md bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600">
              Export Full State JSON
            </button>
            <label className="rounded-md border border-slate-500 px-3 py-1.5 text-xs text-slate-100 cursor-pointer hover:bg-slate-800">
              Import State JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(eventInput) => {
                  const file = eventInput.target.files?.[0] ?? null;
                  void handleImportFile(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Snapshots</h2>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => runTask(async () => {
                await onLoadSnapshots();
                setStatusMessage("Snapshots reloaded.");
              })}
              className="rounded border border-slate-500 px-2 py-1 text-[11px] text-slate-100"
            >
              Refresh
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={snapshotLabel}
              onChange={(eventInput) => setSnapshotLabel(eventInput.target.value)}
              placeholder="Snapshot label"
              className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => runTask(async () => {
                await onCreateSnapshot(snapshotLabel.trim() || "Manual snapshot");
                await onLoadSnapshots();
                setStatusMessage("Snapshot created.");
              })}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Capture
            </button>
          </div>

          <div className="mt-2 max-h-[260px] overflow-auto space-y-1 pr-1">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-md border border-slate-700 bg-slate-950/70 p-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-100">{snapshot.label}</p>
                  <p className="text-[11px] text-slate-400">{new Date(snapshot.capturedAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => runTask(async () => {
                    await onRecoverSnapshot(snapshot.id);
                    setStatusMessage(`Recovered snapshot: ${snapshot.label}`);
                  })}
                  className="rounded border border-rose-500/60 bg-rose-500/20 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  Recover
                </button>
              </div>
            ))}
            {snapshots.length === 0 ? <p className="text-xs text-slate-400">No snapshots yet.</p> : null}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Newest snapshot: {newestSnapshot ? newestSnapshot.label : "None"}</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Audit Timeline</h2>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => runTask(async () => {
                await onLoadAudit();
                setStatusMessage("Audit timeline refreshed.");
              })}
              className="rounded border border-slate-500 px-2 py-1 text-[11px] text-slate-100"
            >
              Refresh
            </button>
          </div>

          <div className="mt-2 max-h-[340px] overflow-auto space-y-1 pr-1">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="rounded-md border border-slate-700 bg-slate-950/70 p-2">
                <p className="text-xs text-slate-100">[{entry.type}] {entry.message}</p>
                <p className="text-[11px] text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {auditEntries.length === 0 ? <p className="text-xs text-slate-400">No audit entries yet.</p> : null}
          </div>
        </div>
      </div>

      {statusMessage ? <p className="text-xs text-slate-200">{statusMessage}</p> : null}
    </section>
  );
}
