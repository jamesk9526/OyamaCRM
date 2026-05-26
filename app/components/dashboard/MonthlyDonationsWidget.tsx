/**
 * MonthlyDonationsWidget — Dashboard card showing running donation total for the current month.
 * Displays total amount + donor count, with a modal that lists each donor who gave
 * and offers follow-up task, saved audience, and email-draft actions.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";

interface MonthDonor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  amount: number;
  lastDate: string;
  giftCount: number;
}

interface MonthlyData {
  total: number;
  count: number;
  giftCount: number;
  monthLabel: string;
  donors: MonthDonor[];
}

interface SavedRecipientList {
  id: string;
  name: string;
  recipientsCount: number;
}

interface EmailCampaignDraft {
  id: string;
}

type EmailTemplateKey = "thank-you" | "impact-update" | "recurring-invite";

const EMAIL_TEMPLATES: Array<{ key: EmailTemplateKey; label: string; subject: string; body: string }> = [
  {
    key: "thank-you",
    label: "Thank-you note",
    subject: "Thank you for your gift this month",
    body: "Thank you for your generous gift this month. Your support is helping us continue meaningful ministry work in the community.\n\nWe are grateful for your partnership and will keep you updated on the impact your gift is making.",
  },
  {
    key: "impact-update",
    label: "Monthly impact update",
    subject: "Your gift is making an impact",
    body: "Thank you for giving this month. We wanted to share a brief update on how donor support is moving the mission forward.\n\nBecause of partners like you, our team can keep serving with consistency and care.",
  },
  {
    key: "recurring-invite",
    label: "Recurring gift invitation",
    subject: "Would you consider making your support monthly?",
    body: "Thank you for your recent gift. If it fits your giving plans, monthly support helps us plan with confidence and sustain ministry throughout the year.\n\nWe are grateful for every way you choose to partner with us.",
  },
];

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mergeMonthlyDonors(rows: MonthDonor[]): MonthDonor[] {
  const donorsById = new Map<string, MonthDonor>();

  rows.forEach((row) => {
    const existing = donorsById.get(row.id);
    if (!existing) {
      donorsById.set(row.id, { ...row });
      return;
    }

    const existingLastDate = new Date(existing.lastDate);
    const rowLastDate = new Date(row.lastDate);
    donorsById.set(row.id, {
      ...existing,
      amount: existing.amount + row.amount,
      giftCount: existing.giftCount + row.giftCount,
      lastDate: rowLastDate > existingLastDate ? row.lastDate : existing.lastDate,
      email: existing.email ?? row.email,
    });
  });

  return Array.from(donorsById.values()).sort((a, b) => b.amount - a.amount);
}

export default function MonthlyDonationsWidget() {
  const router = useRouter();
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedRecipientList | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiFetch<MonthlyData>("/api/reports/donors-this-month");
      setData(result);
      setSelectedIds(new Set(result.donors.map((donor) => donor.id)));
      setSavedList(null);
    } catch {
      setData(null);
      setSelectedIds(new Set());
      setLoadError("This month's donor report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen]);

  const monthLabel = data?.monthLabel ?? new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const donors = useMemo(() => mergeMonthlyDonors(data?.donors ?? []), [data?.donors]);
  const selectedDonors = donors.filter((donor) => selectedIds.has(donor.id));
  const selectedEmailDonors = selectedDonors.filter((donor) => Boolean(donor.email));
  const donorCount = donors.length;

  function clearActionState() {
    setActionMessage(null);
    setActionError(null);
  }

  function replaceSelection(ids: string[]) {
    clearActionState();
    setSavedList(null);
    setSelectedIds(new Set(ids));
  }

  function toggleDonor(id: string) {
    clearActionState();
    setSavedList(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addTaskForDonor(donor: MonthDonor) {
    clearActionState();
    setSaving(`task-${donor.id}`);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `Thank ${donor.firstName} ${donor.lastName} for this month's gift`,
          type: "THANK_YOU",
          priority: "MEDIUM",
          constituentId: donor.id,
          dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          description: `${donor.firstName} ${donor.lastName} gave ${formatUsd(donor.amount)} in ${monthLabel}. Review gift history and complete an appropriate thank-you or follow-up.`,
          sourceModule: "donor",
          sourceType: "dashboard_this_month_donors",
          sourceId: donor.id,
        }),
      });
      setActionMessage(`Task created for ${donor.firstName} ${donor.lastName}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create donor task.");
    } finally {
      setSaving(null);
    }
  }

  async function saveTaskForSelectedDonors() {
    clearActionState();
    if (selectedDonors.length === 0) {
      setActionError("Select at least one donor before saving a follow-up task.");
      return;
    }
    setSaving("bulk-task");
    try {
      const donorLines = selectedDonors
        .map((donor) => `- ${donor.firstName} ${donor.lastName}: ${formatUsd(donor.amount)}${donor.email ? ` (${donor.email})` : ""}`)
        .join("\n");
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `Follow up with ${selectedDonors.length} ${monthLabel} donor${selectedDonors.length === 1 ? "" : "s"}`,
          type: "FOLLOW_UP",
          priority: "HIGH",
          dueDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          description: `Use this task to coordinate stewardship for donors who gave in ${monthLabel}.\n\n${donorLines}`,
          sourceModule: "donor",
          sourceType: "dashboard_this_month_donors",
          metadata: JSON.stringify({
            monthLabel,
            donorIds: selectedDonors.map((donor) => donor.id),
          }),
        }),
      });
      setActionMessage("Follow-up task saved with this month's donor list.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save donor-list task.");
    } finally {
      setSaving(null);
    }
  }

  async function ensureSavedAudienceList(): Promise<SavedRecipientList | null> {
    if (savedList) return savedList;
    if (selectedEmailDonors.length === 0) {
      setActionError("Select at least one donor with an email address before saving an audience list.");
      return null;
    }

    const created = await apiFetch<SavedRecipientList>("/api/email-campaigns/lists", {
      method: "POST",
      body: JSON.stringify({
        name: `${monthLabel} Donors`,
        description: `Dashboard-generated list of donors who gave in ${monthLabel}.`,
        recipientEmails: selectedEmailDonors
          .map((donor) => donor.email)
          .filter((email): email is string => Boolean(email)),
      }),
    });
    setSavedList(created);
    return created;
  }

  async function saveAudienceList() {
    clearActionState();
    setSaving("audience");
    try {
      const list = await ensureSavedAudienceList();
      if (list) setActionMessage(`Saved audience list "${list.name}" with ${list.recipientsCount} recipient${list.recipientsCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save audience list.");
    } finally {
      setSaving(null);
    }
  }

  async function createEmailDraft(templateKey: EmailTemplateKey) {
    clearActionState();
    setSaving(`email-${templateKey}`);
    try {
      const list = await ensureSavedAudienceList();
      if (!list) return;
      const template = EMAIL_TEMPLATES.find((item) => item.key === templateKey) ?? EMAIL_TEMPLATES[0];
      const campaign = await apiFetch<EmailCampaignDraft>("/api/email-campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: `${monthLabel} Donors - ${template.label}`,
          subject: template.subject,
          bodyText: template.body,
          preparationStatus: "DRAFT",
          sharedWithOrganization: true,
          audienceFilter: {
            type: "active",
            _quickSelection: {
              sendMode: "SAVED_LIST",
              recipientListId: list.id,
            },
          },
        }),
      });
      router.push(`/communications/${campaign.id}?mode=build`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create email draft.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Running total row ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{monthLabel}</p>
          {loading ? (
            <div className="h-8 w-24 mt-1 bg-gray-200 rounded animate-pulse" />
          ) : loadError ? (
            <p className="mt-0.5 text-2xl font-bold text-slate-400">Unavailable</p>
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-0.5 tabular-nums">
              {formatUsd(data?.total ?? 0)}
            </p>
          )}
          {!loading && !loadError && (
            <p className="text-xs text-gray-500 mt-1">
              {data?.giftCount ?? 0} gift{(data?.giftCount ?? 0) !== 1 ? "s" : ""} from{" "}
              <span className="font-medium text-gray-700">{donorCount}</span> donor{donorCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* Green accent icon */}
        <span className="shrink-0 w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>

      {/* ── View donors modal trigger ── */}
      {!loading && !loadError && donorCount > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          View {donorCount} donor{donorCount !== 1 ? "s" : ""} who gave this month
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={loading || Boolean(loadError) || donors.length === 0}
          className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:border-green-200 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Manage donor list
        </button>
        <Link
          href="/communications?view=templates"
          className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:border-green-200 hover:bg-green-50"
        >
          Email templates
        </Link>
      </div>

      {!loading && loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {loadError} Try refreshing the dashboard or opening Reports.
        </div>
      )}

      {!loading && !loadError && donorCount === 0 && (
        <p className="text-xs text-gray-400 italic">No donations recorded yet this month.</p>
      )}

      {modalOpen && data ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Donors who gave in ${monthLabel}`}>
          <button
            type="button"
            aria-label="Close donor list"
            className="absolute inset-0"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Who gave this month</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{monthLabel} donors</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {data.giftCount} gift{data.giftCount === 1 ? "" : "s"} from {donorCount} donor{donorCount === 1 ? "" : "s"} totaling {formatUsd(data.total)}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    Showing one row per donor · {selectedDonors.length} selected · {selectedEmailDonors.length} with email
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => replaceSelection(donors.map((donor) => donor.id))}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => replaceSelection([])}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-100">
                    {donors.map((donor) => (
                      <div key={donor.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 hover:bg-slate-50 sm:grid-cols-[auto_minmax(0,1fr)_minmax(14rem,auto)]">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(donor.id)}
                          onChange={() => toggleDonor(donor.id)}
                          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                          aria-label={`Select ${donor.firstName} ${donor.lastName}`}
                        />
                        <div className="min-w-0">
                          <Link href={`/constituents/${donor.id}`} className="truncate text-sm font-semibold text-slate-900 hover:text-green-700">
                            {donor.firstName} {donor.lastName}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {donor.email ?? "No email on file"}
                          </p>
                        </div>
                        <div className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:col-span-1">
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">This month</p>
                            <p className="text-sm font-semibold tabular-nums text-slate-950">{formatUsd(donor.amount)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <span>{donor.giftCount} gift{donor.giftCount === 1 ? "" : "s"}</span>
                            <span className="text-right">Last gift {formatDate(donor.lastDate)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void addTaskForDonor(donor)}
                            disabled={saving === `task-${donor.id}`}
                            className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-60"
                          >
                            {saving === `task-${donor.id}` ? "Saving..." : "Add task"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="border-t border-slate-100 bg-slate-50/70 p-4 lg:border-l lg:border-t-0">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void saveTaskForSelectedDonors()}
                    disabled={saving === "bulk-task" || selectedDonors.length === 0}
                    className="w-full rounded-xl border border-green-600 bg-green-600 px-3 py-2 text-left text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving === "bulk-task" ? "Saving task..." : "Save task with selected donors"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAudienceList()}
                    disabled={saving === "audience" || selectedEmailDonors.length === 0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:border-green-200 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving === "audience" ? "Saving list..." : "Save email audience list"}
                  </button>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Email template starters</p>
                    <div className="mt-2 space-y-2">
                      {EMAIL_TEMPLATES.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => void createEmailDraft(template.key)}
                          disabled={saving === `email-${template.key}` || selectedEmailDonors.length === 0}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-green-200 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving === `email-${template.key}` ? "Creating..." : template.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {savedList ? (
                    <Link
                      href="/contacts-manager"
                      className="block rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100"
                    >
                      Saved list: {savedList.name}
                    </Link>
                  ) : null}
                  <Link href="/communications?view=templates" className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Browse all email templates
                  </Link>
                  <Link href="/letters-printables/generate" className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    Create printable thank-you letters
                  </Link>
                  <Link href="/donations?filter=this-month" className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    View all donations this month
                  </Link>
                </div>

                {actionMessage ? (
                  <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{actionMessage}</p>
                ) : null}
                {actionError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
