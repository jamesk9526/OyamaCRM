/**
 * /grants — Grant Management pipeline and list page.
 * Shows stat cards, a pipeline kanban view (by status), and a list view toggle.
 * Users can create new grants via the AddGrantModal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import GrantStats from "@/app/components/grants/GrantStats";
import GrantCard from "@/app/components/grants/GrantCard";
import AddGrantModal from "@/app/components/grants/AddGrantModal";
import FunderManager from "@/app/components/grants/FunderManager";
import type { Grant, GrantStatus } from "@/app/components/grants/types";
import { PIPELINE_STAGES, TERMINAL_STAGES, STATUS_META } from "@/app/components/grants/types";

type View = "pipeline" | "list" | "funders";

/** GrantsPage — the main grant management hub. */
export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("pipeline");
  const [showAdd, setShowAdd] = useState(false);
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Grant[]>("/api/grants");
      setGrants(Array.isArray(data) ? data : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Called when a grant is created or updated. */
  function handleGrantSaved(g: Grant) {
    setGrants((prev) => {
      const idx = prev.findIndex((x) => x.id === g.id);
      return idx >= 0 ? prev.map((x) => x.id === g.id ? g : x) : [g, ...prev];
    });
    setStatsRefresh((n) => n + 1);
  }

  /** Grants grouped by status for the pipeline view. */
  const byStatus = grants.reduce<Record<string, Grant[]>>((acc, g) => {
    acc[g.status] = [...(acc[g.status] ?? []), g];
    return acc;
  }, {});

  const activeGrants = grants.filter((g) => PIPELINE_STAGES.includes(g.status as GrantStatus));
  const terminalGrants = grants.filter((g) => TERMINAL_STAGES.includes(g.status as GrantStatus));

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grant Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track grant opportunities from idea through award — with writing tools and funder relationships.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
          New Grant
        </button>
      </div>

      {/* Stat cards */}
      <GrantStats refresh={statsRefresh} />

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["pipeline", "list", "funders"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {v === "funders" ? "Funders" : v === "pipeline" ? "Pipeline" : "List"}
          </button>
        ))}
      </div>

      {/* ── Pipeline view ── */}
      {view === "pipeline" && (
        <div className="space-y-4">
          {/* Active stages scrollable kanban */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.map((status) => {
                const meta = STATUS_META[status];
                const col = byStatus[status] ?? [];
                return (
                  <div key={status} className="w-72 shrink-0">
                    <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${meta.bg} ${meta.border} border`}>
                      <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full bg-white font-medium ${meta.color}`}>{col.length}</span>
                    </div>
                    <div className={`rounded-b-lg border-x border-b ${meta.border} min-h-[200px] space-y-2 p-2 bg-gray-50`}>
                      {loading
                        ? Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-24" />
                          ))
                        : col.length === 0
                        ? <p className="text-center py-6 text-xs text-gray-400">No grants</p>
                        : col.map((g) => <GrantCard key={g.id} grant={g} />)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal / archive section */}
          {terminalGrants.length > 0 && (
            <div>
              <button
                onClick={() => setShowTerminal((v) => !v)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3"
              >
                <svg className={`w-4 h-4 transition-transform ${showTerminal ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L9 7.414V16a1 1 0 11-2 0V7.414L4.707 9.12a1 1 0 01-1.414-1.414l4-4z" clipRule="evenodd" transform="rotate(90 10 10)" />
                </svg>
                {showTerminal ? "Hide" : "Show"} completed/archived ({terminalGrants.length})
              </button>
              {showTerminal && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {terminalGrants.map((g) => <GrantCard key={g.id} grant={g} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : grants.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-3xl">📄</p>
              <p className="text-gray-600 font-medium">No grants tracked yet</p>
              <p className="text-sm text-gray-400">Create your first grant opportunity to start the pipeline.</p>
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                + New Grant
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Grant / Funder", "Status", "Requested", "Awarded", "Deadline", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grants.map((g) => {
                  const meta = STATUS_META[g.status];
                  const deadline = g.applicationDeadline ?? g.loiDeadline;
                  const days = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{g.title}</p>
                        <p className="text-xs text-gray-400">{g.funder?.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {g.amountRequested ? `$${Number(g.amountRequested).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-green-700 font-medium">
                        {g.amountAwarded ? `$${Number(g.amountAwarded).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {days !== null ? (
                          <span className={`text-xs ${days < 0 ? "text-gray-400" : days <= 7 ? "text-red-600 font-semibold" : days <= 30 ? "text-amber-600" : "text-gray-500"}`}>
                            {days < 0 ? "Passed" : `${days}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/grants/${g.id}`} className="text-xs text-green-600 hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Funders view ── */}
      {view === "funders" && <FunderManager />}

      {/* Add modal */}
      {showAdd && (
        <AddGrantModal
          onClose={() => setShowAdd(false)}
          onSaved={handleGrantSaved}
        />
      )}
    </div>
  );
}
