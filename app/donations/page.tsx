"use client";

import CRMTableLoading from "@/app/components/ui/crm/CRMTableLoading";
import Link from "next/link";
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Gift, HeartHandshake, RefreshCw, Search, Wallet } from "lucide-react";
import DebouncedSearchInput from "@/app/components/donor-workspace/DebouncedSearchInput";
import DonorWorkspaceNav from "@/app/components/donor-workspace/DonorWorkspaceNav";
import { DonorQuickViews, DonorFilterPanel, DonorFilterChip, DonorSelectionBar, DonorPagination } from "@/app/components/donor-workspace/BrowsePrimitives";
import { updateBrowseQuery, positivePage } from "@/app/features/donor-workspace/browse-query";
import { useRouter, useSearchParams } from "next/navigation";
import DonationTable from "@/app/components/donations/DonationTable";
import { DonationRow, formatCurrency } from "@/app/components/donations/donation-utils";
import EmailFromTemplateModal from "@/app/components/donations/EmailFromTemplateModal";
import LetterFromTemplateModal from "@/app/components/donations/LetterFromTemplateModal";
import RecordGiftModal from "@/app/components/donations/RecordGiftModal";
import DonationFollowUpModal from "@/app/components/donations/DonationFollowUpModal";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import CRMSecondaryMenu from "@/app/components/ui/crm/CRMSecondaryMenu";
import CRMDataTable from "@/app/components/ui/crm/CRMDataTable";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import { apiFetch } from "@/app/lib/auth-client";
import { getStoredReportingYearMode, type ReportingYearMode } from "@/app/lib/fiscal-year";

const PAGE_SIZE = 100;

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

interface DonationStats {
  totalRaised: number;
  totalGifts: number;
  completed: number;
  recurring: number;
  averageGift?: number;
  pendingAcknowledgments?: number;
}

