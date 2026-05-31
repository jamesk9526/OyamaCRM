/** Path Library surface aligned to Steward Paths command-center workflow. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface StewardEnrollment {
  id: string;
  status: string;
  pathId: string;
  updatedAt: string;
  startedAt: string;
}

type StatusFilter = "all" | StewardPathTemplate["status"];
type OwnerFilter = "all" | "private" | "shared";
type SortMode = "updated" | "name" | "enrollments";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString();
}

function percentage(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function statusPill(status: StewardPathTemplate["status"]): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "PAUSED") return "bg-amber-100 text-amber-800";
  if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
  return "bg-blue-100 text-blue-800";
}

function readVisibility(item: StewardPathTemplate): "private" | "organization" | "admins" {
  const cfg = item.triggerConfig;
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return "private";
  const sharing = (cfg as Record<string, unknown>)._sharing;
  if (!sharing || typeof sharing !== "object" || Array.isArray(sharing)) return "private";
  const visibility = (sharing as Record<string, unknown>).visibility;
  if (visibility === "organization" || visibility === "admins") return visibility;
  return "private";
}

interface PathRowActionsMenuProps {
  path: StewardPathTemplate;
  busy: boolean;
  onActivate: () => void;
  onPause: () => void;
  onDuplicate: () => void;
  onTestRun: () => void;
  onDelete: () => void;
}

function PathRowActionsMenu({
  path,
  busy,
  onActivate,
  onPause,
  onDuplicate,
  onTestRun,
  onDelete,
}: PathRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  function runAction(handler: () => void) {
    if (busy) return;
    setOpen(false);
    handler();
  }

  const itemClass = "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${path.name}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5h.01M12 12h.01M12 19h.01" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-200/70" role="menu">
          <Link
            href={`/steward-paths/${encodeURIComponent(path.id)}/history`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            View Activity
          </Link>
          <Link
            href={`/steward-paths/builder/${encodeURIComponent(path.id)}`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            Edit Path
          </Link>

          {path.status === "ACTIVE" ? (
            <button type="button" onClick={() => runAction(onPause)} disabled={busy} className={itemClass} role="menuitem">
              Pause Path
            </button>
          ) : null}

          {(path.status === "DRAFT" || path.status === "PAUSED") ? (
            <button type="button" onClick={() => runAction(onActivate)} disabled={busy} className={itemClass} role="menuitem">
              Activate Path
            </button>
          ) : null}

          <button type="button" onClick={() => runAction(onDuplicate)} disabled={busy} className={itemClass} role="menuitem">
            Duplicate Path
          </button>

          <button type="button" onClick={() => runAction(onTestRun)} disabled={busy} className={itemClass} role="menuitem">
            Run Test
          </button>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => runAction(onDelete)}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            role="menuitem"
          >
            Delete Path
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function StewardPathsWorkspacePage() {
  const [paths, setPaths] = useState<StewardPathTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<StewardEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPathId, setBusyPathId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, enrollmentRows] = await Promise.all([
        apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates"),
        apiFetch<StewardEnrollment[]>("/api/steward-paths/enrollments?limit=300").catch(() => []),
      ]);
      setPaths(Array.isArray(templateRows) ? templateRows : []);
      setEnrollments(Array.isArray(enrollmentRows) ? enrollmentRows : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Steward Paths data.");
      setPaths([]);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const targetOptions = useMemo(() => {
    return Array.from(new Set(paths.map((path) => path.targetType).filter(Boolean))).sort();
  }, [paths]);

  const visiblePaths = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const filtered = paths.filter((path) => {
      if (statusFilter !== "all" && path.status !== statusFilter) return false;
      if (targetFilter !== "all" && path.targetType !== targetFilter) return false;
      if (ownerFilter !== "all") {
        const visibility = readVisibility(path);
        if (ownerFilter === "private" && visibility !== "private") return false;
        if (ownerFilter === "shared" && visibility === "private") return false;
      }
      if (!needle) return true;
      return path.name.toLowerCase().includes(needle)
        || (path.description ?? "").toLowerCase().includes(needle)
        || path.triggerType.toLowerCase().includes(needle)
        || path.targetType.toLowerCase().includes(needle);
    });

    return filtered.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "enrollments") return (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [ownerFilter, paths, searchQuery, sortMode, statusFilter, targetFilter]);

  const totalEnrollments = useMemo(() => enrollments.length, [enrollments]);
  const activeEnrollments = useMemo(() => enrollments.filter((item) => item.status === "ACTIVE").length, [enrollments]);
  const completedEnrollments = useMemo(() => enrollments.filter((item) => item.status === "COMPLETED").length, [enrollments]);
  const erroredEnrollments = useMemo(() => enrollments.filter((item) => item.status === "FAILED").length, [enrollments]);
  const completionRate = useMemo(() => {
    if (totalEnrollments === 0) return 0;
    return (completedEnrollments / totalEnrollments) * 100;
  }, [completedEnrollments, totalEnrollments]);

  const activeCount = useMemo(() => paths.filter((path) => path.status === "ACTIVE").length, [paths]);
  const draftCount = useMemo(() => paths.filter((path) => path.status === "DRAFT").length, [paths]);
  const pausedCount = useMemo(() => paths.filter((path) => path.status === "PAUSED").length, [paths]);
  const archivedCount = useMemo(() => paths.filter((path) => path.status === "ARCHIVED").length, [paths]);
  const reviewCount = useMemo(() => paths.filter((path) => path.status === "DRAFT" || path.status === "PAUSED").length, [paths]);

  const recentActivity = useMemo(() => {
    return [...paths]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);
  }, [paths]);

  async function updatePathStatus(path: StewardPathTemplate, nextStatus: "ACTIVE" | "PAUSED"): Promise<void> {
    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(nextStatus === "ACTIVE" ? "Path activated." : "Path paused.");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update path status.");
    } finally {
      setBusyPathId(null);
    }
  }

  async function duplicatePath(path: StewardPathTemplate): Promise<void> {
    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}/duplicate`, { method: "POST" });
      setNotice("Path duplicated as a new draft.");
      await load();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Failed to duplicate path.");
    } finally {
      setBusyPathId(null);
    }
  }

  async function testRunPath(path: StewardPathTemplate): Promise<void> {
    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}/test-run`, { method: "POST" });
      setNotice("Test run recorded. Check Activity for details.");
      await load();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to run test path.");
    } finally {
      setBusyPathId(null);
    }
  }

  async function deletePath(path: StewardPathTemplate): Promise<void> {
    const confirmed = window.confirm(
      `Delete path \"${path.name}\"? This action archives the path and removes it from active workflows.`,
    );
    if (!confirmed) return;

    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}`, { method: "DELETE" });
      setNotice("Path deleted from active library.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete path.");
    } finally {
      setBusyPathId(null);
    }
  }

  function resetFilters(): void {
    setSearchQuery("");
    setStatusFilter("all");
    setTargetFilter("all");
    setOwnerFilter("all");
    setSortMode("updated");
  }

  const hasActiveFilters = searchQuery.trim().length > 0
    || statusFilter !== "all"
    || targetFilter !== "all"
    || ownerFilter !== "all"
    || sortMode !== "updated";

  return (
    <div className="h-full overflow-y-auto bg-[#f3f5f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1500px] space-y-5 lg:space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/70 px-5 py-5 shadow-sm md:px-6 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M4 19h16M5 17V7l7-3 7 3v10M9 11h6M9 15h6" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[30px] font-semibold tracking-tight text-slate-900">Path Library</h1>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {paths.length} paths
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Build, monitor, and optimize stewardship journeys with production-ready controls.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/data-tools"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4M7 4l-3 3M7 4l3 3M17 8v12M17 20l-3-3M17 20l3-3" />
                </svg>
                Import Path
              </Link>
              <Link
                href="/steward-paths/builder"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                </svg>
                Create Path
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(260px,1.3fr)_150px_170px_140px_170px_auto]">
            <label className="relative block">
              <span className="sr-only">Search paths</span>
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search paths by name, trigger, or description"
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="all">Status: All</option>
              <option value="ACTIVE">Status: Active</option>
              <option value="DRAFT">Status: Draft</option>
              <option value="PAUSED">Status: Paused</option>
              <option value="ARCHIVED">Status: Archived</option>
            </select>

            <select
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="all">Category: All Types</option>
              {targetOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value as OwnerFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="all">Owner: All</option>
              <option value="private">Owner: Private</option>
              <option value="shared">Owner: Shared</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="updated">Sort: Last Updated</option>
              <option value="name">Sort: Name</option>
              <option value="enrollments">Sort: Most Enrolled</option>
            </select>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : null}
              <Link
                href="/steward-paths/review"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Review Queue
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-4">
          <Link href="/steward-paths/builder" className="group rounded-2xl border border-dashed border-emerald-300 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">Create New Path</p>
            <p className="mt-1 text-xs text-slate-600">Start from a blank orchestration.</p>
            <p className="mt-3 text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">Open Builder</p>
          </Link>

          <Link href="/steward-paths/builder?quickStart=donor-welcome" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4 3 8l9 4 9-4-9-4Zm0 8v8M5 10v5c0 1.4 3.1 3 7 3s7-1.6 7-3v-5" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">New Donor Welcome</p>
            <p className="mt-1 text-xs text-slate-600">Thank and guide first-time donors through early milestones.</p>
            <p className="mt-3 text-xs font-semibold text-emerald-700">Use Template</p>
          </Link>

          <Link href="/steward-paths/builder?quickStart=lapsed-reengagement" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3 7 4-14 3 7h4" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">Lapsed Recovery</p>
            <p className="mt-1 text-xs text-slate-600">Re-engage supporters with timely, trust-building outreach.</p>
            <p className="mt-3 text-xs font-semibold text-emerald-700">Use Template</p>
          </Link>

          <Link href="/steward-paths/builder?quickStart=event-follow-up" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 2v3M16 2v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">Event Follow-Up</p>
            <p className="mt-1 text-xs text-slate-600">Capture post-event momentum with structured next steps.</p>
            <p className="mt-3 text-xs font-semibold text-emerald-700">Use Template</p>
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 md:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Path Health Overview</h2>
              <p className="text-xs text-slate-500">Live status snapshot for your full library.</p>
            </div>
            <Link href="/steward-paths/analytics" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View Analytics</Link>
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 md:px-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">Total Paths</p><p className="mt-1 text-xl font-semibold text-slate-900">{paths.length}</p></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-emerald-700">Active</p><p className="mt-1 text-xl font-semibold text-emerald-800">{activeCount}</p></div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-blue-700">Draft</p><p className="mt-1 text-xl font-semibold text-blue-800">{draftCount}</p></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-amber-700">Needs Review</p><p className="mt-1 text-xl font-semibold text-amber-800">{reviewCount}</p></div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-violet-700">Paused</p><p className="mt-1 text-xl font-semibold text-violet-800">{pausedCount}</p></div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-rose-700">Errored</p><p className="mt-1 text-xl font-semibold text-rose-800">{erroredEnrollments}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">Archived</p><p className="mt-1 text-xl font-semibold text-slate-900">{archivedCount}</p></div>
          </div>
        </section>

        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading path library...</div>
        ) : paths.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M5 7h14M5 12h14M5 17h8" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No paths yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Create your first stewardship path to orchestrate donor journeys across email, tasks, and follow-up actions.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link href="/steward-paths/builder" className="inline-flex h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
                Create First Path
              </Link>
              <Link href="/data-tools" className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Import Existing Paths
              </Link>
            </div>
          </section>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[1040px]">
                <div className="grid grid-cols-[minmax(290px,1.8fr)_130px_150px_90px_120px_160px_84px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:px-5">
                  <span>Path Name</span>
                  <span>Status</span>
                  <span>Trigger</span>
                  <span>Steps</span>
                  <span>Enrolled</span>
                  <span>Last Updated</span>
                  <span className="text-right">Next Action</span>
                </div>

                {visiblePaths.map((path) => (
                  <article key={path.id} className="grid grid-cols-[minmax(290px,1.8fr)_130px_150px_90px_120px_160px_84px] gap-3 border-b border-slate-100 px-4 py-3.5 text-sm transition hover:bg-slate-50/70 last:border-b-0 md:px-5">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${
                            path.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                              : path.status === "DRAFT"
                                ? "bg-blue-50 text-blue-700 ring-blue-100"
                                : path.status === "PAUSED"
                                  ? "bg-amber-50 text-amber-700 ring-amber-100"
                                  : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5v14" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{path.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{path.description || "No description"}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{path.targetType} · {path.crmScope}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusPill(path.status)}`}>
                        {path.status}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-700">{path.triggerType || "MANUAL"}</div>
                    <div className="font-semibold text-slate-900">{path.steps.length}</div>
                    <div className="font-semibold text-slate-900">{path._count?.enrollments ?? 0}</div>
                    <div className="text-xs text-slate-600">{formatDate(path.updatedAt)}</div>

                    <div className="flex justify-end">
                      <PathRowActionsMenu
                        path={path}
                        busy={busyPathId === path.id}
                        onActivate={() => void updatePathStatus(path, "ACTIVE")}
                        onPause={() => void updatePathStatus(path, "PAUSED")}
                        onDuplicate={() => void duplicatePath(path)}
                        onTestRun={() => void testRunPath(path)}
                        onDelete={() => void deletePath(path)}
                      />
                    </div>
                  </article>
                ))}

                {visiblePaths.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">No paths match these filters</p>
                    <p className="mt-1 text-sm text-slate-600">Try broadening your filters or resetting to the default view.</p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Reset Filters
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
              <Link href="/steward-paths/activity" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View All</Link>
            </div>

            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-600">
                  Activity will appear once templates are created or updated.
                </div>
              ) : recentActivity.map((path) => (
                <div key={path.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{path.name}</p>
                    <p className="text-xs text-slate-600">Updated {formatDate(path.updatedAt)}</p>
                  </div>
                  <Link href={`/steward-paths/${encodeURIComponent(path.id)}/history`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open</Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Path Performance Snapshot</h3>
              <Link href="/steward-paths/analytics" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View Full Analytics</Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Enrolled</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{totalEnrollments}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Active Now</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">{activeEnrollments}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Completed</p>
                <p className="mt-1 text-2xl font-semibold text-blue-800">{completedEnrollments}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Completion Rate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{percentage(completionRate)}</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-rose-700">Error Rate</p>
                <p className="mt-1 text-2xl font-semibold text-rose-800">{percentage(totalEnrollments > 0 ? (erroredEnrollments / totalEnrollments) * 100 : 0)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
