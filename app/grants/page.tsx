/**
 * /grants — Grant research workspace with command panel, board, and library views.
 * Adds triage-first controls (search, scope, sorting, risk focus) for daily grant operations.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import GrantStats from "@/app/components/grants/GrantStats";
import GrantCard from "@/app/components/grants/GrantCard";
import AddGrantModal from "@/app/components/grants/AddGrantModal";
import FunderManager from "@/app/components/grants/FunderManager";
import GrantsCommandPanel from "@/app/components/grants/GrantsCommandPanel";
import type { Grant, GrantStatus, GrantWorkspaceCaseItem } from "@/app/components/grants/types";
import { PIPELINE_STAGES, TERMINAL_STAGES, STATUS_META, fmt$ } from "@/app/components/grants/types";

type View = "board" | "library" | "deadlines" | "tasks" | "funders";
type ScopeFilter = "ALL" | "ACTIVE" | "TERMINAL" | GrantStatus;
type SortMode = "DEADLINE_ASC" | "DEADLINE_DESC" | "UPDATED_DESC" | "AMOUNT_DESC" | "TITLE_ASC";

/** Returns the most actionable deadline for a grant. */
function getPrimaryDeadline(grant: Grant): string | null {
  return grant.applicationDeadline ?? grant.loiDeadline ?? null;
}

