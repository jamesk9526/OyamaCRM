"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathTemplate {
  id: string;
  name?: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  targetType: string;
  triggerType: string;
  _count?: { enrollments: number };
}

interface EnrollmentRecord {
  id: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  pathId?: string;
}

function ratio(count: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

export default function StewardPathsAnalyticsPage() {
  const searchParams = useSearchParams();
  const scopedPathId = searchParams.get("pathId")?.trim() || null;

  const [paths, setPaths] = useState<StewardPathTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pathRows, enrollmentRows] = await Promise.all([
        apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates"),
        apiFetch<EnrollmentRecord[]>("/api/steward-paths/enrollments?limit=400"),
      ]);
      setPaths(Array.isArray(pathRows) ? pathRows : []);
      setEnrollments(Array.isArray(enrollmentRows) ? enrollmentRows : []);
    } catch (loadError) {
      setPaths([]);
      setEnrollments([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scopedPaths = useMemo(
    () => (scopedPathId ? paths.filter((path) => path.id === scopedPathId) : paths),
    [paths, scopedPathId],
  );

  const canScopeEnrollments = useMemo(
    () => enrollments.some((row) => typeof row.pathId === "string" && row.pathId.length > 0),
    [enrollments],
  );

  const scopedEnrollments = useMemo(() => {
    if (!scopedPathId || !canScopeEnrollments) return enrollments;
    return enrollments.filter((row) => row.pathId === scopedPathId);
  }, [canScopeEnrollments, enrollments, scopedPathId]);

  const statusCounts = useMemo(() => {
    const bucket: Record<string, number> = {
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };
    for (const row of scopedEnrollments) {
      bucket[row.status] = (bucket[row.status] ?? 0) + 1;
    }
    return bucket;
  }, [scopedEnrollments]);

  const targetTypeCounts = useMemo(() => {
    const bucket = new Map<string, number>();
    for (const path of scopedPaths) {
      bucket.set(path.targetType, (bucket.get(path.targetType) ?? 0) + 1);
    }
    return Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
  }, [scopedPaths]);

  const triggerTypeCounts = useMemo(() => {
    const bucket = new Map<string, number>();
    for (const path of scopedPaths) {
      bucket.set(path.triggerType || "MANUAL", (bucket.get(path.triggerType || "MANUAL") ?? 0) + 1);
    }
    return Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
  }, [scopedPaths]);

  const totalPathEnrollments = useMemo(() => {
    return scopedPaths.reduce((total, path) => total + (path._count?.enrollments ?? 0), 0);
  }, [scopedPaths]);

  const scopedPathLabel = useMemo(() => scopedPaths[0]?.name ?? scopedPathId, [scopedPathId, scopedPaths]);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1480px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">Live performance and distribution metrics from Steward Paths templates and enrollments.</p>
          {scopedPathId ? (
            <p className="mt-1 text-xs text-emerald-700">
              Scoped to path: {scopedPathLabel}
              {" "}
              <Link href="/steward-paths/analytics" className="font-semibold hover:text-emerald-800">View all analytics</Link>
            </p>
          ) : null}
        </header>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading analytics...</div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Templates</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{scopedPaths.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Enrollments</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{scopedEnrollments.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Completed Rate</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">{ratio(statusCounts.COMPLETED ?? 0, scopedEnrollments.length)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Failure Rate</p>
                <p className="mt-1 text-2xl font-semibold text-rose-700">{ratio(statusCounts.FAILED ?? 0, scopedEnrollments.length)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Template Enrollment Total</p>
                <p className="mt-1 text-2xl font-semibold text-blue-700">{totalPathEnrollments}</p>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Enrollment Status Distribution</h2>
                <div className="mt-3 space-y-2">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{status}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{ratio(count, scopedEnrollments.length)} of enrollments</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Target Type Distribution</h2>
                <div className="mt-3 space-y-2">
                  {targetTypeCounts.length === 0 ? (
                    <p className="text-sm text-slate-600">No template target types available.</p>
                  ) : (
                    targetTypeCounts.map(([targetType, count]) => (
                      <div key={targetType} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">{targetType}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">{ratio(count, scopedPaths.length)} of templates</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Trigger Type Mix</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {triggerTypeCounts.length === 0 ? (
                  <p className="text-sm text-slate-600">No trigger data available.</p>
                ) : (
                  triggerTypeCounts.map(([triggerType, count]) => (
                    <div key={triggerType} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-medium text-slate-800">{triggerType}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{count} template(s)</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
