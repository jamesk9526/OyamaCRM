"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import ConstituentTable from "@/app/components/constituents/ConstituentTable";
import {
  ConstituentRow,
  CONSTITUENT_TYPES,
  DONOR_STATUSES,
  typeLabel,
} from "@/app/components/constituents/constituent-utils";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import CRMDataTable from "@/app/components/ui/crm/CRMDataTable";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";
import { apiFetch } from "@/app/lib/auth-client";

type ConstituentsPageResponse = {
  items: ConstituentRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: {
    total: number;
    active: number;
    lapsed: number;
    prospects: number;
  };
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];
type DirectoryView = "all" | "active" | "lapsed" | "prospects";

export default function ConstituentsPage() {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<ConstituentsPageResponse["summary"]>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const data = await apiFetch<ConstituentsPageResponse | ConstituentRow[]>(`/api/constituents?${params}`);

        if (Array.isArray(data)) {
          setConstituents(data);
          setTotal(data.length);
          setTotalPages(data.length > 0 ? 1 : 0);
          setSummary({
            total: data.length,
            active: data.filter((c) => c.donorStatus === "ACTIVE" || c.donorStatus === "MAJOR_DONOR").length,
            lapsed: data.filter((c) => c.donorStatus === "LAPSED").length,
            prospects: data.filter((c) => c.type === "PROSPECT").length,
          });
          return;
        }

        setConstituents(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
        setSummary(data.summary);

        if ((data.totalPages ?? 0) > 0 && page > (data.totalPages ?? 0)) {
          setPage(data.totalPages);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, typeFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, pageSize]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => constituents.some((row) => row.id === id)));
  }, [constituents]);

  const stats = {
    total: summary?.total ?? total,
    active: summary?.active ?? constituents.filter((c) => c.donorStatus === "ACTIVE" || c.donorStatus === "MAJOR_DONOR").length,
    lapsed: summary?.lapsed ?? constituents.filter((c) => c.donorStatus === "LAPSED").length,
    prospects: summary?.prospects ?? constituents.filter((c) => c.type === "PROSPECT").length,
  };

  const selectedEmailCount = Array.from(new Set(
    getSelectionByIds(selectedIds)
      .map((row) => (row.email || "").trim().toLowerCase())
      .filter(Boolean),
  )).length;

  function getSelectionByIds(ids: string[]) {
    const idSet = new Set(ids);
    return constituents.filter((row) => idSet.has(row.id));
  }

  function createTemporaryEmailSegment(ids: string[]) {
    const selected = getSelectionByIds(ids);
    const recipients = Array.from(new Set(selected.map((row) => (row.email || "").trim().toLowerCase()).filter(Boolean)));
    if (recipients.length === 0) {
      setError("Selected constituents do not have an email address. Add at least one email before starting an email template.");
      return;
    }

    const segmentId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `segment-${Date.now()}`;

    const payload = {
      name: `Selected donors (${recipients.length})`,
      recipientEmails: recipients,
      createdAt: new Date().toISOString(),
      source: "constituent-directory",
    };

    window.sessionStorage.setItem(`oyama-email:temporary-recipient-segment:${segmentId}`, JSON.stringify(payload));
    window.location.href = `/oyama-email/campaigns/new?temporarySegmentId=${encodeURIComponent(segmentId)}`;
  }

  function createTemporaryLettersList(ids: string[]) {
    const selected = getSelectionByIds(ids);
    const constituentIds = Array.from(new Set(selected.map((row) => row.id).filter(Boolean)));
    if (constituentIds.length === 0) {
      setError("Select at least one constituent before launching a letters template.");
      return;
    }

    const listId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `list-${Date.now()}`;

    const payload = {
      name: `Constituent selection (${constituentIds.length})`,
      constituentIds,
      donationIds: [],
      createdAt: new Date().toISOString(),
    };

    window.sessionStorage.setItem(`oyama-letters:temporary-recipient-list:${listId}`, JSON.stringify(payload));
    window.location.href = `/oyama-letters/generate?mode=batch&temporaryListId=${encodeURIComponent(listId)}`;
  }

  function handleEmailTemplate(ids: string[]) {
    if (ids.length === 0) {
      setError("Select at least one constituent before starting an email template.");
      return;
    }
    setError(null);
    createTemporaryEmailSegment(ids);
  }

  function handleLetterTemplate(ids: string[]) {
    if (ids.length === 0) {
      setError("Select at least one constituent before starting a letter template.");
      return;
    }
    setError(null);
    createTemporaryLettersList(ids);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this constituent? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/constituents/${id}`, { method: "DELETE" });
      setConstituents((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch {
      alert("Failed to delete constituent. Please try again.");
    }
  }

  const hasFilters = Boolean(search || typeFilter || statusFilter);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const filteredCountLabel = `${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`;
  const activeDirectoryView: DirectoryView | null = search
    ? null
    : typeFilter === "PROSPECT"
      ? "prospects"
      : statusFilter === "ACTIVE"
        ? "active"
        : statusFilter === "LAPSED"
          ? "lapsed"
          : "all";

  function applyDirectoryView(view: DirectoryView) {
    setSearch("");
    setPage(1);
    if (view === "active") {
      setTypeFilter("");
      setStatusFilter("ACTIVE");
      return;
    }
    if (view === "lapsed") {
      setTypeFilter("");
      setStatusFilter("LAPSED");
      return;
    }
    if (view === "prospects") {
      setTypeFilter("PROSPECT");
      setStatusFilter("");
      return;
    }
    setTypeFilter("");
    setStatusFilter("");
  }

  return (
    <EnterprisePageShell
      ribbon={(
        <CRMActionBar
          context={{
            selectionCount: selectedIds.length,
            flags: {
              hasFilters,
            },
          }}
          commandHandlers={{
            "view-all-constituents": () => {
              setTypeFilter("");
              setStatusFilter("");
              setPage(1);
            },
            "view-active-donors": () => {
              setTypeFilter("");
              setStatusFilter("ACTIVE");
              setPage(1);
            },
            "view-prospects": () => {
              setTypeFilter("PROSPECT");
              setStatusFilter("");
              setPage(1);
            },
            "clear-filters": () => {
              setSearch("");
              setTypeFilter("");
              setStatusFilter("");
              setPage(1);
            },
            "advanced-filter": () => {
              const filterInput = document.querySelector<HTMLInputElement>('input[type="search"]');
              filterInput?.focus();
            },
            "send-email": () => handleEmailTemplate(selectedIds),
            "generate-letter": () => handleLetterTemplate(selectedIds),
          }}
        />
      )}
    >
      <div className="space-y-4">
      <section className="overflow-hidden rounded-[4px] border border-[#d1d1d1] bg-white">
        <div className="px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-[2px] bg-[#eff6fc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f548c]">
                  Donor CRM / Directory
                </span>
                <span className="inline-flex items-center rounded-[2px] bg-[#f3f2f1] px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-[#d1d1d1]">
                  {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Live portfolio view"}
                </span>
              </div>
              <div>
                <h1 className="text-[30px] font-semibold tracking-tight text-slate-950 sm:text-[34px]">Constituents</h1>
                <p className="mt-1 text-sm text-slate-600">Search, segment, and act on one live donor directory. The counts below are interactive views, not duplicated dashboard metrics.</p>
              </div>
            </div>
            <Link href="/data-tools/import" className="inline-flex h-9 shrink-0 items-center justify-center rounded-[2px] border border-[#c8c6c4] bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-[#f3f2f1] hover:text-[#0f548c]">
              Import data
            </Link>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Constituent directory quick views">
            <DirectoryViewCard label="All records" value={loading ? "—" : stats.total.toLocaleString()} detail="Full directory" active={activeDirectoryView === "all"} onClick={() => applyDirectoryView("all")} />
            <DirectoryViewCard label="Active donors" value={loading ? "—" : stats.active.toLocaleString()} detail="Engaged supporters" active={activeDirectoryView === "active"} tone="indigo" onClick={() => applyDirectoryView("active")} />
            <DirectoryViewCard label="Lapsed" value={loading ? "—" : stats.lapsed.toLocaleString()} detail="Re-engagement queue" active={activeDirectoryView === "lapsed"} tone="amber" onClick={() => applyDirectoryView("lapsed")} />
            <DirectoryViewCard label="Prospects" value={loading ? "—" : stats.prospects.toLocaleString()} detail="Cultivation queue" active={activeDirectoryView === "prospects"} tone="sky" onClick={() => applyDirectoryView("prospects")} />
          </div>
        </div>
      </section>

      <CRMFilterBar>
        <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Find and segment</p>
            <p className="text-xs text-slate-500">Narrow the live directory, then select records for coordinated donor work.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-[2px] bg-[#f3f2f1] px-2.5 py-1 text-[11px] font-medium text-slate-700">
              Showing {filteredCountLabel}
            </span>
            {hasFilters ? (
              <button
                onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }}
                className="inline-flex h-8 items-center rounded-[2px] border border-[#c8c6c4] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-[#f3f2f1]"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_170px] lg:items-center">
        <input
          type="search"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-0 rounded-[2px] border border-[#8a8886] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-[2px] border border-[#8a8886] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
        >
          <option value="">All Types</option>
          {CONSTITUENT_TYPES.map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-[2px] border border-[#8a8886] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
        >
          <option value="">All Statuses</option>
          {DONOR_STATUSES.map((s) => (
            <option key={s} value={s}>{s === "MAJOR_DONOR" ? "Major Donor" : s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number.parseInt(e.target.value, 10) || 100);
            setPage(1);
          }}
          className="rounded-[2px] border border-[#8a8886] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        </div>
        </div>
      </CRMFilterBar>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[#0f6cbd] bg-[#eff6fc] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f548c]">Selected constituent scope</p>
            <p className="mt-1 text-sm font-semibold text-[#242424]">{selectedIds.length} constituent{selectedIds.length === 1 ? "" : "s"} selected</p>
              <p className="text-xs text-[#0f548c]">
                {selectedEmailCount > 0
                  ? `${selectedEmailCount} unique email recipient${selectedEmailCount === 1 ? " is" : "s are"} ready for a reviewed template campaign.`
                  : "No email addresses are available in this selection. Add an email before starting a template campaign."}
              </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleEmailTemplate(selectedIds)}
              className="rounded-[2px] border border-[#0f6cbd] bg-white px-3 py-2 text-xs font-semibold text-[#0f548c] hover:bg-[#deecf9]"
            >
              Use Email Template
            </button>
            <button
              type="button"
              onClick={() => handleLetterTemplate(selectedIds)}
              className="rounded-[2px] border border-[#0f6cbd] bg-white px-3 py-2 text-xs font-semibold text-[#0f548c] hover:bg-[#deecf9]"
            >
              Letter Template
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-[2px] border border-[#0f6cbd] bg-white px-3 py-2 text-xs font-semibold text-[#0f548c] hover:bg-[#deecf9]"
            >
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}

      <CRMDataTable>
        <ConstituentTable
          constituents={constituents}
          loading={loading && !error}
          onDelete={handleDelete}
          onEmailTemplate={(id) => handleEmailTemplate([id])}
          onLetterTemplate={(id) => handleLetterTemplate([id])}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </CRMDataTable>

      {!loading && !error && total > 0 && (
        <div className="flex flex-col gap-3 rounded-[4px] border border-[#d1d1d1] bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-gray-900">{rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()}</span> of <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>
            {hasFilters ? <CRMStatusBadge tone="green" className="ml-2">Filtered</CRMStatusBadge> : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page.toLocaleString()} of {Math.max(totalPages, 1).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading || (totalPages > 0 && page >= totalPages)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>
    </EnterprisePageShell>
  );
}

function DirectoryViewCard({
  label,
  value,
  detail,
  active,
  onClick,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  active: boolean;
  onClick: () => void;
  tone?: "slate" | "indigo" | "amber" | "sky";
}) {
  const toneClass = tone === "indigo"
    ? "border-[#cfe4fa] bg-[#eff6fc] text-[#0f3b61] hover:border-[#0f6cbd]"
    : tone === "amber"
      ? "border-amber-100 bg-amber-50/80 text-amber-950 hover:border-amber-300"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50/80 text-sky-950 hover:border-sky-300"
        : "border-[#d1d1d1] bg-white text-slate-950 hover:border-[#0f6cbd]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[4px] border border-t-2 px-3.5 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f6cbd] focus:ring-offset-1 ${toneClass} ${active ? "border-t-[#0f6cbd] ring-2 ring-[#0f6cbd] ring-offset-1" : "border-t-[#d1d1d1]"}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </button>
  );
}
