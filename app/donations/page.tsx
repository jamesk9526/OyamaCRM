"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DonationTable from "@/app/components/donations/DonationTable";
import { DonationRow, formatCurrency } from "@/app/components/donations/donation-utils";
import EmailFromTemplateModal from "@/app/components/donations/EmailFromTemplateModal";
import LetterFromTemplateModal from "@/app/components/donations/LetterFromTemplateModal";
import RecordGiftModal from "@/app/components/donations/RecordGiftModal";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import CRMDataTable from "@/app/components/ui/crm/CRMDataTable";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";
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
  const searchParams = useSearchParams();
  const campaignIdFilter = searchParams.get("campaignId") ?? "";
  const campaignNameFilter = searchParams.get("campaignName") ?? "";
  const recordGiftOpen = searchParams.get("recordGift") === "1";
  const recordGiftSource = searchParams.get("source") ?? "";
  const recordGiftGrantTitle = searchParams.get("grantTitle") ?? "";
  const recordGiftFunderName = searchParams.get("funderName") ?? "";
  const recordGiftSuggestedAmount = searchParams.get("suggestedAmount") ?? "";
  const [defaultRange] = useState(getCurrentYearDateInputs);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<DonationStats>({ totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 });
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [acknowledgingDonationId, setAcknowledgingDonationId] = useState<string | null>(null);
  const [actionBusyDonationId, setActionBusyDonationId] = useState<string | null>(null);
  const [emailTemplateDonation, setEmailTemplateDonation] = useState<DonationRow | null>(null);
  const [letterTemplateDonation, setLetterTemplateDonation] = useState<DonationRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [allYears, setAllYears] = useState(false);
  const [reportingYearMode, setReportingYearMode] = useState<ReportingYearMode>(getStoredReportingYearMode);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from,   setFrom]   = useState(defaultRange.from);
  const [to,     setTo]     = useState(defaultRange.to);

  const recordGiftParams = new URLSearchParams(searchParams.toString());
  recordGiftParams.set("recordGift", "1");
  if (campaignIdFilter) {
    recordGiftParams.set("source", "campaign");
    recordGiftParams.set("campaignId", campaignIdFilter);
    if (campaignNameFilter) recordGiftParams.set("campaignName", campaignNameFilter);
  }
  const recordGiftHref = `/donations?${recordGiftParams.toString()}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams = new URLSearchParams();
      if (campaignIdFilter) filterParams.set("campaignId", campaignIdFilter);
      if (search) filterParams.set("search", search);
      if (status) filterParams.set("status", status);
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
  }, [allYears, campaignIdFilter, defaultRange.from, defaultRange.to, from, page, reportingYearMode, search, setApiDown, setApiError, setDonations, setLoading, setStats, setTotal, status, to]);

  useEffect(() => { load(); }, [load]);

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

  // Filters always jump back to page 1 to avoid empty pages after narrowing.
  useEffect(() => {
    setPage(1);
  }, [search, status, from, to, allYears, campaignIdFilter]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => donations.some((row) => row.id === id)));
  }, [donations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
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
    <EnterprisePageShell
      ribbon={(
        <CRMActionBar
          context={{
            selectionCount: selectedIds.length,
            flags: {
              allYears,
            },
          }}
          commandHandlers={{
            "new-gift": () => {
              router.push(recordGiftHref);
            },
            "find-gift": () => {
              const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search donor name"]');
              searchInput?.focus();
            },
            "date-range-ytd": () => {
              setAllYears(false);
            },
            "date-range-all-years": () => {
              setAllYears(true);
            },
            "filter-gifts": () => {
              const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search donor name"]');
              searchInput?.focus();
            },
            "refresh-donations": () => {
              void load();
            },
            "clear-donation-filters": () => {
              setSearch("");
              setStatus("");
              setAllYears(false);
              setFrom(defaultRange.from);
              setTo(defaultRange.to);
            },
            "receipt-status-overview": () => {
              setStatus("COMPLETED");
            },
          }}
        />
      )}
    >
    <div className="space-y-5">
      {campaignIdFilter && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3">
          <p>
            Campaign filter active: <span className="font-semibold">{campaignNameFilter || campaignIdFilter}</span>
          </p>
          <Link href="/donations" className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
            Clear campaign filter
          </Link>
        </div>
      )}

      {apiDown && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Could not load live donations data{apiError ? ` (${apiError})` : ""}. Start with <code className="font-mono">pnpm start:server</code> if the API is offline.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CRMMetricCard label="Total Raised" value={formatCurrency(stats.totalRaised)} tone="green" icon={<DollarIcon />} helper={allYears ? "All years" : "Current year scope"} loading={loading} />
        <CRMMetricCard label="Total Gifts" value={stats.totalGifts.toLocaleString()} tone="slate" icon={<ReceiptIcon />} helper={`${total.toLocaleString()} records in view`} loading={loading} />
        <CRMMetricCard label="Completed" value={stats.completed.toLocaleString()} tone="green" icon={<CheckIcon />} helper="Completed gifts" loading={loading} />
        <CRMMetricCard label="Recurring" value={stats.recurring.toLocaleString()} tone="blue" icon={<RepeatIcon />} helper="Recurring gifts" loading={loading} />
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Donation Acknowledgment Workflow</p>
            <p className="mt-1 text-sm text-slate-700">
              Use Complete Loop for one-click stewardship orchestration, or use the row three-dot menu for individual quick actions.
            </p>
          </div>
          <CRMStatusBadge tone="green">Stewardship loop ready</CRMStatusBadge>
        </div>
      </section>

      <CRMFilterBar>
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_260px]">
          <input type="text" placeholder="Search donor name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date"
              disabled={allYears}
              className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} title="To date"
              disabled={allYears}
              className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
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
      </CRMFilterBar>

      {donations.some((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY") ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...donations.filter((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY").map((donation) => donation.id)])))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Select Visible Monthly Donors
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-950">{selectedIds.length} donation{selectedIds.length === 1 ? "" : "s"} selected</p>
            <p className="text-xs text-emerald-800">
              Create a temporary list for letters or email templates. Email-ready recipients: {selectedDonationEmailRecipients.length}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Clear</button>
            <button
              type="button"
              onClick={handleSendSelectedDonationsToEmail}
              disabled={selectedDonationEmailRecipients.length === 0}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Email for Selected Donors
            </button>
            <button type="button" onClick={handleSendSelectedDonationsToLetters} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Create Letters for Selected Donors</button>
          </div>
        </div>
      ) : null}

      <CRMDataTable>
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading donations…</div>
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
      </CRMDataTable>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-sm text-gray-500 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
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

    {recordGiftOpen ? (
      <RecordGiftModal
        source={recordGiftSource}
        campaignId={campaignIdFilter}
        campaignName={campaignNameFilter}
        grantTitle={recordGiftGrantTitle}
        funderName={recordGiftFunderName}
        suggestedAmount={recordGiftSuggestedAmount}
        onClose={closeRecordGiftModal}
        onSaved={load}
      />
    ) : null}
    </>
  );
}

function DollarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v18" />
      <path d="M17 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
