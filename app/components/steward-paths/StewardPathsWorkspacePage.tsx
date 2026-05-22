/** Canonical saved visual Steward Paths workspace list with production actions. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StewardPathTemplate["status"]>("all");
  const [sortMode, setSortMode] = useState<"updated" | "name" | "steps" | "enrollments">("updated");

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
  const pausedCount = useMemo(() => items.filter((item) => item.status === "PAUSED").length, [items]);
  const draftCount = useMemo(() => items.filter((item) => item.status === "DRAFT").length, [items]);
  const enrollmentCount = useMemo(
    () => items.reduce((total, item) => total + (item._count?.enrollments ?? 0), 0),
    [items],
  );
  const visibleItems = useMemo(
    () => {
      const filtered = items
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;

        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return true;

        return item.name.toLowerCase().includes(needle)
          || (item.description ?? "").toLowerCase().includes(needle)
          || item.triggerType.toLowerCase().includes(needle)
          || item.targetType.toLowerCase().includes(needle)
          || item.crmScope.toLowerCase().includes(needle);
      });

      return filtered.sort((a, b) => {
        if (sortMode === "name") return a.name.localeCompare(b.name);
        if (sortMode === "steps") return b.steps.length - a.steps.length;
        if (sortMode === "enrollments") return (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    },
    [items, searchQuery, sortMode, statusFilter],
  );

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
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Steward Paths", href: "/steward-paths" },
          { label: "Saved Visual Paths" },
        ]}
        metadata={`${items.length} total paths · ${visibleItems.length} shown · ${activeCount} active`}
        primaryAction={(
          <Link href="/steward-paths/builder" className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
            New Path
          </Link>
        )}
        overflowActions={(
          <button type="button" onClick={() => void load()} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Refresh
          </button>
        )}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Library">
          <WorkspaceRibbonButton
            label="Saved Paths"
            onClick={() => setStatusFilter("all")}
            variant={statusFilter === "all" ? "primary" : "secondary"}
          />
          <WorkspaceRibbonButton
            label="Active Only"
            onClick={() => setStatusFilter("ACTIVE")}
            variant={statusFilter === "ACTIVE" ? "primary" : "secondary"}
          />
          <WorkspaceRibbonButton
            label="Paused"
            onClick={() => setStatusFilter("PAUSED")}
            variant={statusFilter === "PAUSED" ? "primary" : "secondary"}
          />
          <WorkspaceRibbonButton
            label="Archived"
            onClick={() => setStatusFilter("ARCHIVED")}
            variant={statusFilter === "ARCHIVED" ? "primary" : "secondary"}
          />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="New Path" href="/steward-paths/builder" variant="primary" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="New From Template">
          <WorkspaceRibbonButton label="Donor Welcome" href="/steward-paths/builder?quickStart=donor-welcome" />
          <WorkspaceRibbonButton label="Lapsed Reengage" href="/steward-paths/builder?quickStart=lapsed-reengagement" />
          <WorkspaceRibbonButton label="Event Follow-up" href="/steward-paths/builder?quickStart=event-follow-up" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Run">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void load()} />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Help">
          <WorkspaceRibbonButton label="How Paths Work" href="/help?scope=steward-paths" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">Project library</p>
              <p className="text-xs text-gray-500">Search, sort, and manage saved workflow projects.</p>
            </div>
            <span className="text-xs text-gray-500">Sorted by most recently updated</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_180px_180px]">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name, trigger, target, CRM scope"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="updated">Recently updated</option>
                <option value="name">Name</option>
                <option value="steps">Most steps</option>
                <option value="enrollments">Most enrollments</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-900">New from template quick-start</p>
          <p className="mt-1 text-xs text-emerald-800">Open the builder with a pre-wired starter flow.</p>
          <div className="mt-3 grid gap-2">
            <Link href="/steward-paths/builder?quickStart=donor-welcome" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
              <span className="block">Donor Welcome Journey</span>
              <span className="mt-0.5 block font-normal text-emerald-700">Gift trigger, delay, email draft, welcome task</span>
            </Link>
            <Link href="/steward-paths/builder?quickStart=lapsed-reengagement" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
              <span className="block">Lapsed Reengagement Journey</span>
              <span className="mt-0.5 block font-normal text-emerald-700">Lapsed trigger, amount branch, review task</span>
            </Link>
            <Link href="/steward-paths/builder?quickStart=event-follow-up" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
              <span className="block">Event Follow-up Journey</span>
              <span className="mt-0.5 block font-normal text-emerald-700">Attendance trigger, email, letter follow-up</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        <button type="button" onClick={() => setStatusFilter("all")} className={`rounded-lg border px-3 py-2 text-left ${statusFilter === "all" ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{items.length}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter("ACTIVE")} className={`rounded-lg border px-3 py-2 text-left ${statusFilter === "ACTIVE" ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{activeCount}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter("DRAFT")} className={`rounded-lg border px-3 py-2 text-left ${statusFilter === "DRAFT" ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{draftCount}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter("PAUSED")} className={`rounded-lg border px-3 py-2 text-left ${statusFilter === "PAUSED" ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paused</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{pausedCount}</p>
        </button>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enrollments</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{enrollmentCount}</p>
        </div>
      </section>

      {message && <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading paths...</div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">No saved visual paths found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="min-w-[1010px]">
          <div className="grid grid-cols-[minmax(260px,1.5fr)_110px_110px_110px_160px_260px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Workflow</span>
            <span>Status</span>
            <span>Steps</span>
            <span>Enrollments</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {visibleItems.map((item) => {
            const shareState = parseShareSettings(item.triggerConfig);
            const unsupportedStepCount = item.steps.filter((step) => step.stepType === "MANUAL_ACTION").length;
            return (
              <article key={item.id} className="grid grid-cols-[minmax(260px,1.5fr)_110px_110px_110px_160px_260px] gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-gray-900">{item.name}</h2>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{shareState.visibility}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-600">{item.description || "No description"}</p>
                  <p className="mt-1 text-[11px] text-gray-500">Trigger: {item.triggerType || "MANUAL"} · Target: {item.targetType} · CRM: {item.crmScope}</p>
                  {unsupportedStepCount > 0 && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      {unsupportedStepCount} manual/safety step{unsupportedStepCount > 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                <div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-900">{item.steps.length}</div>
                <div className="text-sm font-semibold text-gray-900">{item._count?.enrollments ?? 0}</div>
                <div className="text-xs text-gray-600">{formatDate(item.updatedAt)}</div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/steward-paths/builder/${encodeURIComponent(item.id)}`} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    Edit
                  </Link>
                  <button type="button" disabled={busyId === item.id} onClick={() => void runTest(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Test
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void toggleStatus(item)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {item.status === "ACTIVE" ? "Disable" : "Enable"}
                  </button>
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
                    History
                  </Link>
                </div>
              </article>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
