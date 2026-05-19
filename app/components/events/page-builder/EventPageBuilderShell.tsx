"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import EventPageBuilderTopBar from "@/app/components/events/page-builder/EventPageBuilderTopBar";
import EventPageBuilderSectionRail from "@/app/components/events/page-builder/EventPageBuilderSectionRail";
import EventPageBuilderPreview from "@/app/components/events/page-builder/EventPageBuilderPreview";
import EventPageBuilderInspector from "@/app/components/events/page-builder/EventPageBuilderInspector";
import EventPageBuilderPreviewDialog from "@/app/components/events/page-builder/EventPageBuilderPreviewDialog";
import { createDefaultEventPageSectionState, EVENT_PAGE_SECTION_DEFINITIONS } from "@/app/components/events/page-builder/section-config";
import type {
  EventPageBuilderConfig,
  EventPageBuilderWorkspaceData,
  EventBuilderEventDetail,
  EventBuilderReport,
  EventBuilderSponsor,
  EventBuilderTicketType,
  EventPageDeploymentHistoryEntry,
  EventPagePaymentPolicy,
  EventPageSectionId,
  EventPageSectionState,
  EventPageStatus,
} from "@/app/components/events/page-builder/types";

interface EventPageBuilderShellProps {
  eventId: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fallbackEventPageSlug(eventName?: string | null): string {
  if (!eventName) return "event-page";
  return slugify(eventName) || "event-page";
}

function resolveRuntimeOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function buildEventPageUrl(origin: string, pageSlug: string): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const normalizedSlug = slugify(pageSlug) || "event-page";
  return `${normalizedOrigin}/${normalizedSlug}`;
}

