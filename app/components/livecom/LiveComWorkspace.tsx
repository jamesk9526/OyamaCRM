// LiveCom workspace shell for donor-facing live messaging and interaction operations.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

import LiveComFormsPanel from "@/app/components/livecom/LiveComFormsPanel";
import LiveComInboxPanel from "@/app/components/livecom/LiveComInboxPanel";
import LiveComInteractionCaptureCard from "@/app/components/livecom/LiveComInteractionCaptureCard";
import LiveComInteractionTimeline from "@/app/components/livecom/LiveComInteractionTimeline";
import {
  LIVECOM_CONTACT_FORMS,
  LIVECOM_SURVEYS,
} from "@/app/components/livecom/livecom-seed";
import LiveComSummaryCards from "@/app/components/livecom/LiveComSummaryCards";
import LiveComSurveysPanel from "@/app/components/livecom/LiveComSurveysPanel";
import type {
  LiveComConstituentOption,
  LiveComConversation,
  LiveComCreateInteractionInput,
  LiveComInboxFilter,
  LiveComInteractionEvent,
  LiveComTrackedInteraction,
  LiveComUpdateInteractionInput,
} from "@/app/components/livecom/livecom-types";

/**
 * LiveComWorkspace is the initial donor interaction command center for website chat, surveys, and form intake.
 */
