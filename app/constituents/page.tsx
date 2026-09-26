"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import ConstituentTable from "@/app/components/constituents/ConstituentTable";
import {
  ConstituentRow,
  CONSTITUENT_TYPES,
  DONOR_STATUSES,
  typeLabel,
} from "@/app/components/constituents/constituent-utils";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import CRMSecondaryMenu from "@/app/components/ui/crm/CRMSecondaryMenu";
import CRMDataTable from "@/app/components/ui/crm/CRMDataTable";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";
import { apiFetch } from "@/app/lib/auth-client";
import ConstituentMergeModal from "@/app/components/constituents/ConstituentMergeModal";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [retry, setRetry] = useState(0);
  const latestLoadId = useRef(0);

  useEffect(() => {
    const loadId = ++latestLoadId.current;
    setLoading(true);
    setError(null);
    setSelectedIds([]);
    async function load() {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const data = await apiFetch<ConstituentsPageResponse | ConstituentRow[]>(`/api/constituents?${params}`);

        if (loadId !== latestLoadId.current) return;
        if (Array.isArray(data)) {
          setConstituents(data);
          setTotal(data.length);
          setTotalPages(data.length > 0 ? 1 : 0);
          return;
        }

        setConstituents(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);

        if ((data.totalPages ?? 0) > 0 && page > (data.totalPages ?? 0)) {
          setPage(data.totalPages);
        }
      } catch (err) {
        if (loadId !== latestLoadId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (loadId === latestLoadId.current) setLoading(false);
      }
    }
    const timer = setTimeout(load, search ? 300 : 0);
    return () => { clearTimeout(timer); latestLoadId.current += 1; };
  }, [search, typeFilter, statusFilter, page, pageSize, retry]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, pageSize]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => constituents.some((row) => row.id === id)));
  }, [constituents]);

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

  async function handleCloseAccount(id: string) {
    if (!confirm("Close this constituent account everywhere? The record history will be retained, but the person will disappear from normal CRM use and all future outreach.")) return;
    try {
      await apiFetch(`/api/constituents/${id}/close`, { method: "POST", body: JSON.stringify({ reason: "Closed from constituent directory" }) });
      setConstituents((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch {
      alert("Failed to close constituent account. Please try again.");
    }
  }

  const hasFilters = Boolean(search || typeFilter || statusFilter);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const activeDirectoryView: DirectoryView | null = !typeFilter && !statusFilter ? "all"
    : typeFilter === "PROSPECT" && !statusFilter ? "prospects"
    : !typeFilter && statusFilter === "ACTIVE" ? "active"
    : !typeFilter && statusFilter === "LAPSED" ? "lapsed" : null;

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

  function handleMerged(keepId: string) {
    setShowMergeModal(false);
    setSelectedIds([]);
    window.location.href = `/constituents/${keepId}`;
  }

  return (
    <EnterprisePageShell className="donor-daily-workspace">
      <div className="space-y-4">
      <CRMPageHeader breadcrumb="Donor CRM" title="Constituents" description="Find a supporter, review their history, and take the next step."
        primaryAction={<Link href="/constituents/new" className="donor-button donor-button-primary">Add constituent</Link>}
        secondaryActions={<CRMSecondaryMenu><Link href="/data-tools/import" className="donor-button">Import data</Link><Link href="/donor-research" className="donor-button">Donor research</Link></CRMSecondaryMenu>}
      />
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2" aria-label="Constituent quick views">
        {([
          ["all", "All"], ["active", "Active"], ["lapsed", "Lapsed"], ["prospects", "Prospects"],
        ] as const).map(([view, label]) => <button key={view} type="button" onClick={() => applyDirectoryView(view)} aria-pressed={activeDirectoryView === view}
          className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${activeDirectoryView === view ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}
      </div>
      <CRMFilterBar>
        <div className="w-full min-w-0 space-y-3">
          <label htmlFor="constituent-search" className="block text-sm font-semibold text-slate-800">Search constituents</label>
          <input id="constituent-search" type="search" placeholder="Name, email, or phone" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
          <details className="rounded-lg border border-slate-200 px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-700">Filters{typeFilter || statusFilter ? " · Applied" : ""}</summary>
            <div className="grid gap-3 pb-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Type
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="">All types</option>{CONSTITUENT_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">Status
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="">All statuses</option>{DONOR_STATUSES.map((status) => <option key={status} value={status}>{status === "MAJOR_DONOR" ? "Major donor" : status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
            </div>
          </details>
          {hasFilters ? <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {search ? <span>Search: {search}</span> : null}{typeFilter ? <CRMStatusBadge tone="blue">{typeLabel(typeFilter)}</CRMStatusBadge> : null}{statusFilter ? <CRMStatusBadge tone="blue">{statusFilter.replaceAll("_", " ").toLowerCase()}</CRMStatusBadge> : null}
            <button type="button" className="donor-button" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }}>Clear filters</button>
          </div> : null}
        </div>
      </CRMFilterBar>
      {error ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Could not load constituents. {error}</p><button type="button" className="donor-button mt-3" onClick={() => setRetry((current) => current + 1)} disabled={loading}>Retry</button>
      </div> : null}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[#0f6cbd] bg-[#eff6fc] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0f548c]">Selected on this page</p>
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
            {selectedIds.length >= 2 ? (
              <button
                type="button"
                onClick={() => setShowMergeModal(true)}
                className="rounded-[2px] border border-[#0f6cbd] bg-white px-3 py-2 text-xs font-semibold text-[#0f548c] hover:bg-[#deecf9]"
              >
                Merge constituents
              </button>
            ) : null}
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

      {showMergeModal ? (
        <ConstituentMergeModal
          constituents={getSelectionByIds(selectedIds)}
          onClose={() => setShowMergeModal(false)}
          onMerged={handleMerged}
        />
      ) : null}

      {!error ? <CRMDataTable>
        <ConstituentTable
          constituents={constituents}
          loading={loading && !error}
          onCloseAccount={handleCloseAccount}
          onEmailTemplate={(id) => handleEmailTemplate([id])}
          onLetterTemplate={(id) => handleLetterTemplate([id])}
          filtered={hasFilters}
          onClearFilters={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </CRMDataTable> : null}

      {!loading && !error && total > 0 && (
        <div className="flex flex-col gap-3 rounded-[4px] border border-[#d1d1d1] bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-gray-900">{rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()}</span> of <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>
            {hasFilters ? <CRMStatusBadge tone="green" className="ml-2">Filtered</CRMStatusBadge> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">Rows per page
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
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
