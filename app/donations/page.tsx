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
  const awaitingAcknowledgmentCount = useMemo(
    () => donations.filter((donation) => !donation.acknowledgmentSentAt).length,
    [donations],
  );
  const filteredCountLabel = `${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`;
  const hasActiveFilters = Boolean(search || status || allYears || from !== defaultRange.from || to !== defaultRange.to || campaignIdFilter);

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
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f6fbf8_0%,#ffffff_58%,#eef6ff_100%)] shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] lg:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Donation Ledger
              </span>
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                {allYears ? "All years" : "Current reporting window"}
              </span>
              {campaignIdFilter ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                  Campaign scoped
                </span>
              ) : null}
            </div>
            <div>
              <h1 className="text-[30px] font-semibold tracking-tight text-slate-950 sm:text-[34px]">Donations</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Compact gift operations for receipts, stewardship handoff, and campaign-scoped review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={recordGiftHref} className="inline-flex h-9 items-center rounded-lg bg-emerald-700 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
                Record Gift
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Refresh Ledger
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <CompactSummaryTile label="Records In View" value={loading ? "—" : total.toLocaleString()} detail={hasActiveFilters ? "Filtered ledger scope" : "Current working set"} />
            <CompactSummaryTile label="Needs Receipt" value={loading ? "—" : awaitingAcknowledgmentCount.toLocaleString()} detail="Acknowledgment still pending" tone="amber" />
            <CompactSummaryTile label="Selected" value={selectedIds.length.toLocaleString()} detail={selectedIds.length > 0 ? "Ready for batch handoff" : "No rows selected"} tone="blue" />
          </div>
        </div>
      </section>

      {campaignIdFilter && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
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

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <CRMMetricCard label="Total Raised" value={formatCurrency(stats.totalRaised)} tone="green" icon={<DollarIcon />} helper={allYears ? "All years" : "Current year scope"} loading={loading} />
        <CRMMetricCard label="Total Gifts" value={stats.totalGifts.toLocaleString()} tone="slate" icon={<ReceiptIcon />} helper={`${total.toLocaleString()} records in view`} loading={loading} />
        <CRMMetricCard label="Completed" value={stats.completed.toLocaleString()} tone="green" icon={<CheckIcon />} helper="Completed gifts" loading={loading} />
        <CRMMetricCard label="Recurring" value={stats.recurring.toLocaleString()} tone="blue" icon={<RepeatIcon />} helper="Recurring gifts" loading={loading} />
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Donation Acknowledgment Workflow</p>
            <p className="mt-1 text-sm text-slate-700">
              Use Complete Loop for one-click stewardship orchestration, or use the row three-dot menu for individual quick actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CRMStatusBadge tone="green">Stewardship loop ready</CRMStatusBadge>
            <span className="text-xs text-slate-500">{awaitingAcknowledgmentCount.toLocaleString()} gifts still need receipt follow-up</span>
          </div>
        </div>
      </section>

      <CRMFilterBar>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Filter And Working Scope</p>
              <p className="text-xs text-slate-500">Search the ledger, narrow the time window, and keep batch actions in one place.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                Showing {filteredCountLabel}
              </span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setAllYears(false);
                    setFrom(defaultRange.from);
                    setTo(defaultRange.to);
                  }}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid min-w-0 gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_180px_260px_auto]">
            <input type="text" placeholder="Search donor name or email…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date"
                disabled={allYears}
                className="rounded-xl border border-slate-200 px-2.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} title="To date"
                disabled={allYears}
                className="rounded-xl border border-slate-200 px-2.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allYears}
                  onChange={(e) => setAllYears(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Include all years
              </label>
              {!allYears ? (
                <span className="text-xs text-slate-500">Default scope: Jan 1 to today</span>
              ) : null}
            </div>
          </div>
        </div>
      </CRMFilterBar>

      {donations.some((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY") ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <p>Recurring gifts are in this page view. Use the shortcut below to start one selection path for recurring donor follow-up.</p>
          <button
            type="button"
            onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...donations.filter((donation) => donation.isRecurring && String(donation.frequency ?? "MONTHLY").toUpperCase() === "MONTHLY").map((donation) => donation.id)])))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Select Monthly Donors In View
          </button>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Selected Donor Handoff</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">{selectedIds.length} donation{selectedIds.length === 1 ? "" : "s"} selected</p>
            <p className="text-xs text-emerald-800">
              Route this selection into one of the canonical outreach workspaces. Email-ready recipients: {selectedDonationEmailRecipients.length}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Clear Selection</button>
            <button
              type="button"
              onClick={handleSendSelectedDonationsToEmail}
              disabled={selectedDonationEmailRecipients.length === 0}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send To Email Workspace
            </button>
            <button type="button" onClick={handleSendSelectedDonationsToLetters} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Send To Letters Workspace</button>
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

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of {total.toLocaleString()} donations
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
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
            className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
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

function CompactSummaryTile({
  label,
  value,
  detail,
  tone = "emerald",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "emerald" | "amber" | "blue";
}) {
  const toneClass = tone === "amber"
    ? "border-amber-200 bg-amber-50/80 text-amber-900"
    : tone === "blue"
      ? "border-blue-200 bg-blue-50/80 text-blue-900"
      : "border-emerald-200 bg-white/85 text-slate-900";

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
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
