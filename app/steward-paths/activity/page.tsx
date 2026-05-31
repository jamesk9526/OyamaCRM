"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathTemplate {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  updatedAt: string;
  createdAt: string;
  steps: Array<{ id: string }>;
  _count?: { enrollments: number };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString();
}

function statusClass(status: StewardPathTemplate["status"]): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "PAUSED") return "bg-amber-100 text-amber-800";
  if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function StewardPathsActivityPage() {
  const [items, setItems] = useState<StewardPathTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates");
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load path activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? items.filter((item) => item.name.toLowerCase().includes(needle) || (item.description ?? "").toLowerCase().includes(needle))
      : items;

    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [items, search]);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Stage 4</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">Activity and history</h1>
              <p className="mt-1 text-sm text-slate-600">Track the most recently changed paths and jump into template-specific history timelines.</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh activity
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="block max-w-md">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Search path activity</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by path name or description"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </section>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading activity...</div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No path activity matched your search.</div>
        ) : (
          <div className="grid gap-3">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">{item.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.description || "No description"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Updated {formatDate(item.updatedAt)}</span>
                      <span aria-hidden="true">•</span>
                      <span>Created {formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">Steps: {item.steps.length}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">Enrollments: {item._count?.enrollments ?? 0}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/steward-paths/${encodeURIComponent(item.id)}/activity`}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Open history
                  </Link>
                  <Link
                    href={`/steward-paths/${encodeURIComponent(item.id)}/builder`}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open builder
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
