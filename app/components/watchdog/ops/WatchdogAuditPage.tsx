// Consolidated operations audit dashboard for Watchdog.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWatchdogAudit } from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogAuditResponse } from "@/app/components/watchdog/ops/types";

/** Renders filterable audit feed for backup, restore, vault, and operations events. */
export default function WatchdogAuditPage() {
  const [data, setData] = useState<WatchdogAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [severity, setSeverity] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWatchdogAudit({
        page,
        limit: 50,
        eventType,
        user: actor,
        severity,
        module: moduleFilter,
        entity,
      });
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [actor, entity, eventType, moduleFilter, page, severity]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Audit Log"
        description="Filterable operational event stream for backups, restores, vault access, and settings changes."
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="block text-xs font-medium text-slate-700">
            Event Type
            <input
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="WATCHDOG_RESTORE"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            User
            <input
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="user id"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Severity
            <select
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Module
            <select
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All</option>
              <option value="watchdog">watchdog</option>
              <option value="donor">donor</option>
              <option value="compassion">compassion</option>
              <option value="events">events</option>
              <option value="webmaster">webmaster</option>
              <option value="hrm">hrm</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Entity
            <input
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="WatchdogVaultEntry"
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading audit events...</div>
      ) : null}

      {!loading && data ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Severity</th>
                  <th className="py-2 pr-3">Module</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Entity</th>
                  <th className="py-2">Actor</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={6}>No audit records match these filters.</td>
                  </tr>
                ) : (
                  data.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-700">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3">
                        <StatusChip status={item.severity === "critical" ? "Broken" : item.severity === "high" ? "Partially Working" : "Working"} />
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{item.module}</td>
                      <td className="py-2 pr-3 text-slate-900">{item.action}</td>
                      <td className="py-2 pr-3 text-slate-700">{item.entity ?? "-"}</td>
                      <td className="py-2 text-slate-700">{item.userId ?? "system"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <p className="text-xs text-slate-600">
              Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)} ({data.pagination.total} total)
            </p>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(previous + 1, Math.max(data.pagination.totalPages, 1)))}
              disabled={page >= data.pagination.totalPages}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
