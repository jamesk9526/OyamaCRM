"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathTemplate {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  updatedAt: string;
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

export default function StewardPathsReviewPage() {
  const searchParams = useSearchParams();
  const scopedPathId = searchParams.get("pathId")?.trim() || null;

  const [items, setItems] = useState<StewardPathTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates");
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scopedItems = useMemo(
    () => (scopedPathId ? items.filter((item) => item.id === scopedPathId) : items),
    [items, scopedPathId],
  );

  const reviewItems = useMemo(
    () => scopedItems
      .filter((item) => item.status === "DRAFT" || item.status === "PAUSED")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [scopedItems],
  );

  const activeCount = useMemo(() => scopedItems.filter((item) => item.status === "ACTIVE").length, [scopedItems]);
  const reviewCount = reviewItems.length;
  const scopedPathName = useMemo(() => scopedItems[0]?.name ?? null, [scopedItems]);

  async function updateStatus(item: StewardPathTemplate, nextStatus: "ACTIVE" | "PAUSED"): Promise<void> {
    setBusyId(item.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(nextStatus === "ACTIVE" ? "Path activated." : "Path paused.");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update path status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Stage 3</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">Review and activate workflows</h1>
              <p className="mt-1 text-sm text-slate-600">Approve draft workflows, pause risky ones, and keep activation decisions intentional.</p>
              {scopedPathId ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Scoped to path: {scopedPathName ?? scopedPathId}
                  {" "}
                  <Link href="/steward-paths/review" className="font-semibold hover:text-emerald-800">View full queue</Link>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh queue
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Needs review</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{reviewCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Active</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total templates</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{scopedItems.length}</p>
          </div>
        </section>

        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading review queue...</div>
        ) : reviewItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {scopedPathId
              ? "This path has no draft or paused state waiting in review."
              : "No draft or paused paths are awaiting review."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[minmax(240px,1.5fr)_130px_130px_180px_220px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Workflow</span>
              <span>Status</span>
              <span>Steps</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {reviewItems.map((item) => (
              <article key={item.id} className="grid grid-cols-[minmax(240px,1.5fr)_130px_130px_180px_220px] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">{item.name}</h2>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item.description || "No description"}</p>
                </div>
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900">{item.steps.length}</div>
                <div className="text-xs text-slate-600">{formatDate(item.updatedAt)}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id || item.status === "ACTIVE"}
                    onClick={() => void updateStatus(item, "ACTIVE")}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id || item.status === "PAUSED"}
                    onClick={() => void updateStatus(item, "PAUSED")}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Pause
                  </button>
                  <Link
                    href={`/steward-paths/${encodeURIComponent(item.id)}/builder`}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
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
