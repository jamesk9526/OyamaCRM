/**
 * SettingsRecoveryPanel — shows available setup snapshots and lets admins restore from them.
 * Displayed in Settings → Security/Recovery. Snapshots are created automatically before resets.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

/** Shape of a snapshot summary returned by GET /api/setup/snapshots */
interface SnapshotRecord {
  id: string;
  label: string;
  createdAt: string;
  restoredAt: string | null;
}

/** Format an ISO timestamp into a readable locale date string. */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * SettingsRecoveryPanel lists all saved setup snapshots (newest first)
 * and allows admins to restore the CRM from one — but only when the DB
 * has been reset to an empty state first.
 */
export default function SettingsRecoveryPanel() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  /** Load all snapshots from the API. */
  async function loadSnapshots() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ snapshots: SnapshotRecord[] }>("/api/setup/snapshots");
      setSnapshots(data.snapshots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadSnapshots();
    else setLoading(false);
  }, [isAdmin]);

  /** Create a manual snapshot of the current org state. */
  async function createSnapshot() {
    setSnapshotting(true);
    setError(null);
    try {
      await apiFetch("/api/setup/snapshot", {
        method: "POST",
        body: JSON.stringify({ label: `Manual snapshot — ${new Date().toLocaleString()}` }),
      });
      setSuccessMsg("Snapshot created successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create snapshot");
    } finally {
      setSnapshotting(false);
    }
  }

  /** Restore the CRM from a specific snapshot. Only works post-reset. */
  async function restore(id: string) {
    if (
      !window.confirm(
        "Are you sure you want to restore from this snapshot?\n\nThis will recreate the organization and users. Only works when the CRM has been reset to an empty state first."
      )
    ) return;

    setRestoring(id);
    setError(null);
    try {
      await apiFetch(`/api/setup/restore/${id}`, { method: "POST" });
      setSuccessMsg("Restore complete. Users will need to reset their passwords on next login.");
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore from snapshot");
    } finally {
      setRestoring(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Only admins can view and restore from recovery snapshots.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Recovery Snapshots</h2>
          <p className="text-sm text-gray-500 mt-1">
            Snapshots are created automatically before every CRM reset. You can also create one manually below.
            To restore, reset the CRM first, then use the restore button.
          </p>
        </div>
        <button
          type="button"
          onClick={createSnapshot}
          disabled={snapshotting}
          className="flex-shrink-0 ml-4 inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {snapshotting ? "Creating…" : "Create snapshot now"}
        </button>
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Snapshot list */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading snapshots…</p>
      ) : snapshots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
          <p className="text-sm text-gray-500">No snapshots yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            A snapshot is automatically created before every reset. You can also create one manually above.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {snapshots.map((snap) => (
            <div key={snap.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{snap.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {formatDate(snap.createdAt)}
                  {snap.restoredAt && (
                    <span className="ml-3 text-blue-500">
                      ↩ Restored {formatDate(snap.restoredAt)}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(snap.id)}
                disabled={restoring === snap.id}
                className="ml-4 flex-shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {restoring === snap.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Restore instructions */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">How to restore:</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Use "Reset CRM and rerun setup" above to wipe the current installation.</li>
          <li>Log back in using any account if prompted, or navigate to /setup.</li>
          <li>Come back here and click Restore on the snapshot you want.</li>
          <li>Users will need to reset their passwords — a placeholder password is assigned.</li>
        </ol>
      </div>
    </section>
  );
}
