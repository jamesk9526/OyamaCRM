/** Canonical saved visual Steward Paths workspace list with production actions. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathTemplate {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  triggerType: string;
  targetType: string;
  crmScope: string;
  updatedAt: string;
  createdAt: string;
  steps: Array<{ id: string; stepType: string; isActive: boolean }>;
  _count?: { enrollments: number };
  triggerConfig?: Record<string, unknown> | null;
}

interface ShareSettings {
  visibility: "private" | "organization" | "admins";
  ownerUserId: string | null;
  allowRun: boolean;
  allowEdit: boolean;
}

function parseShareSettings(triggerConfig: Record<string, unknown> | null | undefined): ShareSettings {
  const empty: ShareSettings = {
    visibility: "private",
    ownerUserId: null,
    allowRun: false,
    allowEdit: false,
  };
  if (!triggerConfig || typeof triggerConfig !== "object" || Array.isArray(triggerConfig)) return empty;
  const sharing = triggerConfig._sharing;
  if (!sharing || typeof sharing !== "object" || Array.isArray(sharing)) return empty;
  const obj = sharing as Record<string, unknown>;
  const visibility = obj.visibility;
  return {
    visibility: visibility === "organization" || visibility === "admins" ? visibility : "private",
    ownerUserId: typeof obj.ownerUserId === "string" ? obj.ownerUserId : null,
    allowRun: obj.allowRun === true,
    allowEdit: obj.allowEdit === true,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString();
}

function statusTone(status: StewardPathTemplate["status"]): string {
  if (status === "ACTIVE") return "bg-green-100 text-green-700";
  if (status === "PAUSED") return "bg-amber-100 text-amber-700";
  if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
  return "bg-gray-100 text-gray-700";
}

export default function StewardPathsWorkspacePage() {
  const [items, setItems] = useState<StewardPathTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates");
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Steward Paths.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => items.filter((item) => item.status === "ACTIVE").length, [items]);

  async function toggleStatus(item: StewardPathTemplate): Promise<void> {
    setBusyId(item.id);
    try {
      const nextStatus = item.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await apiFetch(`/api/steward-paths/templates/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage(nextStatus === "ACTIVE" ? "Path enabled." : "Path paused.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runTest(item: StewardPathTemplate): Promise<void> {
    const constituentId = window.prompt("Enter a constituent ID for test run:")?.trim();
    if (!constituentId) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/api/steward-paths/templates/${item.id}/test-run`, {
        method: "POST",
        body: JSON.stringify({ constituentId }),
      });
      setMessage("Test run created as safe test enrollment.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function archive(item: StewardPathTemplate): Promise<void> {
    if (!window.confirm("Archive this path? It will be hidden from default active workflows.")) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/api/steward-paths/templates/${item.id}`, { method: "DELETE" });
      setMessage("Path archived.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(item: StewardPathTemplate): Promise<void> {
    setBusyId(item.id);
    try {
      await apiFetch(`/api/steward-paths/templates/${item.id}/duplicate`, { method: "POST" });
      setMessage("Path duplicated.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function share(item: StewardPathTemplate): Promise<void> {
    const current = parseShareSettings(item.triggerConfig);
    const picked = window.prompt(
      "Share visibility: private | organization | admins",
      current.visibility,
    )?.trim().toLowerCase();
    if (!picked) return;
    if (picked !== "private" && picked !== "organization" && picked !== "admins") {
      setMessage("Share update canceled: invalid visibility value.");
      return;
    }

    setBusyId(item.id);
    try {
      await apiFetch(`/api/steward-paths/templates/${item.id}/share`, {
        method: "PATCH",
        body: JSON.stringify({ visibility: picked, allowRun: true, allowEdit: picked === "organization" }),
      });
      setMessage("Sharing updated.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-xl border border-green-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Saved Visual Paths</h1>
            <p className="text-sm text-gray-600">
              Canonical Steward Paths workspace for build, run, and governance operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/steward-paths/builder" className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
              New Visual Path
            </Link>
            <button type="button" onClick={() => void load()} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          {items.length} total paths · {activeCount} active
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Legacy /automations builder is deprecated. Use this workspace for all new and edited Steward Paths.
      </div>

      {message && <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading paths...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">No saved visual paths found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const shareState = parseShareSettings(item.triggerConfig);
            const unsupportedStepCount = item.steps.filter((step) => step.stepType === "MANUAL_ACTION").length;
            return (
              <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{item.name}</h2>
                    <p className="mt-1 text-xs text-gray-600">{item.description || "No description"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Trigger: {item.triggerType || "MANUAL"}</div>
                  <div>CRM: {item.crmScope}</div>
                  <div>Target: {item.targetType}</div>
                  <div>Steps: {item.steps.length}</div>
                  <div>Enrollments: {item._count?.enrollments ?? 0}</div>
                  <div>Last edited: {formatDate(item.updatedAt)}</div>
                  <div>Last run: Unavailable</div>
                  <div>Share: {shareState.visibility}</div>
                </div>

                {unsupportedStepCount > 0 && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    Contains {unsupportedStepCount} manual/safety step(s). Activation and run behavior may be partially working.
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/steward-paths/builder/${encodeURIComponent(item.id)}`} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    Edit workflow
                  </Link>
                  <button type="button" disabled={busyId === item.id} onClick={() => void runTest(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Test run
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void toggleStatus(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {item.status === "ACTIVE" ? "Disable" : "Enable"}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === item.id} onClick={() => void share(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Share
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void duplicate(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Duplicate
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void archive(item)} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">
                    Archive
                  </button>
                  <Link href={`/steward-paths/${encodeURIComponent(item.id)}/history`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    View run history
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
