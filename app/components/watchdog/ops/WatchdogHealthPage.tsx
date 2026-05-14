// System health and service readiness dashboard for Watchdog.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWatchdogHealth } from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogHealthResponse } from "@/app/components/watchdog/ops/types";

/** Renders service-level health checks and module readiness counters. */
export default function WatchdogHealthPage() {
  const [data, setData] = useState<WatchdogHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWatchdogHealth();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load health checks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="System Health"
        description="Live service readiness for API, databases, storage, provider dependencies, and build state."
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

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading health checks...</div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Healthy</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.healthy}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Partial</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.partial}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Broken</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.broken}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Not Implemented</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.notImplemented}</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Service Checks</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2">Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((check) => (
                    <tr key={check.key} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">{check.label}</td>
                      <td className="py-2 pr-3"><StatusChip status={check.status} /></td>
                      <td className="py-2 pr-3 text-slate-700">{check.detail}</td>
                      <td className="py-2 text-slate-700">{new Date(check.checkedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