interface BulkAcknowledgmentResponse {
  acknowledgedCount: number;
  from: string;
  to: string;
  acknowledgmentSentAt: string;
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

function DonationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const constituentIdFilter = searchParams.get("constituentId") ?? "";
  const page = positivePage(searchParams.get("page"));
  const allYears = searchParams.get("allYears") === "1";
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  function changeFilters(updates: Record<string, string | null>, resetPage = true) {
    const query = updateBrowseQuery(searchParams.toString(), updates, resetPage);
    // Same-page filters drive client API reads; keep their URL updates immediate.
    window.history.replaceState(null, "", `/donations${query ? `?${query}` : ""}`);
  }
  const campaignIdFilter = searchParams.get("campaignId") ?? "";
  const campaignNameFilter = searchParams.get("campaignName") ?? "";
  const acknowledgmentFilter = searchParams.get("acknowledgment") === "pending" ? "pending" : "";
  const recordGiftOpen = searchParams.get("recordGift") === "1";
  const recordGiftSource = searchParams.get("source") ?? "";
  const recordGiftGrantTitle = searchParams.get("grantTitle") ?? "";
  const recordGiftFunderName = searchParams.get("funderName") ?? "";
  const recordGiftSuggestedAmount = searchParams.get("suggestedAmount") ?? "";
  const recordGiftEventId = searchParams.get("eventId") ?? "";
  const [recordGiftDismissed, setRecordGiftDismissed] = useState(false);
  const [defaultRange] = useState(getCurrentYearDateInputs);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<DonationStats>({ totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 });
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);
  const [followUpDonationId, setFollowUpDonationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [acknowledgingDonationId, setAcknowledgingDonationId] = useState<string | null>(null);
  const [bulkAcknowledgmentOpen, setBulkAcknowledgmentOpen] = useState(false);
  const [bulkAcknowledging, setBulkAcknowledging] = useState(false);
  const [bulkAcknowledgmentNotice, setBulkAcknowledgmentNotice] = useState<string | null>(null);
  const [actionBusyDonationId, setActionBusyDonationId] = useState<string | null>(null);
  const [emailTemplateDonation, setEmailTemplateDonation] = useState<DonationRow | null>(null);
  const [letterTemplateDonation, setLetterTemplateDonation] = useState<DonationRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [reportingYearMode, setReportingYearMode] = useState<ReportingYearMode>(getStoredReportingYearMode);

  const from = searchParams.get("from") ?? defaultRange.from;
  const to = searchParams.get("to") ?? defaultRange.to;
  const [constituentContext, setConstituentContext] = useState<{ id: string; firstName: string; lastName: string; organizationName?: string } | null>(null);
  useEffect(() => {
    let active = true;
    setConstituentContext(null);
    if (constituentIdFilter) apiFetch<{ id: string; firstName: string; lastName: string; organizationName?: string }>(`/api/constituents/${encodeURIComponent(constituentIdFilter)}`).then((person) => { if (active) setConstituentContext(person); }).catch(() => undefined);
    return () => { active = false; };
  }, [constituentIdFilter]);
  const latestLoadId = useRef(0);

  const recordGiftParams = new URLSearchParams(searchParams.toString());
  recordGiftParams.set("recordGift", "1");
  if (campaignIdFilter) {
    recordGiftParams.set("source", "campaign");
    recordGiftParams.set("campaignId", campaignIdFilter);
    if (campaignNameFilter) recordGiftParams.set("campaignName", campaignNameFilter);
  }
  const recordGiftHref = `/donations?${recordGiftParams.toString()}`;

  const load = useCallback(async () => {
    const loadId = ++latestLoadId.current;
    setLoading(true);
    setSelectedIds([]);
    if (!allYears && from && to && from > to) {
      setApiDown(true); setApiError("Start date must be on or before end date."); setLoading(false); return;
    }
    try {
      const filterParams = new URLSearchParams();
      if (constituentIdFilter) filterParams.set("constituentId", constituentIdFilter);
      if (campaignIdFilter) filterParams.set("campaignId", campaignIdFilter);
      if (search) filterParams.set("search", search);
      if (status) filterParams.set("status", status);
      if (acknowledgmentFilter) filterParams.set("acknowledgment", acknowledgmentFilter);
      // "Include all years" explicitly disables date-range filtering.
      if (!allYears) {
        const usingDefaultCalendarRange = from === defaultRange.from && to === defaultRange.to;
        if (reportingYearMode === "fiscal" && usingDefaultCalendarRange) {
          filterParams.set("scope", "CURRENT_YEAR");
          filterParams.set("dateBasis", "fiscal");
        } else {
          if (from) filterParams.set("from", from);
          if (to) filterParams.set("to", to);
        }
      }

      const listParams = new URLSearchParams(filterParams);
      listParams.set("limit", String(PAGE_SIZE));
      listParams.set("page", String(page));

      const [listData, statsData] = await Promise.all([
        apiFetch<{ items?: DonationRow[]; total?: number }>(`/api/donations?${listParams.toString()}`),
        apiFetch<DonationStats>(`/api/donations/stats?${filterParams.toString()}`),
      ]);

      if (loadId !== latestLoadId.current) return;
      setDonations(listData.items ?? []);
      const resultTotal = listData.total ?? (listData.items ?? []).length;
      setTotal(resultTotal);
      const lastPage = Math.max(1, Math.ceil(resultTotal / PAGE_SIZE));
      if (page > lastPage) window.history.replaceState(null, "", `/donations?${updateBrowseQuery(window.location.search, { page: String(lastPage) }, false)}`);
      setStats({
        totalRaised: Number(statsData.totalRaised ?? 0),
        totalGifts: Number(statsData.totalGifts ?? 0),
        completed: Number(statsData.completed ?? 0),
        recurring: Number(statsData.recurring ?? 0),
        averageGift: statsData.averageGift,
        pendingAcknowledgments: statsData.pendingAcknowledgments,
      });
      setApiDown(false);
      setApiError(null);
    } catch (err) {
      if (loadId !== latestLoadId.current) return;
      setApiDown(true);
      setApiError(err instanceof Error ? err.message : "Failed to load donations data.");
    } finally {
      if (loadId === latestLoadId.current) setLoading(false);
    }
  }, [acknowledgmentFilter, allYears, constituentIdFilter, campaignIdFilter, defaultRange.from, defaultRange.to, from, page, reportingYearMode, search, setApiDown, setApiError, setDonations, setLoading, setSelectedIds, setStats, setTotal, status, to]);

  useEffect(() => {
    void load();
    return () => { latestLoadId.current += 1; };
  }, [load]);

  useEffect(() => {
    const handleReportingModeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ReportingYearMode }>).detail;
      setReportingYearMode(detail?.mode === "fiscal" ? "fiscal" : "calendar");
    };
    window.addEventListener("reporting-year-mode:changed", handleReportingModeChange);
    return () => {
      window.removeEventListener("reporting-year-mode:changed", handleReportingModeChange);
    };
  }, []);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => donations.some((row) => row.id === id)));
  }, [donations]);

  // Restore the URL-driven dialog after a genuine new open, while allowing a
  // close action to disappear immediately instead of waiting for navigation.
  useEffect(() => {
    if (recordGiftOpen) setRecordGiftDismissed(false);
  }, [recordGiftOpen]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedDonationRows = useMemo(
    () => donations.filter((donation) => selectedIds.includes(donation.id)),
    [donations, selectedIds],
  );
  const selectedDonationEmailRecipients = useMemo(
    () => Array.from(new Set(selectedDonationRows
      .map((donation) => normalizeEmail(donation.constituent.email))
      .filter((email) => email && isEmailLike(email)))),
    [selectedDonationRows],
  );
  const selectedDonationConstituentIds = useMemo(
    () => Array.from(new Set(selectedDonationRows.map((donation) => donation.constituent.id).filter(Boolean))),
    [selectedDonationRows],
  );
  const hasActiveFilters = Boolean(search || status || allYears || from !== defaultRange.from || to !== defaultRange.to || campaignIdFilter || acknowledgmentFilter || constituentIdFilter);
  const bulkScopeRestricted = Boolean(constituentIdFilter || campaignIdFilter || search || (status && status !== "COMPLETED"));

  function clearFilters() { changeFilters({ search: null, status: null, allYears: null, from: null, to: null, campaignId: null, campaignName: null, acknowledgment: null, constituentId: null }); }
  const dateError = !allYears && from && to && from > to ? "Start date must be on or before end date." : "";
  const averageGift = stats.averageGift ?? (stats.completed > 0 ? Math.round(stats.totalRaised * 100 / stats.completed) / 100 : 0);
  const periodLabel = allYears ? "All years" : reportingYearMode === "fiscal" && from === defaultRange.from && to === defaultRange.to ? "Current fiscal year" : `${from || "Any start"} → ${to || "Any end"}`;

  async function handleDelete(id: string) {
    if (!confirm("Delete this donation record? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/donations/${id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Failed to delete donation. Please try again.");
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
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Failed to mark this donation as thanked. Please try again.");
    } finally {
      setAcknowledgingDonationId(null);
    }
  }

  async function handleBulkMarkThanked() {
    if (!from || !to || allYears || from > to || bulkScopeRestricted) return;
    setBulkAcknowledging(true);
    try {
      const result = await apiFetch<BulkAcknowledgmentResponse>("/api/donations/acknowledgments/bulk", {
        method: "PATCH",
        body: JSON.stringify({ from, to, confirmed: true }),
      });
      setBulkAcknowledgmentNotice(
        result.acknowledgedCount > 0
          ? `${result.acknowledgedCount.toLocaleString()} completed gift${result.acknowledgedCount === 1 ? "" : "s"} marked as thanked for ${result.from} through ${result.to}. No communication was sent.`
          : "No unthanked completed gifts matched that date range.",
      );
      setBulkAcknowledgmentOpen(false);
      await load();
    } catch (error) {
      setBulkAcknowledgmentNotice(error instanceof Error ? error.message : "Could not bulk mark gifts as thanked.");
    } finally {
      setBulkAcknowledging(false);
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
      setActionError(error instanceof Error ? error.message : "Failed to create email draft.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  /** Creates one donation follow-up call task with auto title and navigates to Tasks workspace. */
  function handleCreateCallTask(id: string) { setFollowUpDonationId(id); }

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
      setActionError(error instanceof Error ? error.message : "Failed to start path.");
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
      setActionError(error instanceof Error ? error.message : "Failed to complete stewardship loop.");
    } finally {
      setActionBusyDonationId(null);
    }
  }

  /** Opens the Email From Template modal for the selected donation row. */
  function handleOpenEmailFromTemplate(id: string) {
    const d = donations.find((x) => x.id === id) ?? null;
    setEmailTemplateDonation(d);
  }

  /** Opens the Letter From Template modal for the selected donation row. */
  function handleOpenLetterFromTemplate(id: string) {
    const d = donations.find((x) => x.id === id) ?? null;
    setLetterTemplateDonation(d);
  }

  /** Opens the canonical batch letter workspace with a temporary donor list from selected gifts. */
  function handleSendSelectedDonationsToLetters() {
    if (selectedDonationConstituentIds.length === 0) return;

    const temporaryListId = `selected-donations-${Date.now()}`;
    window.sessionStorage.setItem(`oyama-letters:temporary-recipient-list:${temporaryListId}`, JSON.stringify({
      name: `Selected donation donors (${selectedDonationConstituentIds.length})`,
      constituentIds: selectedDonationConstituentIds,
      donationIds: selectedDonationRows.map((donation) => donation.id),
      createdAt: new Date().toISOString(),
    }));
    router.push(`/oyama-letters/generate?mode=batch&temporaryListId=${encodeURIComponent(temporaryListId)}&source=donations`);
  }

  /** Opens the canonical email campaign wizard with a temporary recipient segment from selected gifts. */
  function handleSendSelectedDonationsToEmail() {
    if (selectedDonationEmailRecipients.length === 0) return;

    const temporarySegmentId = `selected-donations-${Date.now()}`;
    window.sessionStorage.setItem(`oyama-email:temporary-recipient-segment:${temporarySegmentId}`, JSON.stringify({
      name: `Selected donation emails (${selectedDonationEmailRecipients.length})`,
      recipientEmails: selectedDonationEmailRecipients,
      donationIds: selectedDonationRows.map((donation) => donation.id),
      createdAt: new Date().toISOString(),
      source: "donations",
    }));
    router.push(`/oyama-email/campaigns/new?temporarySegmentId=${encodeURIComponent(temporarySegmentId)}&source=donations`);
  }

  /** Closes the Record Gift modal while preserving ledger filters such as campaign scope. */
  function closeRecordGiftModal() {
    setRecordGiftDismissed(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("recordGift");
    params.delete("source");
    params.delete("grantTitle");
    params.delete("funderName");
    params.delete("suggestedAmount");
    const next = params.toString();
    router.replace(next ? `/donations?${next}` : "/donations");
  }

  return (
    <>
    <EnterprisePageShell className="donor-daily-workspace">
    <div className="space-y-4">
      <DonorWorkspaceNav />
      <CRMPageHeader breadcrumb="Donor CRM" title="Donations" description="Review giving history and manage acknowledgments."
        primaryAction={<Link href={recordGiftHref} className="donor-button donor-button-primary">Record Gift</Link>}
        secondaryActions={<><button type="button" className="donor-button" onClick={() => void load()} disabled={loading} aria-label="Refresh donations"><RefreshCw size={15} />Refresh</button><CRMSecondaryMenu>
          {donations.some((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY") ? <button type="button" className="donor-button" onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...donations.filter((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY").map((donation) => donation.id)])))}>Select monthly gifts on this page</button> : null}
        </CRMSecondaryMenu></>}
      />
      {constituentIdFilter && <div className="donor-context-banner"><div><span className="donor-eyebrow">SUPPORTER GIVING HISTORY</span><strong>{constituentContext ? constituentContext.organizationName || `${constituentContext.firstName} ${constituentContext.lastName}` : "Selected constituent"}</strong><p>Gift totals and actions below apply to this supporter.</p></div><div className="flex flex-wrap gap-2"><Link href={`/constituents/${encodeURIComponent(constituentIdFilter)}`} className="donor-button">View constituent</Link><button type="button" className="donor-button" onClick={() => changeFilters({ constituentId: null })}>View all supporters</button></div></div>}
      {acknowledgmentFilter ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          <div>
            <p><span className="font-semibold">Acknowledgment queue:</span> showing completed gifts that still need a receipt or thank-you.</p>
            <p className="mt-1 text-xs text-amber-800">{bulkScopeRestricted ? "Range acknowledgment is unavailable while supporter, campaign, or search filters are applied. Individual gift actions remain available." : "For historic imports, review an entire completed-gift date range before marking it thanked. No communication is sent."}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBulkAcknowledgmentOpen(true)}
              disabled={allYears || !from || !to || from > to || bulkScopeRestricted}
              title={bulkScopeRestricted ? "Range acknowledgment applies across the organization. Clear supporter, campaign, and search filters before using it." : "Review the entire completed-gift date range before updating"}
              className="rounded-[2px] border border-amber-700 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark date range thanked
            </button>
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-amber-800 hover:text-amber-950">
              Clear queue filter
            </button>
          </div>
        </div>
      ) : null}

      {bulkAcknowledgmentNotice ? (
        <div className="flex items-start justify-between gap-3 rounded-[4px] border border-[#0f6cbd] bg-[#eff6fc] px-4 py-3 text-sm text-[#0f548c]">
          <p>{bulkAcknowledgmentNotice}</p>
          <button type="button" onClick={() => setBulkAcknowledgmentNotice(null)} className="shrink-0 text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      ) : null}

      {actionError && <div className="donor-inline-error" role="alert">{actionError}<button type="button" onClick={() => setActionError(null)}>Dismiss</button></div>}
      {apiDown ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Could not load donations. {apiError}</p><button type="button" className="donor-button mt-3" onClick={() => void load()} disabled={loading}>Retry</button>
      </div> : null}
      <section className="donor-browse-metrics" aria-label="Filtered donation summary">
        <CRMMetricCard label="Completed giving" value={apiDown ? "—" : formatCurrency(stats.totalRaised)} icon={<Wallet size={17} />} helper="Completed gifts across all matching pages" loading={loading} />
        <CRMMetricCard label="Matching gifts" value={apiDown ? "—" : stats.totalGifts.toLocaleString()} icon={<Gift size={17} />} helper={`${stats.completed.toLocaleString()} completed · ${stats.recurring.toLocaleString()} recurring`} loading={loading} />
        <CRMMetricCard label="Average completed gift" value={apiDown ? "—" : formatCurrency(averageGift)} icon={<Wallet size={17} />} helper="Completed giving ÷ completed gift count" loading={loading} />
        <CRMMetricCard label="Awaiting acknowledgment" value={apiDown ? "—" : stats.pendingAcknowledgments?.toLocaleString() ?? "—"} icon={<HeartHandshake size={17} />} helper="Completed gifts not yet marked thanked" loading={loading} />
      </section>
      <CRMFilterBar><div className="donor-browse-filters">
        <div className="donor-browse-filter-heading"><DonorQuickViews label="Donation quick views" items={[
          { label: "All gifts", active: !status && !acknowledgmentFilter, onClick: () => changeFilters({ status: null, acknowledgment: null }) },
          { label: "Needs thanks", active: acknowledgmentFilter === "pending", onClick: () => changeFilters({ acknowledgment: "pending", status: null }) },
          { label: "Completed", active: status === "COMPLETED" && !acknowledgmentFilter, onClick: () => changeFilters({ status: "COMPLETED", acknowledgment: null }) },
          { label: "Pending", active: status === "PENDING" && !acknowledgmentFilter, onClick: () => changeFilters({ status: "PENDING", acknowledgment: null }) },
        ]} /><span className="donor-scope-note">{periodLabel}</span></div>
        <label className="donor-browse-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search donations by donor name or email</span><DebouncedSearchInput resetKey={searchParams.toString()} placeholder="Find gifts by supporter name or email" value={search} onSearch={(value) => changeFilters({ search: value })} /></label>
        <DonorFilterPanel count={[status, allYears || from !== defaultRange.from || to !== defaultRange.to, campaignIdFilter, constituentIdFilter].filter(Boolean).length}>
          <label>Donation status<select value={status} onChange={(event) => changeFilters({ status: event.target.value, acknowledgment: null })}><option value="">All statuses</option><option value="COMPLETED">Completed</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select></label>
          <label>From date<input type="date" disabled={allYears} value={from} onChange={(event) => changeFilters({ from: event.target.value })} /></label>
          <label>To date<input type="date" disabled={allYears} value={to} onChange={(event) => changeFilters({ to: event.target.value })} /></label>
          <label className="donor-checkbox-label"><input type="checkbox" checked={allYears} onChange={(event) => changeFilters({ allYears: event.target.checked ? "1" : null })} />Include all years</label>
        </DonorFilterPanel>
        {dateError && <p role="alert" className="text-sm text-red-700">{dateError}</p>}
        {hasActiveFilters && <div className="donor-active-filters" aria-label="Applied donation filters">{search && <DonorFilterChip label={`Search: ${search}`} onRemove={() => changeFilters({ search: null })} />}{status && <DonorFilterChip label={status.toLowerCase()} onRemove={() => changeFilters({ status: null })} />}{acknowledgmentFilter && <DonorFilterChip label="Needs thanks" onRemove={() => changeFilters({ acknowledgment: null })} />}{campaignIdFilter && <DonorFilterChip label={`Campaign: ${campaignNameFilter || campaignIdFilter}`} onRemove={() => changeFilters({ campaignId: null, campaignName: null })} />}{allYears && <DonorFilterChip label="All years" onRemove={() => changeFilters({ allYears: null })} />}<button type="button" className="donor-text-link" onClick={clearFilters}>Clear filters</button></div>}
      </div></CRMFilterBar>
      {selectedIds.length > 0 && <DonorSelectionBar count={selectedIds.length} noun="gift" description={`${selectedDonationConstituentIds.length} supporters · ${selectedDonationEmailRecipients.length} unique email addresses. Outreach opens for review.`} onClear={() => setSelectedIds([])}>
        <button type="button" className="donor-button" onClick={handleSendSelectedDonationsToEmail} disabled={selectedDonationEmailRecipients.length === 0}>Prepare email</button><button type="button" className="donor-button" onClick={handleSendSelectedDonationsToLetters}>Prepare letters</button>
      </DonorSelectionBar>}

      {!apiDown ? <CRMDataTable>
        {loading ? (
          <CRMTableLoading label="Loading donations…" />
        ) : (
          <DonationTable
            donations={donations}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onDelete={handleDelete}
            onMarkThanked={handleMarkThanked}
            onCreateEmailDraft={handleCreateEmailDraft}
            onEmailFromTemplate={handleOpenEmailFromTemplate}
            onLetterFromTemplate={handleOpenLetterFromTemplate}
            onCreateCallTask={handleCreateCallTask}
            onStartPath={handleStartPath}
            onCompleteStewardshipLoop={handleCompleteStewardshipLoop}
            acknowledgingDonationId={acknowledgingDonationId}
            actionBusyDonationId={actionBusyDonationId}
          />
        )}
      </CRMDataTable> : null}

      {!apiDown && <DonorPagination page={page} pageSize={PAGE_SIZE} total={total} totalPages={totalPages} loading={loading} onPage={(next) => changeFilters({ page: String(next) }, false)} />}

    </div>
    </EnterprisePageShell>

    {/* Email From Template modal — sits outside the shell scroll container so it overlays the full viewport */}
    {emailTemplateDonation && (
      <EmailFromTemplateModal
        donation={{
          donationId: emailTemplateDonation.id,
          donorName: `${emailTemplateDonation.constituent.firstName} ${emailTemplateDonation.constituent.lastName}`.trim(),
          donorEmail: emailTemplateDonation.constituent.email,
          amount: emailTemplateDonation.amount,
          date: emailTemplateDonation.date,
        }}
        onClose={() => setEmailTemplateDonation(null)}
      />
    )}

    {letterTemplateDonation && (
      <LetterFromTemplateModal
        donation={{
          donationId: letterTemplateDonation.id,
          constituentId: letterTemplateDonation.constituent.id,
          donorName: `${letterTemplateDonation.constituent.firstName} ${letterTemplateDonation.constituent.lastName}`.trim(),
          amount: letterTemplateDonation.amount,
          date: letterTemplateDonation.date,
        }}
        onClose={() => setLetterTemplateDonation(null)}
      />
    )}

    {recordGiftOpen && !recordGiftDismissed ? (
      <RecordGiftModal
        constituentId={constituentIdFilter}
        source={recordGiftSource}
        campaignId={campaignIdFilter}
        campaignName={campaignNameFilter}
        grantTitle={recordGiftGrantTitle}
        funderName={recordGiftFunderName}
        suggestedAmount={recordGiftSuggestedAmount}
        eventId={recordGiftEventId}
        onClose={closeRecordGiftModal}
        onSaved={load}
      />
    ) : null}
    {followUpDonationId && <DonationFollowUpModal donationId={followUpDonationId} onClose={() => setFollowUpDonationId(null)} />}
    {bulkAcknowledgmentOpen ? (
      <BulkAcknowledgmentDialog
        from={from}
        to={to}
        busy={bulkAcknowledging}
        onClose={() => setBulkAcknowledgmentOpen(false)}
        onConfirm={() => void handleBulkMarkThanked()}
      />
    ) : null}
    </>
  );
}

