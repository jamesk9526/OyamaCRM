"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Search, Users, Heart, UserRoundSearch, UserRoundPlus } from "lucide-react";
import DonorWorkspaceNav from "@/app/components/donor-workspace/DonorWorkspaceNav";
import { DonorQuickViews, DonorFilterPanel, DonorFilterChip, DonorSelectionBar, DonorPagination } from "@/app/components/donor-workspace/BrowsePrimitives";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import { updateBrowseQuery, positivePage } from "@/app/features/donor-workspace/browse-query";
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

type DirectoryView = "all" | "active" | "lapsed" | "prospects";

function ConstituentsWorkspace() {
  const params = useSearchParams();
  const search = params.get("search") || ""; const typeFilter = params.get("type") || ""; const statusFilter = params.get("status") || "";
  const givingFrom = params.get("givingFrom") || ""; const givingThrough = params.get("givingThrough") || "";
  const page = positivePage(params.get("page"));
  const requestedSize = positivePage(params.get("pageSize"), 50);
  const pageSize = [25, 50, 100, 250, 500].includes(requestedSize) ? requestedSize : 50;
  function changeFilters(updates: Record<string, string | null>, resetPage = true) {
    const query = updateBrowseQuery(params.toString(), updates, resetPage);
    // These filters drive client-side API reads. Next synchronizes native history
    // with useSearchParams without waiting for a server navigation per keystroke.
    window.history.replaceState(null, "", `/constituents${query ? `?${query}` : ""}`);
  }
  function clearFilters() { changeFilters({ search: null, type: null, status: null, givingFrom: null, givingThrough: null }); }
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [retry, setRetry] = useState(0);
  const latestLoadId = useRef(0);
  const [summary, setSummary] = useState<ConstituentsPageResponse["summary"] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const loadId = ++latestLoadId.current;
    setLoading(true);
    setError(null);
    setSelectedIds([]);
    async function load() {
      try {
        const params = new URLSearchParams();
        if (givingFrom) params.set("givingFrom", givingFrom);
        if (givingThrough) params.set("givingThrough", givingThrough);
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const data = await apiFetch<ConstituentsPageResponse | ConstituentRow[]>(`/api/constituents?${params}`);

        if (loadId !== latestLoadId.current) return;
        if (Array.isArray(data)) {
          setSummary(null);
          setConstituents(data);
          setTotal(data.length);
          setTotalPages(data.length > 0 ? 1 : 0);
          return;
        }

        setConstituents(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
        setSummary(data.summary ?? null);

        if ((data.totalPages ?? 0) > 0 && page > (data.totalPages ?? 0)) {
          const next = updateBrowseQuery(window.location.search, { page: String(data.totalPages) }, false);
          window.history.replaceState(null, "", `/constituents?${next}`);
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
  }, [search, typeFilter, statusFilter, givingFrom, givingThrough, page, pageSize, retry]);

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
      setActionError("Selected constituents do not have an email address. Add at least one email before starting an email template.");
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
      setActionError("Select at least one constituent before starting an email template.");
      return;
    }
    setActionError(null);
    createTemporaryEmailSegment(ids);
  }

  function handleLetterTemplate(ids: string[]) {
    if (ids.length === 0) {
      setActionError("Select at least one constituent before starting a letter template.");
      return;
    }
    setActionError(null);
    createTemporaryLettersList(ids);
  }

  async function handleCloseAccount(id: string) {
    if (!confirm("Close this constituent account everywhere? The record history will be retained, but the person will disappear from normal CRM use and all future outreach.")) return;
    try {
      await apiFetch(`/api/constituents/${id}/close`, { method: "POST", body: JSON.stringify({ reason: "Closed from constituent directory" }) });
      setConstituents((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(prev - 1, 0));
      setRetry((current) => current + 1);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Failed to close constituent account. Please try again.");
    }
  }

  const hasFilters = Boolean(search || typeFilter || statusFilter || givingFrom || givingThrough);
  const activeDirectoryView: DirectoryView | null = !typeFilter && !statusFilter ? "all"
    : typeFilter === "PROSPECT" && !statusFilter ? "prospects"
    : !typeFilter && statusFilter === "ACTIVE" ? "active"
    : !typeFilter && statusFilter === "LAPSED" ? "lapsed" : null;

  function applyDirectoryView(view: DirectoryView) {
    changeFilters({ type: view === "prospects" ? "PROSPECT" : null, status: view === "active" ? "ACTIVE" : view === "lapsed" ? "LAPSED" : null });
  }

  function handleMerged(keepId: string) {
    setShowMergeModal(false);
    setSelectedIds([]);
    window.location.href = `/constituents/${keepId}`;
  }

  return (
    <EnterprisePageShell className="donor-daily-workspace">
      <div className="space-y-4">
      <DonorWorkspaceNav />
      <CRMPageHeader breadcrumb="Donor CRM" title="Constituents" description="Find a supporter, review their history, and take the next step."
        primaryAction={<Link href="/constituents/new" className="donor-button donor-button-primary">Add constituent</Link>}
        secondaryActions={<><button type="button" className="donor-button" disabled={loading} onClick={() => setRetry((current) => current + 1)} aria-label="Refresh constituents"><RefreshCw size={15} />Refresh</button><CRMSecondaryMenu><Link href="/data-tools/import" className="donor-button">Import data</Link><Link href="/donor-research" className="donor-button">Donor research</Link></CRMSecondaryMenu></>}
      />
      <section className="donor-browse-metrics" aria-label="Filtered constituent summary">
        <CRMMetricCard label="Matching constituents" value={error ? "—" : total.toLocaleString()} icon={<Users size={17} />} helper="Across all matching pages" loading={loading} />
        <CRMMetricCard label="Active relationships" value={error ? "—" : summary?.active.toLocaleString() ?? "—"} icon={<Heart size={17} />} helper="Active and major donor statuses" loading={loading} />
        <CRMMetricCard label="Lapsed relationships" value={error ? "—" : summary?.lapsed.toLocaleString() ?? "—"} icon={<UserRoundSearch size={17} />} helper="Stored lapsed donor status" loading={loading} />
        <CRMMetricCard label="Prospects" value={error ? "—" : summary?.prospects.toLocaleString() ?? "—"} icon={<UserRoundPlus size={17} />} helper="Prospect constituent type" loading={loading} />
      </section>
      <CRMFilterBar><div className="donor-browse-filters">
        <div className="donor-browse-filter-heading"><DonorQuickViews label="Constituent quick views" items={([["all", "All"], ["active", "Active"], ["lapsed", "Lapsed"], ["prospects", "Prospects"]] as const).map(([view, label]) => ({ label, active: activeDirectoryView === view, onClick: () => applyDirectoryView(view) }))} /><span className="donor-scope-note">Stored relationship status · not period giving</span></div>
        <label className="donor-browse-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search constituents</span><input id="constituent-search" type="search" placeholder="Find a supporter by name, email, or phone" value={search} onChange={(event) => changeFilters({ search: event.target.value })} /></label>
        <DonorFilterPanel count={[typeFilter, statusFilter].filter(Boolean).length}>
          <label>Constituent type<select value={typeFilter} onChange={(event) => changeFilters({ type: event.target.value })}><option value="">All types</option>{CONSTITUENT_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label>
          <label>Donor status<select value={statusFilter} onChange={(event) => changeFilters({ status: event.target.value })}><option value="">All statuses</option>{DONOR_STATUSES.map((status) => <option key={status} value={status}>{status === "MAJOR_DONOR" ? "Major donor" : status.charAt(0) + status.slice(1).toLowerCase()}</option>)}</select></label>
        </DonorFilterPanel>
        {hasFilters && <div className="donor-active-filters" aria-label="Applied constituent filters">{(givingFrom || givingThrough) && <DonorFilterChip label="Completed gifts in dashboard period" onRemove={() => changeFilters({ givingFrom: null, givingThrough: null })} />}{search && <DonorFilterChip label={`Search: ${search}`} onRemove={() => changeFilters({ search: null })} />}{typeFilter && <DonorFilterChip label={typeLabel(typeFilter)} onRemove={() => changeFilters({ type: null })} />}{statusFilter && <DonorFilterChip label={statusFilter.replaceAll("_", " ").toLowerCase()} onRemove={() => changeFilters({ status: null })} />}<button type="button" className="donor-text-link" onClick={clearFilters}>Clear filters</button></div>}
      </div></CRMFilterBar>
      {actionError && <div role="alert" className="donor-inline-error">{actionError}<button type="button" onClick={() => setActionError(null)}>Dismiss</button></div>}
      {error ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Could not load constituents. {error}</p><button type="button" className="donor-button mt-3" onClick={() => setRetry((current) => current + 1)} disabled={loading}>Retry</button>
      </div> : null}
      {selectedIds.length > 0 && <DonorSelectionBar count={selectedIds.length} noun="constituent" description={`${selectedEmailCount} unique email addresses. Outreach opens for review; nothing is sent here.`} onClear={() => setSelectedIds([])}>
        <button type="button" className="donor-button" disabled={selectedEmailCount === 0} onClick={() => handleEmailTemplate(selectedIds)}>Prepare email</button>
        <button type="button" className="donor-button" onClick={() => handleLetterTemplate(selectedIds)}>Prepare letters</button>
        {selectedIds.length >= 2 && <button type="button" className="donor-button" onClick={() => setShowMergeModal(true)}>Review merge</button>}
      </DonorSelectionBar>}

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
          onClearFilters={clearFilters}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </CRMDataTable> : null}

      {!error && <DonorPagination page={page} pageSize={pageSize} total={total} totalPages={totalPages} loading={loading} onPage={(next) => changeFilters({ page: String(next) }, false)} onPageSize={(size) => changeFilters({ pageSize: String(size) })} />}

      </div>
    </EnterprisePageShell>
  );
}

export default function ConstituentsPage() { return <Suspense fallback={<p role="status">Opening constituents…</p>}><ConstituentsWorkspace /></Suspense>; }
