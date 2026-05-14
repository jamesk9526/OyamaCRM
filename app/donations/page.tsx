"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DonationTable from "@/app/components/donations/DonationTable";
import { DonationRow, formatCurrency } from "@/app/components/donations/donation-utils";
import { apiFetch } from "@/app/lib/auth-client";

const PAGE_SIZE = 100;

interface DonationStats {
  totalRaised: number;
  totalGifts: number;
  completed: number;
  recurring: number;
}

interface LoopActionResult {
  status: "CREATED" | "REUSED" | "SKIPPED";
  id?: string;
  reason?: string;
}

interface StewardshipLoopResponse {
  donationId: string;
  constituentId: string;
  emailDraft: LoopActionResult;
  followUpTask: LoopActionResult;
  pathEnrollment: LoopActionResult;
  redirectTo: string;
}

/** Returns YYYY-MM-DD strings for Jan 1 of current year through today's date. */
function getCurrentYearDateInputs(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return {
    from: `${y}-01-01`,
    to: `${y}-${m}-${d}`,
  };
}

export default function DonationsPage() {
  const router = useRouter();
  const defaultRange = getCurrentYearDateInputs();
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<DonationStats>({ totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 });
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [acknowledgingDonationId, setAcknowledgingDonationId] = useState<string | null>(null);
  const [actionBusyDonationId, setActionBusyDonationId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [allYears, setAllYears] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from,   setFrom]   = useState(defaultRange.from);
  const [to,     setTo]     = useState(defaultRange.to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams = new URLSearchParams();
      if (search) filterParams.set("search", search);
      if (status) filterParams.set("status", status);
      // "Include all years" explicitly disables date-range filtering.
      if (!allYears) {
        if (from) filterParams.set("from", from);
        if (to) filterParams.set("to", to);
      }

      const listParams = new URLSearchParams(filterParams);
      listParams.set("limit", String(PAGE_SIZE));
      listParams.set("page", String(page));

      const [listData, statsData] = await Promise.all([
        apiFetch<{ items?: DonationRow[]; total?: number }>(`/api/donations?${listParams.toString()}`),
        apiFetch<DonationStats>(`/api/donations/stats?${filterParams.toString()}`),
      ]);

      setDonations(listData.items ?? []);
      setTotal(listData.total ?? (listData.items ?? []).length);
      setStats({
        totalRaised: Number(statsData.totalRaised ?? 0),
        totalGifts: Number(statsData.totalGifts ?? 0),
        completed: Number(statsData.completed ?? 0),
        recurring: Number(statsData.recurring ?? 0),
      });
      setApiDown(false);
      setApiError(null);
    } catch (err) {
      setApiDown(true);
      setApiError(err instanceof Error ? err.message : "Failed to load donations data.");
    } finally {
      setLoading(false);
    }
  }, [allYears, from, page, search, status, to]);

  useEffect(() => { load(); }, [load]);

  // Filters always jump back to page 1 to avoid empty pages after narrowing.
  useEffect(() => {
    setPage(1);
  }, [search, status, from, to, allYears]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  async function handleDelete(id: string) {
    if (!confirm("Delete this donation record? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/donations/${id}`, { method: "DELETE" });
      await load();
    } catch {
      alert("Failed to delete donation. Please try again.");
    }
  }

  /** Marks one donation as acknowledged so stewardship queues can clear quickly. */
  async function handleMarkThanked(id: string) {
    setAcknowledgingDonationId(id);
    try {
      await apiFetch(`/api/donations/${id}/acknowledgment`, {
        method: "PATCH",
        body: JSON.stringify({ acknowledged: true }),
      });
      await load();
    } catch {
      alert("Failed to mark this donation as thanked. Please try again.");
    } finally {
      setAcknowledgingDonationId(null);
    }
  }

  /** Creates one donation-scoped email draft and opens Email Builder on the created draft campaign. */
  async function handleCreateEmailDraft(id: string) {
    setActionBusyDonationId(id);
    try {
      const payload = await apiFetch<{ redirectTo: string }>(`/api/donations/${id}/quick-actions/email-draft`, {
        method: "POST",
      });
      if (payload.redirectTo) {
        router.push(payload.redirectTo);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create email draft.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  /** Creates one donation follow-up call task with auto title and navigates to Tasks workspace. */
  async function handleCreateCallTask(id: string) {
    setActionBusyDonationId(id);
    try {
      const payload = await apiFetch<{ redirectTo: string }>(`/api/donations/${id}/quick-actions/call-task`, {
        method: "POST",
      });
      if (payload.redirectTo) {
        router.push(payload.redirectTo);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create call task.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  /** Enrolls donor in default steward path and opens automations view for follow-up. */
  async function handleStartPath(id: string) {
    setActionBusyDonationId(id);
    try {
      const payload = await apiFetch<{ redirectTo: string }>(`/api/donations/${id}/quick-actions/start-path`, {
        method: "POST",
      });
      if (payload.redirectTo) {
        router.push(payload.redirectTo);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start path.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  /** Runs the complete donation stewardship loop in one API call. */
  async function handleCompleteStewardshipLoop(id: string) {
    setActionBusyDonationId(id);
    try {
      const payload = await apiFetch<StewardshipLoopResponse>(`/api/donations/${id}/quick-actions/stewardship-loop`, {
        method: "POST",
      });

      const lines = [
        `Email Draft: ${payload.emailDraft.status}${payload.emailDraft.reason ? ` (${payload.emailDraft.reason})` : ""}`,
        `Follow-up Task: ${payload.followUpTask.status}${payload.followUpTask.reason ? ` (${payload.followUpTask.reason})` : ""}`,
        `Steward Path: ${payload.pathEnrollment.status}${payload.pathEnrollment.reason ? ` (${payload.pathEnrollment.reason})` : ""}`,
      ];

      const shouldNavigate = window.confirm(
        `Donation stewardship loop completed.\n\n${lines.join("\n")}\n\nOpen the next workspace now?`,
      );

      await load();

      if (shouldNavigate && payload.redirectTo) {
        router.push(payload.redirectTo);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to complete stewardship loop.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gift entry, history, and acknowledgments</p>
        </div>
        <Link href="/donations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
          <span className="text-lg leading-none">+</span> Record Gift
        </Link>
      </div>

      {apiDown && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Could not load live donations data{apiError ? ` (${apiError})` : ""}. Start with <code className="font-mono">pnpm start:server</code> if the API is offline.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Raised",  value: formatCurrency(stats.totalRaised), color: "text-green-600" },
          { label: "Total Gifts",   value: stats.totalGifts.toString(),        color: "text-gray-800"  },
          { label: "Completed",     value: stats.completed.toString(),         color: "text-gray-800"  },
          { label: "Recurring",     value: stats.recurring.toString(),         color: "text-blue-600"  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Donation Acknowledgment Workflow</p>
        <p className="mt-1 text-sm text-emerald-900">
          Use Complete Loop for one-click stewardship orchestration (email draft, follow-up task, and steward path),
          or run individual quick actions for letter generation and acknowledgment tracking.
        </p>
      </section>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-3">
          <input type="text" placeholder="Search donor name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date"
              disabled={allYears}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} title="To date"
              disabled={allYears}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={allYears}
              onChange={(e) => setAllYears(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include all years
          </label>
          {!allYears && (
            <span>Default scope: Jan 1 to today (YTD)</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading donations…</div>
        ) : (
          <DonationTable
            donations={donations}
            onDelete={handleDelete}
            onMarkThanked={handleMarkThanked}
            onCreateEmailDraft={handleCreateEmailDraft}
            onCreateCallTask={handleCreateCallTask}
            onStartPath={handleStartPath}
            onCompleteStewardshipLoop={handleCompleteStewardshipLoop}
            acknowledgingDonationId={acknowledgingDonationId}
            actionBusyDonationId={actionBusyDonationId}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>
          Showing {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of {total.toLocaleString()} donations
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