function BulkAcknowledgmentDialog({
  from,
  to,
  busy,
  onClose,
  onConfirm,
}: {
  from: string;
  to: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-acknowledgment-title"
      onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
        <div className="border-b border-[#d1d1d1] bg-[#f3f2f1] px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0f548c]">Historical acknowledgment</p>
          <h2 id="bulk-acknowledgment-title" className="mt-1 text-lg font-semibold text-[#242424]">Mark completed gifts as thanked</h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-[#424242]">
          <p>Mark every currently unthanked <strong>completed</strong> gift dated from <strong>{from}</strong> through <strong>{to}</strong> as acknowledged.</p>
          <p className="border-l-2 border-[#0f6cbd] bg-[#eff6fc] px-3 py-2 text-xs leading-5 text-[#0f548c]">This only updates the acknowledgment status. It does not send an email, generate a letter, or alter gift amounts.</p>
          <p className="text-xs text-[#616161]">The exact date range and number of changed gifts are recorded in the audit log.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#d1d1d1] px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 border border-[#c8c6c4] bg-white px-3 text-xs font-semibold text-[#424242] hover:bg-[#f3f2f1] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="h-9 border border-[#0f6cbd] bg-[#0f6cbd] px-3 text-xs font-semibold text-white hover:bg-[#115ea3] disabled:opacity-50">{busy ? "Marking..." : "Mark range thanked"}</button>
        </div>
      </div>
    </div>
  );
}

export default function DonationsPage() { return <Suspense fallback={<p role="status">Opening donations…</p>}><DonationsWorkspace /></Suspense>; }