/** Returns number of days until the current grant deadline. */
function getDaysUntilDeadline(grant: Grant): number | null {
  const primaryDeadline = getPrimaryDeadline(grant);
  if (!primaryDeadline) return null;
  const diffMs = new Date(primaryDeadline).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Formats a date string for compact workspace list rows. */
function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Flags grants that need immediate operator attention. */
function isAtRiskGrant(grant: Grant): boolean {
  const daysUntil = getDaysUntilDeadline(grant);
  return STATUS_META[grant.status].stage === "active" && daysUntil !== null && daysUntil <= 14;
}

/** Returns requested amount as numeric for sorting and aggregation. */
function requestedAmount(grant: Grant): number {
  return Number(grant.amountRequested ?? 0);
}

/** Sort comparator for grants workspace list and board. */
function compareGrants(a: Grant, b: Grant, mode: SortMode): number {
  if (mode === "DEADLINE_ASC") {
    const aDays = getDaysUntilDeadline(a) ?? Number.POSITIVE_INFINITY;
    const bDays = getDaysUntilDeadline(b) ?? Number.POSITIVE_INFINITY;
    return aDays - bDays;
  }

  if (mode === "DEADLINE_DESC") {
    const aDays = getDaysUntilDeadline(a) ?? Number.NEGATIVE_INFINITY;
    const bDays = getDaysUntilDeadline(b) ?? Number.NEGATIVE_INFINITY;
    return bDays - aDays;
  }

  if (mode === "AMOUNT_DESC") {
    return requestedAmount(b) - requestedAmount(a);
  }

  if (mode === "TITLE_ASC") {
    return a.title.localeCompare(b.title);
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/** Matches a grant against free-text query terms used in workspace search. */
function matchesSearch(grant: Grant, query: string): boolean {
  if (!query.trim()) return true;
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [
    grant.title,
    grant.programArea ?? "",
    grant.funder?.name ?? "",
    grant.assignee ? `${grant.assignee.firstName} ${grant.assignee.lastName}` : "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

/** GrantsPage — the main grant management hub. */
export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [workspaceCaseItems, setWorkspaceCaseItems] = useState<GrantWorkspaceCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("board");
  const [showAdd, setShowAdd] = useState(false);
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("DEADLINE_ASC");
  const [riskOnly, setRiskOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grantsData, caseItemsData] = await Promise.all([
        apiFetch<Grant[]>("/api/grants"),
        apiFetch<GrantWorkspaceCaseItem[]>("/api/grants/workspace/case-items"),
      ]);
      setGrants(Array.isArray(grantsData) ? grantsData : []);
      setWorkspaceCaseItems(Array.isArray(caseItemsData) ? caseItemsData : []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  /** Called when a grant is created or updated. */
  function handleGrantSaved(g: Grant) {
    setGrants((prev) => {
      const idx = prev.findIndex((x) => x.id === g.id);
      return idx >= 0 ? prev.map((x) => x.id === g.id ? g : x) : [g, ...prev];
    });
    setStatsRefresh((n) => n + 1);
  }

  /** Grants after applying search, scope, and risk filters. */
  const filteredGrants = grants.filter((grant) => {
    if (!matchesSearch(grant, searchQuery)) return false;

    if (scopeFilter === "ACTIVE" && STATUS_META[grant.status].stage !== "active") {
      return false;
    }
    if (scopeFilter === "TERMINAL" && STATUS_META[grant.status].stage !== "terminal") {
      return false;
    }
    if (scopeFilter !== "ALL" && scopeFilter !== "ACTIVE" && scopeFilter !== "TERMINAL" && grant.status !== scopeFilter) {
      return false;
    }
    if (riskOnly && !isAtRiskGrant(grant)) return false;
    return true;
  });

  /** Final sorted workspace grants shown in board/list modes. */
  const visibleGrants = [...filteredGrants].sort((a, b) => compareGrants(a, b, sortMode));

  /** Grants grouped by status for the board view. */
  const byStatus = visibleGrants.reduce<Record<string, Grant[]>>((acc, grant) => {
    acc[grant.status] = [...(acc[grant.status] ?? []), grant];
    return acc;
  }, {});

  const activeGrants = visibleGrants.filter((grant) => PIPELINE_STAGES.includes(grant.status as GrantStatus));
  const terminalGrants = visibleGrants.filter((grant) => TERMINAL_STAGES.includes(grant.status as GrantStatus));
  const atRiskCount = visibleGrants.filter((grant) => isAtRiskGrant(grant)).length;
  const requestedInView = visibleGrants.reduce((sum, grant) => sum + requestedAmount(grant), 0);

  const pipelineSummary = PIPELINE_STAGES.map((status) => {
    const laneGrants = byStatus[status] ?? [];
    const laneAtRisk = laneGrants.filter((grant) => isAtRiskGrant(grant)).length;
    return {
      status,
      count: laneGrants.length,
      atRisk: laneAtRisk,
      requested: laneGrants.reduce((sum, grant) => sum + requestedAmount(grant), 0),
    };
  });

  const overloadedLanes = pipelineSummary.filter((lane) => lane.count >= 6).length;
  const activeLaneCount = pipelineSummary.filter((lane) => lane.count > 0).length;

  const deadlineItems = workspaceCaseItems
    .filter((item) => item.kind === "REMINDER" || (item.kind === "REQUIREMENT" && item.status !== "COMPLETED"))
    .filter((item) => item.dueAt)
    .sort((a, b) => new Date(a.dueAt ?? "").getTime() - new Date(b.dueAt ?? "").getTime())
    .slice(0, 40);

  const taskItems = workspaceCaseItems
    .filter((item) => item.kind === "TASK")
    .filter((item) => {
      const status = (item.status ?? "").toUpperCase();
      return status !== "COMPLETED" && status !== "CANCELED";
    })
    .sort((a, b) => {
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    })
    .slice(0, 40);

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Workspace header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">DonorCRM • Grants</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Grant Research & Deadlines Workspace</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage opportunities, writing tasks, reminders, requirements, resources, and submission planning.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add Grant Opportunity
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Boundary Reminder</p>
        <p className="mt-1 text-sm text-blue-900">
          Grant opportunities and writing work live here. Award money received is recorded separately in Donations using a grant-received entry.
        </p>
      </div>

      {/* Stat cards */}
      <GrantStats refresh={statsRefresh} />

      {/* Triage command panel */}
      <GrantsCommandPanel grants={grants} onCreateGrant={() => setShowAdd(true)} />

      {/* Workspace controls */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_auto] gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Title, funder, program area, assignee..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scope</span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active applications</option>
              <option value="TERMINAL">Decisions/closed</option>
              {Object.entries(STATUS_META).map(([status, meta]) => (
                <option key={status} value={status}>{meta.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sort</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="DEADLINE_ASC">Deadline (soonest first)</option>
              <option value="DEADLINE_DESC">Deadline (latest first)</option>
              <option value="UPDATED_DESC">Recently updated</option>
              <option value="AMOUNT_DESC">Largest requested amount</option>
              <option value="TITLE_ASC">Title (A-Z)</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              onClick={() => setRiskOnly((value) => !value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                riskOnly
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {riskOnly ? "At-risk only: on" : "At-risk only: off"}
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setScopeFilter("ALL");
                setSortMode("DEADLINE_ASC");
                setRiskOnly(false);
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Visible grants</p>
            <p className="text-lg font-semibold text-gray-900">{visibleGrants.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">At-risk in view</p>
            <p className={`text-lg font-semibold ${atRiskCount > 0 ? "text-amber-700" : "text-gray-900"}`}>{atRiskCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Requested in view</p>
            <p className="text-lg font-semibold text-gray-900">{fmt$(requestedInView)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Potential awards, not received revenue</p>
          </div>
        </div>
      </section>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: "board", label: "Research Board" },
          { key: "library", label: "Grant Library" },
          { key: "deadlines", label: "Deadlines" },
          { key: "tasks", label: "My Grant Tasks" },
          { key: "funders", label: "Funders" },
        ] as { key: View; label: string }[]).map((viewOption) => (
          <button
            key={viewOption.key}
            onClick={() => setView(viewOption.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              view === viewOption.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {viewOption.label}
          </button>
        ))}
      </div>

      {/* ── Research board view ── */}
      {view === "board" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Research Board Layout</p>
                <p className="text-sm text-gray-700 mt-1">
                  {activeLaneCount} active stage{activeLaneCount !== 1 ? "s" : ""} populated,
                  {" "}{overloadedLanes} lane{overloadedLanes !== 1 ? "s" : ""} overloaded (6+ grants)
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Tip: use &quot;At-risk only&quot; to focus deadline triage during weekly grants meeting.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
              {pipelineSummary.map((lane) => {
                const meta = STATUS_META[lane.status];
                return (
                  <div key={lane.status} className={`rounded-lg border px-3 py-2 ${meta.border} ${meta.bg}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{lane.count}</p>
                    <p className="text-[11px] text-gray-600">At-risk: {lane.atRisk}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active stages scrollable board */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.map((status, index) => {
                const meta = STATUS_META[status];
                const col = byStatus[status] ?? [];
                const requestedForColumn = col.reduce((sum, grant) => sum + requestedAmount(grant), 0);
                const riskInColumn = col.filter((grant) => isAtRiskGrant(grant)).length;
                return (
                  <div key={status} className="w-72 shrink-0">
                    <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${meta.bg} ${meta.border} border`}>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Stage {index + 1}</p>
                        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`text-[11px] ${meta.color} opacity-80`}>{fmt$(requestedForColumn)}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            riskInColumn > 0
                              ? "text-amber-700 bg-amber-100 border-amber-200"
                              : "text-gray-500 bg-white border-gray-200"
                          }`}>
                            risk {riskInColumn}
                          </span>
                        </div>
                      </div>
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

          {!loading && activeGrants.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">No active grant opportunities match current filters.</p>
              <p className="text-xs text-gray-500 mt-1">Adjust filters or create a new grant to continue.</p>
            </div>
          )}

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

      {/* ── Grant library view ── */}
      {view === "library" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : visibleGrants.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-3xl">📄</p>
              <p className="text-gray-600 font-medium">No grants match your current filters</p>
              <p className="text-sm text-gray-400">Adjust workspace controls or create a new grant opportunity.</p>
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                + New Grant
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Grant / Funder", "Status", "Requested", "Owner", "Deadline", "Risk", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleGrants.map((g) => {
                  const meta = STATUS_META[g.status];
                  const days = getDaysUntilDeadline(g);
                  const deadlineAtRisk = days !== null && days <= 14;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{g.title}</p>
                        <p className="text-xs text-gray-400">{g.funder?.name ?? "Unknown funder"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {g.amountRequested ? `$${Number(g.amountRequested).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {g.assignee ? `${g.assignee.firstName} ${g.assignee.lastName}` : "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        {days !== null ? (
                          <span className={`text-xs ${days < 0 ? "text-gray-400" : days <= 7 ? "text-red-600 font-semibold" : days <= 30 ? "text-amber-600" : "text-gray-500"}`}>
                            {days < 0 ? "Passed" : `${days}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          deadlineAtRisk ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {deadlineAtRisk ? "At risk" : "Stable"}
                        </span>
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

      {/* ── Deadlines view ── */}
      {view === "deadlines" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : deadlineItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No upcoming grant reminders or requirement due dates yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Grant",
                    "Item",
                    "Type",
                    "Status",
                    "Due",
                    "Owner",
                    "",
                  ].map((header) => (
                    <th key={header} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deadlineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{item.grant.title}</td>
                    <td className="px-4 py-3 text-gray-700">{item.title}</td>
                    <td className="px-4 py-3 text-gray-500">{item.kind}</td>
                    <td className="px-4 py-3 text-gray-500">{item.status ?? "PENDING"}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDateLabel(item.dueAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{item.assignedToName ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/grants/${item.grant.id}`} className="text-xs text-green-700 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tasks view ── */}
      {view === "tasks" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : taskItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No active grant tasks yet. Add tasks inside a grant case file.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Grant",
                    "Task",
                    "Task Type",
                    "Priority",
                    "Status",
                    "Due",
                    "Owner",
                    "",
                  ].map((header) => (
                    <th key={header} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taskItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{item.grant.title}</td>
                    <td className="px-4 py-3 text-gray-700">{item.title}</td>
                    <td className="px-4 py-3 text-gray-500">{item.taskType ?? "Other"}</td>
                    <td className="px-4 py-3 text-gray-500">{item.priority ?? "MEDIUM"}</td>
                    <td className="px-4 py-3 text-gray-500">{item.status ?? "NOT_STARTED"}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDateLabel(item.dueAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{item.assignedToName ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/grants/${item.grant.id}`} className="text-xs text-green-700 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
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
