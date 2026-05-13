/**
 * AuditLogViewer component — paginated, filterable view of the organization's audit log.
 * Admin-only: table with action, entity, user, IP address, and timestamp.
 * Filters: action text search, entity type dropdown, and date range.
 * Calls GET /api/audit-logs via apiFetch.
 */
"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape of a single audit log entry from the API (includes joined user). */
interface AuditLogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Response shape from GET /api/audit-logs */
interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

/** All known entity types for the filter dropdown — update as new entities are added. */
const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  { value: "Constituent", label: "Constituent" },
  { value: "Donation", label: "Donation" },
  { value: "Campaign", label: "Campaign" },
  { value: "User", label: "User" },
  { value: "Settings", label: "Settings" },
  { value: "Task", label: "Task" },
];

/** Maps common action prefixes to a color for the badge. */
function actionColor(action: string): string {
  if (action.includes("DELETE") || action.includes("DEACTIVATE")) return "bg-red-100 text-red-700";
  if (action.includes("CREATE") || action.includes("REGISTER")) return "bg-green-100 text-green-800";
  if (action.includes("UPDATE") || action.includes("RESET") || action.includes("PASSWORD")) return "bg-blue-100 text-blue-700";
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

/** Converts an ISO timestamp to a readable locale string. */
function formatTs(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

/** Truncates a string to maxLen characters with ellipsis. */
function truncate(s: string | null | undefined, maxLen = 24): string {
  if (!s) return "—";
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

const PAGE_SIZE = 50;

/**
 * AuditLogViewer renders a filterable, paginated audit log table.
 * Requires admin role — the /api/audit-logs endpoint enforces this server-side.
 */
export default function AuditLogViewer() {
  // ── Filter state ────────────────────────────────────────────────────────
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ── Data state ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Expanded row for viewing metadata JSON. */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /** Build query string and fetch from /api/audit-logs. */
  const loadLogs = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) });
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (entityFilter) params.set("entity", entityFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const data = await apiFetch<AuditLogsResponse>(`/api/audit-logs?${params.toString()}`);
      setLogs(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, fromDate, toDate]);

  // Reload when filters change (reset to page 1)
  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /** Apply filter form: reset to page 1. */
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadLogs(1);
  }

  /** Clear all filters. */
  function handleClearFilters() {
    setActionFilter("");
    setEntityFilter("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          All create, update, delete, and authentication events across your organization.
        </p>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleFilterSubmit} className="flex flex-wrap gap-3 mb-5 items-end">
        {/* Action search */}
        <div className="w-full sm:flex-1 sm:min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Action contains</label>
          <input
            type="text"
            placeholder="e.g. DELETE, LOGIN"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Entity type dropdown */}
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Entity</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date range from */}
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Date range to */}
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-end w-full sm:w-auto">
          <button
            type="submit"
            className="px-3 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Result count */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-gray-500">
          {loading ? "Loading…" : `${total.toLocaleString()} result${total !== 1 ? "s" : ""}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(page - 1)}
              disabled={page <= 1 || loading}
              className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => loadLogs(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && logs.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center border border-gray-100 rounded-lg">
          No audit log entries match your filters.
        </div>
      ) : (
        <>
        <div className="md:hidden rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
          {logs.map((log) => (
            <article key={log.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${actionColor(log.action)}`}>
                  {log.action}
                </span>
                <span className="text-xs text-gray-500">{formatTs(log.createdAt)}</span>
              </div>

              <div className="mt-2 space-y-1 text-xs text-gray-700">
                <p>
                  <span className="font-medium text-gray-800">Entity:</span>{" "}
                  {log.entity ? (
                    <>
                      {log.entity}
                      {log.entityId ? <span className="ml-1 text-gray-500 font-mono">#{truncate(log.entityId, 8)}</span> : null}
                    </>
                  ) : "—"}
                </p>
                <p><span className="font-medium text-gray-800">User:</span> {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"}</p>
                <p><span className="font-medium text-gray-800">IP:</span> {log.ipAddress ?? "—"}</p>
              </div>

              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expandedId === log.id ? "Hide" : "Show"} metadata
                  </button>
                  {expandedId === log.id && (
                    <pre className="mt-1 text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-w-full rounded border border-gray-100 bg-gray-50 p-2">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Timestamp</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-gray-50">
                    {/* Action badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    {/* Entity / entityId */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {log.entity ? (
                        <span>
                          <span className="font-medium">{log.entity}</span>
                          {log.entityId && (
                            <span className="ml-1 text-xs text-gray-400 font-mono" title={log.entityId}>
                              #{truncate(log.entityId, 8)}
                            </span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    {/* User */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : <span className="text-gray-400 text-xs">System</span>}
                    </td>
                    {/* IP address */}
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {log.ipAddress ?? "—"}
                    </td>
                    {/* Timestamp */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTs(log.createdAt)}
                    </td>
                    {/* Expand metadata */}
                    <td className="px-4 py-3 text-right">
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {expandedId === log.id ? "Hide" : "Show"} metadata
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Expanded metadata row */}
                  {expandedId === log.id && log.metadata && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-2">
                        <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-w-full">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-2 mt-4">
          <button
            onClick={() => loadLogs(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => loadLogs(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