function moveSectionOrder(
  sections: EventPageSectionState[],
  sectionId: EventPageSectionId,
  direction: "up" | "down",
): EventPageSectionState[] {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return sections;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= sections.length) return sections;

  const next = [...sections];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function reorderSectionsByDrop(
  sections: EventPageSectionState[],
  draggedSectionId: EventPageSectionId,
  targetSectionId: EventPageSectionId,
): EventPageSectionState[] {
  const draggedIndex = sections.findIndex((section) => section.id === draggedSectionId);
  const targetIndex = sections.findIndex((section) => section.id === targetSectionId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return sections;

  const next = [...sections];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

function mergeSectionsWithDefaults(savedSections: EventPageSectionState[] | null | undefined): EventPageSectionState[] {
  const defaults = createDefaultEventPageSectionState();
  if (!Array.isArray(savedSections) || savedSections.length === 0) return defaults;

  const defaultById = new Map(defaults.map((section) => [section.id, section]));
  const savedIds = new Set(savedSections.map((section) => section.id));
  return [
    ...savedSections.map((section) => ({
      ...(defaultById.get(section.id) ?? section),
      ...section,
      content: {
        ...(defaultById.get(section.id)?.content ?? {}),
        ...(section.content ?? {}),
      },
      design: {
        ...(defaultById.get(section.id)?.design ?? {}),
        ...(section.design ?? {}),
      },
      advanced: {
        ...(defaultById.get(section.id)?.advanced ?? {}),
        ...(section.advanced ?? {}),
      },
    })),
    ...defaults.filter((section) => !savedIds.has(section.id)),
  ];
}

/** Event-scoped page builder shell for creating and publishing public event pages from Events CRM data. */
export default function EventPageBuilderShell({ eventId }: EventPageBuilderShellProps) {
  const [event, setEvent] = useState<EventBuilderEventDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<EventBuilderTicketType[]>([]);
  const [sponsors, setSponsors] = useState<EventBuilderSponsor[]>([]);
  const [report, setReport] = useState<EventBuilderReport | null>(null);
  const [sections, setSections] = useState<EventPageSectionState[]>(createDefaultEventPageSectionState());
  const [selectedSectionId, setSelectedSectionId] = useState<EventPageSectionId>(EVENT_PAGE_SECTION_DEFINITIONS[0].id);
  const [pageStatus, setPageStatus] = useState<EventPageStatus>("Draft");
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [paymentPolicy, setPaymentPolicy] = useState<EventPagePaymentPolicy>("OfflineFollowUp");
  const [deploymentHistory, setDeploymentHistory] = useState<EventPageDeploymentHistoryEntry[]>([]);
  const [baseOrigin, setBaseOrigin] = useState<string>(resolveRuntimeOrigin());
  const [pageSlug, setPageSlug] = useState<string>("event-page");
  const [pageSlugDraft, setPageSlugDraft] = useState<string>("event-page");
  const [saveUrlPending, setSaveUrlPending] = useState(false);
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasLoadedSectionsRef = useRef(false);

  const resolvedDraftSlug = useMemo(() => {
    const normalized = slugify(pageSlugDraft);
    return normalized || pageSlug;
  }, [pageSlug, pageSlugDraft]);

  const draftPreviewUrl = useMemo(() => buildEventPageUrl(baseOrigin, resolvedDraftSlug), [baseOrigin, resolvedDraftSlug]);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceData() {
      setLoading(true);
      setError(null);
      const runtimeOrigin = resolveRuntimeOrigin();

      try {
        const [eventData, ticketData, sponsorData, reportData, pageConfig] = await Promise.all([
          apiFetch<EventBuilderEventDetail>(`/api/events/${eventId}`),
          apiFetch<EventBuilderTicketType[]>(`/api/events/${eventId}/ticket-types`),
          apiFetch<EventBuilderSponsor[]>(`/api/events/${eventId}/sponsors`),
          apiFetch<EventBuilderReport>(`/api/events/${eventId}/report`).catch(() => null),
          apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`).catch(() => null),
        ]);

        if (!active) return;

        setEvent(eventData);
        setTicketTypes(Array.isArray(ticketData) ? ticketData : []);
        setSponsors(Array.isArray(sponsorData) ? sponsorData : []);
        setReport(reportData);
        const nextSections = mergeSectionsWithDefaults(pageConfig?.sections);
        setSections(nextSections);
        setSelectedSectionId(nextSections.find((section) => section.enabled)?.id ?? nextSections[0].id);

        const resolvedOrigin = runtimeOrigin;
        const resolvedSlug = slugify(pageConfig?.pageSlug ?? "") || fallbackEventPageSlug(eventData.name);
        setBaseOrigin(resolvedOrigin);
        setPageSlug(resolvedSlug);
        setPageSlugDraft(resolvedSlug);
        setPageStatus(pageConfig?.status ?? "Draft");
        setLastPublishedAt(pageConfig?.lastPublishedAt ?? null);
        setPaymentPolicy(pageConfig?.paymentPolicy ?? "OfflineFollowUp");
        setDeploymentHistory(pageConfig?.deploymentHistory ?? []);
        hasLoadedSectionsRef.current = true;
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load event page builder workspace.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaceData();

    return () => {
      active = false;
    };
  }, [eventId]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? sections[0],
    [sections, selectedSectionId],
  );

  const publishReadiness = useMemo(() => {
    const visibleSections = sections.filter((section) => section.enabled);
    return [
      { label: "Valid public slug", passed: Boolean(slugify(pageSlugDraft)) },
      { label: "Hero section enabled", passed: visibleSections.some((section) => section.id === "hero") },
      {
        label: "Visitor action block",
        passed: visibleSections.some((section) => section.id === "registration-form" || section.id === "donation-form" || section.id === "cta-banner" || section.id === "live-appeal"),
      },
      { label: "Payment policy set", passed: paymentPolicy === "OfflineFollowUp" || paymentPolicy === "NoPaymentRequired" },
      { label: "Autosave complete", passed: autoSaveState !== "saving" },
    ];
  }, [autoSaveState, pageSlugDraft, paymentPolicy, sections]);

  const builderData = useMemo<EventPageBuilderWorkspaceData | null>(() => {
    if (!event) return null;
    return {
      event,
      ticketTypes,
      sponsors,
      report,
      publicUrl: draftPreviewUrl,
      paymentPolicy,
      pageSlug,
    };
  }, [draftPreviewUrl, event, pageSlug, paymentPolicy, report, sponsors, ticketTypes]);

  useEffect(() => {
    if (!hasLoadedSectionsRef.current || loading || !event) return;
    const timeout = window.setTimeout(() => {
      setAutoSaveState("saving");
      apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH",
        body: JSON.stringify({ sections }),
      })
        .then((updated) => {
          setPageStatus(updated.status);
          setLastPublishedAt(updated.lastPublishedAt);
          setPaymentPolicy(updated.paymentPolicy);
          setDeploymentHistory(updated.deploymentHistory);
          setAutoSaveState("saved");
        })
        .catch(() => {
          setAutoSaveState("error");
        });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [event, eventId, loading, sections]);

  function handlePreview() {
    setPreviewOpen(true);
  }

  async function handlePaymentPolicyChange(nextPaymentPolicy: EventPagePaymentPolicy) {
    setPaymentPolicy(nextPaymentPolicy);
    setAutoSaveState("saving");
    try {
      const updated = await apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH",
        body: JSON.stringify({ paymentPolicy: nextPaymentPolicy }),
      });
      setPaymentPolicy(updated.paymentPolicy);
      setDeploymentHistory(updated.deploymentHistory);
      setPageStatus(updated.status);
      setLastPublishedAt(updated.lastPublishedAt);
      setAutoSaveState("saved");
    } catch (policyError) {
      setAutoSaveState("error");
      setUrlFeedback(policyError instanceof Error ? policyError.message : "Failed to save payment policy.");
    }
  }

  async function handleSavePageSlug() {
    const nextSlug = slugify(pageSlugDraft);
    if (!nextSlug) {
      setUrlFeedback("Enter a slug with letters or numbers before saving.");
      return;
    }

    setSaveUrlPending(true);
    setUrlFeedback(null);
    try {
      const updated = await apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH",
        body: JSON.stringify({ pageSlug: nextSlug }),
      });
      const updatedOrigin = resolveRuntimeOrigin();
      setBaseOrigin(updatedOrigin);
      setPageSlug(updated.pageSlug);
      setPageSlugDraft(updated.pageSlug);
      setPageStatus(updated.status);
      setLastPublishedAt(updated.lastPublishedAt);
      setPaymentPolicy(updated.paymentPolicy);
      setDeploymentHistory(updated.deploymentHistory);
      setUrlFeedback("Event page slug saved.");
    } catch (saveError) {
      setUrlFeedback(saveError instanceof Error ? saveError.message : "Failed to save event page slug.");
    } finally {
      setSaveUrlPending(false);
    }
  }

  async function handlePublishToggle() {
    const nextStatus: EventPageStatus = pageStatus === "Published" ? "Draft" : "Published";
    const nextPublishedAt = nextStatus === "Published" ? new Date().toISOString() : null;

    if (nextStatus === "Published") {
      const visibleSections = sections.filter((section) => section.enabled);
      if (!slugify(pageSlugDraft)) {
        setUrlFeedback("Add a valid page slug before publishing.");
        return;
      }
      if (!visibleSections.some((section) => section.id === "hero")) {
        setUrlFeedback("Publish blocked: enable the Hero section so the page has a clear public introduction.");
        return;
      }
      if (!visibleSections.some((section) => section.id === "registration-form" || section.id === "donation-form" || section.id === "cta-banner" || section.id === "live-appeal")) {
        setUrlFeedback("Publish blocked: add a registration, donation, or CTA section so visitors have a clear next step.");
        return;
      }
      if (paymentPolicy !== "OfflineFollowUp" && paymentPolicy !== "NoPaymentRequired") {
        setUrlFeedback("Publish blocked: choose a registration payment policy.");
        return;
      }
      if (autoSaveState === "saving") {
        setUrlFeedback("Publish blocked: wait for autosave to finish, then publish again.");
        return;
      }
    }

    setPageStatus(nextStatus);
    setLastPublishedAt(nextPublishedAt);
    setAutoSaveState("saving");
    try {
      const updated = await apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          lastPublishedAt: nextPublishedAt,
          paymentPolicy,
          sections,
        }),
      });
      setPageStatus(updated.status);
      setLastPublishedAt(updated.lastPublishedAt);
      setPaymentPolicy(updated.paymentPolicy);
      setDeploymentHistory(updated.deploymentHistory);
      setAutoSaveState("saved");
    } catch {
      setAutoSaveState("error");
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-[#f7f8fc] p-5">
        <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-4 grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[250px_minmax(0,1fr)_320px]">
          <div className="h-[640px] animate-pulse bg-slate-100" />
          <div className="h-[640px] animate-pulse bg-slate-50" />
          <div className="h-[640px] animate-pulse bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Event not found."}
      </div>
    );
  }

  if (!builderData) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f8fc]">
      <EventPageBuilderTopBar
        eventName={event.name}
        resolvedPageUrl={draftPreviewUrl}
        pageSlug={pageSlug}
        pageSlugDraft={pageSlugDraft}
        saveUrlPending={saveUrlPending}
        urlFeedback={urlFeedback}
        status={pageStatus}
        lastPublishedAt={lastPublishedAt}
        paymentPolicy={paymentPolicy}
        deploymentHistory={deploymentHistory}
        autoSaveState={autoSaveState}
        publishReadiness={publishReadiness}
        onPaymentPolicyChange={handlePaymentPolicyChange}
        onPageSlugDraftChange={setPageSlugDraft}
        onSavePageSlug={handleSavePageSlug}
        onPreview={handlePreview}
        onPublishToggle={handlePublishToggle}
      />

      <div className="grid min-h-0 flex-1 overflow-hidden border-t border-slate-200 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <EventPageBuilderSectionRail
          sections={sections}
          selectedSectionId={selectedSection.id}
          onSelectSection={setSelectedSectionId}
          onMoveSection={(sectionId, direction) => {
            setSections((current) => moveSectionOrder(current, sectionId, direction));
          }}
          onReorderSections={(draggedSectionId, targetSectionId) => {
            setSections((current) => reorderSectionsByDrop(current, draggedSectionId, targetSectionId));
          }}
          onToggleSection={(sectionId) => {
            setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, enabled: !section.enabled } : section)));
            setSelectedSectionId(sectionId);
          }}
        />

        <EventPageBuilderPreview
          sections={sections}
          selectedSectionId={selectedSection.id}
          data={builderData}
          onSelectSection={setSelectedSectionId}
        />

        <EventPageBuilderInspector
          section={selectedSection}
          onUpdateSection={(sectionId, updater) => {
            setSections((current) => current.map((section) => (section.id === sectionId ? updater(section) : section)));
          }}
          onDeleteSection={(sectionId) => {
            setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, enabled: false } : section)));
            const nextVisible = sections.find((section) => section.id !== sectionId && section.enabled);
            if (nextVisible) setSelectedSectionId(nextVisible.id);
          }}
        />
      </div>

      <EventPageBuilderPreviewDialog
        open={previewOpen}
        sections={sections}
        data={builderData}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