export default function LiveComWorkspace() {
  const [inboxFilter, setInboxFilter] = useState<LiveComInboxFilter>("ALL");
  const [conversations, setConversations] = useState<LiveComConversation[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<LiveComInteractionEvent[]>([]);
  const [constituents, setConstituents] = useState<LiveComConstituentOption[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [updatingInteractionId, setUpdatingInteractionId] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  const loadConstituents = useCallback(async () => {
    try {
      const rows = await apiFetch<LiveComConstituentOption[]>("/api/constituents?limit=150");
      setConstituents(Array.isArray(rows) ? rows : []);
    } catch {
      setConstituents([]);
    }
  }, []);

  const loadInteractions = useCallback(async () => {
    setLoadingInteractions(true);
    try {
      const rows = await apiFetch<LiveComTrackedInteraction[]>("/api/livecom/interactions?limit=200");
      const tracked = Array.isArray(rows) ? rows : [];
      setConversations(tracked.map(mapInteractionToConversation));
      setTimelineEvents(tracked.slice(0, 120).map(mapInteractionToTimelineEvent));
      setInteractionError(null);
    } catch (error) {
      setConversations([]);
      setTimelineEvents([]);
      setInteractionError(error instanceof Error ? error.message : "Failed to load tracked interactions.");
    } finally {
      setLoadingInteractions(false);
    }
  }, []);

  useEffect(() => {
    void loadConstituents();
    void loadInteractions();
  }, [loadConstituents, loadInteractions]);

  async function handleTrackInteraction(payload: LiveComCreateInteractionInput) {
    setSavingInteraction(true);
    try {
      const created = await apiFetch<LiveComTrackedInteraction>("/api/livecom/interactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const nextConversation = mapInteractionToConversation(created);
      const nextTimelineEvent = mapInteractionToTimelineEvent(created);

      setConversations((current) => [nextConversation, ...current]);
      setTimelineEvents((current) => [nextTimelineEvent, ...current].slice(0, 120));
      setInteractionError(null);
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "Failed to save interaction.");
      throw error;
    } finally {
      setSavingInteraction(false);
    }
  }

  async function handleUpdateInteraction(interactionId: string, updates: LiveComUpdateInteractionInput) {
    setUpdatingInteractionId(interactionId);
    try {
      const updated = await apiFetch<LiveComTrackedInteraction>(`/api/livecom/interactions/${interactionId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      const updatedConversation = mapInteractionToConversation(updated);
      const updatedTimelineEvent = mapInteractionToTimelineEvent(updated);

      setConversations((current) =>
        current.map((conversation) => (conversation.id === interactionId ? updatedConversation : conversation)),
      );
      setTimelineEvents((current) =>
        current.map((event) => (event.id === interactionId ? updatedTimelineEvent : event)),
      );
      setInteractionError(null);
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : "Failed to update interaction.");
      throw error;
    } finally {
      setUpdatingInteractionId(null);
    }
  }

  const filteredConversations = useMemo(() => {
    if (inboxFilter === "ALL") return conversations;
    if (inboxFilter === "NEW") return conversations.filter((conversation) => conversation.status === "NEW");
    if (inboxFilter === "WAITING") {
      return conversations.filter((conversation) => conversation.status === "WAITING_ON_DONOR");
    }
    return conversations.filter(
      (conversation) => conversation.status === "IN_PROGRESS" || conversation.status === "WAITING_ON_DONOR",
    );
  }, [conversations, inboxFilter]);

  const openConversations = conversations.filter(isConversationOpen).length;
  const newConversations = conversations.filter((conversation) => conversation.status === "NEW").length;
  const waitingOnDonor = conversations.filter((conversation) => conversation.status === "WAITING_ON_DONOR").length;
  const liveSurveys = LIVECOM_SURVEYS.filter((survey) => survey.status === "LIVE").length;
  const pendingFormSubmissions = conversations.filter(
    (conversation) => conversation.channel === "CONTACT_FORM" && conversation.status !== "RESOLVED",
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">LiveCom</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Live donor messaging from website chat, surveys, contact forms, and direct interaction workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Install Website Widget
          </button>
          <Link
            href="/communications"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open Communications
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">MVP In Development</p>
        <p className="mt-1 text-sm text-amber-900">
          LiveCom now persists tracked interactions and attaches them to constituent timelines for cross-workspace visibility.
        </p>
        <p className="mt-1 text-xs text-amber-800">
          TODO: backend API needed for real-time website chat ingestion, survey response webhooks, contact form sync, and conversation threading.
        </p>
      </section>

      {interactionError && (
        <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {interactionError}
        </section>
      )}

      <LiveComInteractionCaptureCard
        constituents={constituents}
        saving={savingInteraction}
        onSubmit={handleTrackInteraction}
      />

      <LiveComSummaryCards
        openConversations={openConversations}
        newConversations={newConversations}
        waitingOnDonor={waitingOnDonor}
        liveSurveys={liveSurveys}
        pendingFormSubmissions={pendingFormSubmissions}
      />

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <LiveComInboxPanel
          conversations={filteredConversations}
          activeFilter={inboxFilter}
          onFilterChange={setInboxFilter}
          updatingConversationId={updatingInteractionId}
          onUpdateConversation={handleUpdateInteraction}
        />
        <div className="space-y-5">
          <LiveComSurveysPanel surveys={LIVECOM_SURVEYS} />
          <LiveComFormsPanel forms={LIVECOM_CONTACT_FORMS} />
        </div>
      </section>

      <LiveComInteractionTimeline events={timelineEvents} />

      {loadingInteractions && (
        <p className="text-xs text-gray-500">Loading tracked interactions...</p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Website Embed Starter</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
{`<script src="https://your-domain.com/embed/livecom.js" data-org="oyama-demo" defer></script>`}
        </pre>
      </section>
    </div>
  );
}

function mapInteractionToConversation(interaction: LiveComTrackedInteraction): LiveComConversation {
  return {
    id: interaction.id,
    donorName: interaction.donorName,
    constituentId: interaction.constituentId ?? undefined,
    channel: interaction.channel,
    status: interaction.status,
    priority: interaction.priority,
    messagePreview: interaction.messagePreview,
    receivedAt: interaction.occurredAt,
    owner: interaction.owner,
  };
}

function mapInteractionToTimelineEvent(interaction: LiveComTrackedInteraction): LiveComInteractionEvent {
  return {
    id: interaction.id,
    occurredAt: interaction.occurredAt,
    channel: interaction.channel,
    donorName: interaction.donorName,
    eventLabel: interaction.eventLabel,
    detail: interaction.detail,
  };
}

function isConversationOpen(conversation: LiveComConversation): boolean {
  return conversation.status !== "RESOLVED";
}
