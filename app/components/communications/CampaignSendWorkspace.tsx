/** Send controls workspace for a single campaign mailing. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type {
  AudienceSummary,
  SavedRecipientList,
} from "@/app/components/communications/campaign-workspace-types";
import {
  AUDIENCE_TYPE_LABELS,
  AUDIENCE_TYPES,
} from "@/app/components/communications/campaign-workspace-utils";

interface Props {
  campaignId: string;
  status: string;
  scheduledAt?: string | null;
  defaultAudienceType: (typeof AUDIENCE_TYPES)[number];
  onSent: () => Promise<void>;
}

type SendMode = "CAMPAIGN_AUDIENCE" | "SEGMENT" | "SAVED_LIST" | "LIST" | "INDIVIDUAL";

/** Converts an ISO datetime string into a local datetime-local input value. */
function toDatetimeLocalValue(isoValue?: string | null): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** CampaignSendWorkspace manages audience, segment, list, individual, and schedule controls for one mailing. */
export default function CampaignSendWorkspace({
  campaignId,
  status,
  scheduledAt,
  defaultAudienceType,
  onSent,
}: Props) {
  const [sendMode, setSendMode] = useState<SendMode>("CAMPAIGN_AUDIENCE");
  const [segmentType, setSegmentType] = useState<(typeof AUDIENCE_TYPES)[number]>(defaultAudienceType);
  const [recipientListText, setRecipientListText] = useState("");
  const [individualEmail, setIndividualEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [scheduledAtInput, setScheduledAtInput] = useState(toDatetimeLocalValue(scheduledAt));
  const [savedLists, setSavedLists] = useState<SavedRecipientList[]>([]);
  const [selectedSavedListId, setSelectedSavedListId] = useState<string>("");
  const [newSavedListName, setNewSavedListName] = useState("");
  const [audienceSummary, setAudienceSummary] = useState<AudienceSummary | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipientList = useMemo(
    () => recipientListText
      .split(/[\n,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    [recipientListText],
  );

  /** Loads saved recipient lists for reusable list-based sends across campaigns. */
  async function refreshSavedLists() {
    setLoadingLists(true);
    try {
      const lists = await apiFetch<SavedRecipientList[]>("/api/email-campaigns/lists");
      const safeLists = Array.isArray(lists) ? lists : [];
      setSavedLists(safeLists);
      if (!selectedSavedListId && safeLists.length > 0) {
        setSelectedSavedListId(safeLists[0].id);
      }
    } catch {
      setSavedLists([]);
    } finally {
      setLoadingLists(false);
    }
  }

  useEffect(() => {
    void refreshSavedLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setScheduledAtInput(toDatetimeLocalValue(scheduledAt));
  }, [scheduledAt]);

  useEffect(() => {
    let cancelled = false;

    async function loadAudiencePreview() {
      if (!(sendMode === "CAMPAIGN_AUDIENCE" || sendMode === "SEGMENT")) {
        setAudienceSummary(null);
        return;
      }

      setLoadingAudience(true);
      setError(null);
      try {
        const audienceType = sendMode === "SEGMENT" ? segmentType : defaultAudienceType;
        const payload = await apiFetch<{ audience: AudienceSummary }>("/api/email-campaigns/audience-preview", {
          method: "POST",
          body: JSON.stringify({
            audienceFilter: { type: audienceType },
          }),
        });
        if (!cancelled) {
          setAudienceSummary(payload.audience);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load audience preview.");
        }
      } finally {
        if (!cancelled) {
          setLoadingAudience(false);
        }
      }
    }

    void loadAudiencePreview();
    return () => {
      cancelled = true;
    };
  }, [defaultAudienceType, segmentType, sendMode]);

  /** Saves the currently typed one-time list into a reusable named saved list. */
  async function handleCreateSavedList() {
    if (!newSavedListName.trim()) {
      setError("Provide a name before saving this list.");
      return;
    }
    if (recipientList.length === 0) {
      setError("Add at least one recipient email before saving this list.");
      return;
    }

    setSavingList(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<SavedRecipientList>("/api/email-campaigns/lists", {
        method: "POST",
        body: JSON.stringify({
          name: newSavedListName.trim(),
          recipientEmails: recipientList,
        }),
      });
      setMessage("Saved list created.");
      setNewSavedListName("");
      await refreshSavedLists();
      setSelectedSavedListId(created.id);
      setSendMode("SAVED_LIST");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create saved list.");
    } finally {
      setSavingList(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const recipientEmails = sendMode === "LIST"
        ? recipientList
        : sendMode === "INDIVIDUAL"
          ? [individualEmail.trim().toLowerCase()]
          : undefined;

      const audienceFilter = sendMode === "SEGMENT"
        ? { type: segmentType }
        : undefined;

      await apiFetch(`/api/email-campaigns/${campaignId}/send`, {
        method: "POST",
        body: JSON.stringify({
          sendMode,
          audienceFilter,
          recipientListId: sendMode === "SAVED_LIST" ? selectedSavedListId : undefined,
          recipientEmails,
        }),
      });

      setMessage("Campaign send started successfully.");
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send campaign.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/email-campaigns/${campaignId}/send-test`, {
        method: "POST",
        body: JSON.stringify({ toEmail: testEmail.trim().toLowerCase() }),
      });
      setMessage("Test email sent.");
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email.");
    } finally {
      setSendingTest(false);
    }
  }

  /** Schedules or reschedules this campaign from the workspace without leaving the page. */
  async function handleSchedule() {
    if (!scheduledAtInput) {
      setError("Choose a schedule date and time first.");
      return;
    }

    const date = new Date(scheduledAtInput);
    if (Number.isNaN(date.getTime())) {
      setError("Schedule date is invalid.");
      return;
    }

    setScheduling(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/email-campaigns/${campaignId}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: date.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      setMessage("Campaign scheduled.");
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule campaign.");
    } finally {
      setScheduling(false);
    }
  }

  /** Cancels a scheduled campaign from the workspace controls. */
  async function handleCancelSchedule() {
    setCancellingSchedule(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/email-campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      setMessage("Schedule cancelled.");
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel schedule.");
    } finally {
      setCancellingSchedule(false);
    }
  }

  const canSendCampaign = status === "DRAFT" || status === "SCHEDULED";

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Send Workspace</h2>
        <p className="mt-0.5 text-xs text-gray-500">Prepare, schedule, test, and send this mailing from one centralized workspace.</p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule Controls</label>
          <input
            type="datetime-local"
            value={scheduledAtInput}
            onChange={(event) => setScheduledAtInput(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSchedule}
              disabled={scheduling || !(status === "DRAFT" || status === "SCHEDULED")}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
            >
              {scheduling ? "Saving..." : status === "SCHEDULED" ? "Reschedule" : "Schedule"}
            </button>
            {status === "SCHEDULED" && (
              <button
                onClick={handleCancelSchedule}
                disabled={cancellingSchedule}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
              >
                {cancellingSchedule ? "Cancelling..." : "Cancel Schedule"}
              </button>
            )}
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Send Mode</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { id: "CAMPAIGN_AUDIENCE", label: "Saved Audience" },
            { id: "SEGMENT", label: "Segment" },
            { id: "SAVED_LIST", label: "Saved List" },
            { id: "LIST", label: "One-time List" },
            { id: "INDIVIDUAL", label: "Individual" },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSendMode(mode.id as SendMode)}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                sendMode === mode.id
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {sendMode === "SEGMENT" && (
          <label className="block text-sm text-gray-700">
            Segment
            <select
              value={segmentType}
              onChange={(event) => setSegmentType(event.target.value as (typeof AUDIENCE_TYPES)[number])}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {AUDIENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {AUDIENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        )}

        {sendMode === "SAVED_LIST" && (
          <div className="space-y-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-gray-700">
              Reusable saved lists are built in Contacts Manager with side-by-side selection, tags, and segment notes.
              <Link href="/contacts-manager" className="ml-2 font-semibold text-green-700 hover:text-green-800">Open Contacts Manager</Link>
            </div>
            <label className="block text-sm text-gray-700">
              Saved List
              <select
                value={selectedSavedListId}
                onChange={(event) => setSelectedSavedListId(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={loadingLists || savedLists.length === 0}
              >
                {savedLists.length === 0 ? (
                  <option value="">No saved lists yet</option>
                ) : (
                  savedLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.recipientsCount})
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        )}

        {sendMode === "LIST" && (
          <div className="space-y-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              One-time lists are best for quick tests. Use Contacts Manager for reusable newsletter, church, donor, and business segments.
            </div>
            <label className="block text-sm text-gray-700">
              Recipient Emails
              <textarea
                rows={6}
                value={recipientListText}
                onChange={(event) => setRecipientListText(event.target.value)}
                placeholder="one@example.org, two@example.org"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">{recipientList.length} recipients parsed.</span>
            </label>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newSavedListName}
                onChange={(event) => setNewSavedListName(event.target.value)}
                placeholder="Save as reusable list name"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleCreateSavedList}
                disabled={savingList}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
              >
                {savingList ? "Saving..." : "Save List"}
              </button>
            </div>
          </div>
        )}

        {sendMode === "INDIVIDUAL" && (
          <label className="block text-sm text-gray-700">
            Recipient Email
            <input
              type="email"
              value={individualEmail}
              onChange={(event) => setIndividualEmail(event.target.value)}
              placeholder="person@example.org"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {(sendMode === "CAMPAIGN_AUDIENCE" || sendMode === "SEGMENT") && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            {loadingAudience ? (
              <p>Loading audience preview...</p>
            ) : audienceSummary ? (
              <div className="space-y-1">
                <p>Matched: {audienceSummary.totalMatched.toLocaleString()}</p>
                <p>Suppressed: {audienceSummary.suppressionCount.toLocaleString()}</p>
                <p className="font-semibold text-green-700">Final send count: {audienceSummary.finalSendCount.toLocaleString()}</p>
              </div>
            ) : (
              <p>Audience preview unavailable.</p>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Send Test Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="qa@example.org"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest || !testEmail.trim()}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
            >
              {sendingTest ? "Sending..." : "Send Test"}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-green-700">{message}</p>}

        <button
          onClick={handleSendNow}
          disabled={
            sending
            || !canSendCampaign
            || (sendMode === "SAVED_LIST" && !selectedSavedListId)
          }
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Campaign"}
        </button>

        {!canSendCampaign && (
          <p className="text-xs text-gray-500">Only Draft or Scheduled campaigns can be sent.</p>
        )}
      </div>
    </section>
  );
}
