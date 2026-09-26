"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { fetchBrandingSettings, formatBrandingAddress } from "@/app/lib/branding-settings";
import EventPageBuilderTopBar from "@/app/components/events/page-builder/EventPageBuilderTopBar";
import EventPageBuilderSectionRail from "@/app/components/events/page-builder/EventPageBuilderSectionRail";
import EventPageBuilderPreview, { EventPageDocument } from "@/app/components/events/page-builder/EventPageBuilderPreview";
import EventPageBuilderInspector from "@/app/components/events/page-builder/EventPageBuilderInspector";
import EventPageBuilderPreviewDialog from "@/app/components/events/page-builder/EventPageBuilderPreviewDialog";
import { createDefaultEventPageSectionState, mergeEventPageSections, EVENT_PAGE_SECTION_DEFINITIONS } from "@/app/components/events/page-builder/section-config";
import type {
  EventPageBuilderConfig,
  EventPageBuilderWorkspaceData,
  EventPageBranding,
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

import { useUnsavedEventChanges } from "@/app/components/events/creator/useUnsavedEventChanges";
import { EventDraftSaveQueue, type DraftSaveState } from "@/app/lib/event-draft-save-queue";

export interface EventPageBuilderHandle { flush: () => Promise<void>; publish: () => Promise<void> }
interface EventPageBuilderShellProps {
  eventId: string;
  creatorStage?: "design" | "review";
  ref?: Ref<EventPageBuilderHandle>;
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
  const visiblePositions = sections.flatMap((section, index) => section.enabled ? [index] : []);
  const visibleIndex = visiblePositions.findIndex((index) => sections[index]?.id === sectionId);
  const nextVisibleIndex = direction === "up" ? visibleIndex - 1 : visibleIndex + 1;
  if (visibleIndex < 0 || nextVisibleIndex < 0 || nextVisibleIndex >= visiblePositions.length) return sections;
  const index = visiblePositions[visibleIndex];
  const nextIndex = visiblePositions[nextVisibleIndex];
  const next = [...sections];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
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

/** Event-scoped page builder shell for creating and publishing public event pages from Events CRM data. */
export default function EventPageBuilderShell({ eventId, creatorStage, ref }: EventPageBuilderShellProps) {
  const [event, setEvent] = useState<EventBuilderEventDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<EventBuilderTicketType[]>([]);
  const [sponsors, setSponsors] = useState<EventBuilderSponsor[]>([]);
  const [report, setReport] = useState<EventBuilderReport | null>(null);
  const [sections, setSections] = useState<EventPageSectionState[]>(createDefaultEventPageSectionState());
  const [selectedSectionId, setSelectedSectionId] = useState<EventPageSectionId>(EVENT_PAGE_SECTION_DEFINITIONS[0].id);
  const [pageStatus, setPageStatus] = useState<EventPageStatus>("Draft");
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [paymentPolicy, setPaymentPolicy] = useState<EventPagePaymentPolicy>("OfflineFollowUp");
  const [currency, setCurrency] = useState("USD");
  const [deploymentHistory, setDeploymentHistory] = useState<EventPageDeploymentHistoryEntry[]>([]);
  const [baseOrigin, setBaseOrigin] = useState<string>(resolveRuntimeOrigin());
  const [pageSlug, setPageSlug] = useState<string>("event-page");
  const [pageSlugDraft, setPageSlugDraft] = useState<string>("event-page");
  const [saveUrlPending, setSaveUrlPending] = useState(false);
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<DraftSaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"event" | "registration">("event");
  const [branding, setBranding] = useState<EventPageBranding | null>(null);
  const [compactPanel, setCompactPanel] = useState<"sections" | "preview" | "settings">("preview");
  const hasLoadedSectionsRef = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const policyRef = useRef(paymentPolicy);
  const pendingPolicyRef = useRef<EventPagePaymentPolicy | null>(null);
  useEffect(() => { policyRef.current = paymentPolicy; }, [paymentPolicy]);
  const saveQueue = useMemo(() => new EventDraftSaveQueue<{ sections: EventPageSectionState[]; slug: string }>(
    async (value) => {
      const draftSlug = slugify(value.slug);
      if (!draftSlug) throw new Error("Enter a public address with letters or numbers.");
      const updated = await apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, { method: "PATCH", body: JSON.stringify({ sections: value.sections, pageSlug: draftSlug }) });
      setPageSlug(updated.pageSlug);
      setPageSlugDraft((current) => slugify(current) === draftSlug ? updated.pageSlug : current);
    },
    setAutoSaveState,
  ), [eventId]);
  useEffect(() => () => saveQueue.dispose(), [saveQueue]);
  useUnsavedEventChanges(autoSaveState === "pending" || autoSaveState === "saving" || autoSaveState === "error" || pageSlugDraft !== pageSlug, "Leave without saving the page changes?");

  const resolvedDraftSlug = useMemo(() => {
    const normalized = slugify(pageSlugDraft);
    return normalized || pageSlug;
  }, [pageSlug, pageSlugDraft]);

  const draftPreviewUrl = useMemo(() => buildEventPageUrl(baseOrigin, resolvedDraftSlug), [baseOrigin, resolvedDraftSlug]);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceData() {
      hasLoadedSectionsRef.current = false;
      setLoading(true);
      setError(null);
      const runtimeOrigin = resolveRuntimeOrigin();

      try {
        const [eventData, ticketData, sponsorData, reportData, pageConfig, brandingData] = await Promise.all([
          apiFetch<EventBuilderEventDetail>(`/api/events/${eventId}`),
          apiFetch<EventBuilderTicketType[]>(`/api/events/${eventId}/ticket-types`),
          apiFetch<EventBuilderSponsor[]>(`/api/events/${eventId}/sponsors`),
          apiFetch<EventBuilderReport>(`/api/events/${eventId}/report`).catch(() => null),
          apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`),
          fetchBrandingSettings(),
        ]);

        if (!active) return;

        setEvent(eventData);
        setTicketTypes(Array.isArray(ticketData) ? ticketData : []);
        setSponsors(Array.isArray(sponsorData) ? sponsorData : []);
        setReport(reportData);
        setBranding({
          organizationName: brandingData.organizationDisplayName || brandingData.legalOrganizationName,
          legalOrganizationName: brandingData.legalOrganizationName,
          tagline: brandingData.tagline,
          missionStatement: brandingData.missionStatement,
          logoUrl: brandingData.logoUrl,
          logoSquareUrl: brandingData.logoSquareUrl,
          primaryColor: brandingData.primaryColor,
          accentColor: brandingData.accentColor,
          contactEmail: brandingData.contactEmail,
          contactPhone: brandingData.contactPhone,
          websiteUrl: brandingData.websiteUrl,
          addressLine: formatBrandingAddress(brandingData),
          footerLegalText: brandingData.footerLegalText,
          socialFacebook: brandingData.socialFacebook,
          socialInstagram: brandingData.socialInstagram,
          socialLinkedIn: brandingData.socialLinkedIn,
          socialYoutube: brandingData.socialYoutube,
          socialX: brandingData.socialX,
        });
        const nextSections = mergeEventPageSections(pageConfig?.sections);
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
        setCurrency(pageConfig?.currency ?? "USD");
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
      { label: "Payment policy set", passed: paymentPolicy === "StripeCheckout" || paymentPolicy === "PayAtEvent" || paymentPolicy === "OfflineFollowUp" || paymentPolicy === "NoPaymentRequired" },
      { label: "Autosave complete", passed: autoSaveState === "saved" },
    ];
  }, [autoSaveState, pageSlugDraft, paymentPolicy, sections]);

  const builderData = useMemo<EventPageBuilderWorkspaceData | null>(() => {
    if (!event) return null;
    return {
      event: creatorStage && event.status === "DRAFT" ? { ...event, status: "PUBLISHED" } : event,
      ticketTypes,
      sponsors,
      report,
      publicUrl: draftPreviewUrl,
      paymentPolicy,
      currency,
      pageSlug,
      branding: branding ?? undefined,
    };
  }, [branding, creatorStage, currency, draftPreviewUrl, event, pageSlug, paymentPolicy, report, sponsors, ticketTypes]);

  useEffect(() => {
    if (!hasLoadedSectionsRef.current || loading || !event) return;
    saveQueue.schedule({ sections, slug: pageSlugDraft });
  }, [event, loading, sections, pageSlugDraft, saveQueue]);

  function handlePreview() {
    setPreviewMode("event");
    setPreviewOpen(true);
  }

  function handlePreviewRegistration() {
    setPreviewMode("registration");
    setPreviewOpen(true);
  }

  async function handlePaymentPolicyChange(nextPaymentPolicy: EventPagePaymentPolicy) {
    setPaymentPolicy(nextPaymentPolicy);
    policyRef.current = nextPaymentPolicy;
    pendingPolicyRef.current = nextPaymentPolicy;
    try {
      const updated = await saveQueue.run(() => apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH", body: JSON.stringify({ paymentPolicy: nextPaymentPolicy }),
      }));
      if (policyRef.current === nextPaymentPolicy) setPaymentPolicy(updated.paymentPolicy);
      if (pendingPolicyRef.current === nextPaymentPolicy) pendingPolicyRef.current = null;
    } catch (reason) {
      setUrlFeedback(reason instanceof Error ? reason.message : "Failed to save payment policy.");
      throw reason;
    }
  }

  async function handleSavePageSlug() {
    const nextSlug = slugify(pageSlugDraft);
    if (!nextSlug) throw new Error("Enter a public address with letters or numbers.");
    setSaveUrlPending(true); setUrlFeedback(null);
    try {
      const updated = await saveQueue.run(() => apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH", body: JSON.stringify({ pageSlug: nextSlug, paymentPolicy: policyRef.current }),
      }));
      setPageSlug(updated.pageSlug);
      setPageSlugDraft((current) => current === nextSlug || slugify(current) === nextSlug ? updated.pageSlug : current);
      setUrlFeedback("Event page address saved.");
    } catch (reason) {
      setUrlFeedback(reason instanceof Error ? reason.message : "Failed to save public address.");
      throw reason;
    } finally { setSaveUrlPending(false); }
  }

  async function flushDraft() {
    if (loading || !event) throw new Error("Wait for the page editor to load.");
    await saveQueue.flush();
    if (pendingPolicyRef.current) await handlePaymentPolicyChange(pendingPolicyRef.current);
    if (pageSlugDraft !== pageSlug) await handleSavePageSlug();
  }

  async function handlePublishToggle(forcePublish = false) {
    if (publishing || loading) throw new Error("Wait for the current operation to finish.");
    const nextStatus: EventPageStatus = forcePublish || pageStatus !== "Published" ? "Published" : "Draft";
    setPublishing(true); setUrlFeedback(null);
    try {
      await flushDraft();
      const updated = await saveQueue.run(() => apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH", body: JSON.stringify({ status: nextStatus, paymentPolicy: policyRef.current, sections, pageSlug: slugify(pageSlugDraft) }),
      }));
      setPageStatus(updated.status); setLastPublishedAt(updated.lastPublishedAt); setDeploymentHistory(updated.deploymentHistory);
    } catch (reason) {
      setUrlFeedback(reason instanceof Error ? reason.message : "Publishing failed. Your page remains a draft.");
      throw reason;
    } finally { setPublishing(false); }
  }

  useImperativeHandle(ref, () => ({ flush: flushDraft, publish: () => handlePublishToggle(true) }));

  if (loading) {
    return (
      <div className="h-full bg-slate-900">
        <div className="h-[108px] animate-pulse bg-slate-950" />
        <div className="grid min-h-[620px] border-t border-slate-700 bg-white lg:grid-cols-[280px_minmax(0,1fr)_340px]">
          <div className="animate-pulse border-r border-slate-300 bg-slate-100" />
          <div className="animate-pulse bg-slate-200" />
          <div className="animate-pulse border-l border-slate-300 bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center bg-slate-100 p-5">
        <div className="w-full max-w-lg border-l-4 border-red-600 bg-white p-5 shadow-sm"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Builder unavailable</p><p className="mt-2 text-sm text-slate-700">{error ?? "Event not found."}</p></div>
      </div>
    );
  }

  if (!builderData) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-200">
      {creatorStage ? <header className="shrink-0 border-b border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Public address<input className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={pageSlugDraft} onChange={(input) => setPageSlugDraft(input.target.value)} /></label>
          <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={handlePreview}>Page preview</button>
          <button type="button" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold" onClick={handlePreviewRegistration}>Registration preview</button>
        </div>
        <p role="status" className={`mt-2 text-xs ${autoSaveState === "error" ? "text-red-700" : "text-slate-500"}`}>{autoSaveState === "pending" ? "Changes waiting to save…" : autoSaveState === "saving" ? "Saving…" : autoSaveState === "error" ? "Save failed. Your edits are retained." : autoSaveState === "saved" ? "Page changes saved" : "Loading save status…"} · {draftPreviewUrl}</p>
        {urlFeedback ? <p role="alert" className="mt-2 text-sm text-slate-700">{urlFeedback}</p> : null}
      </header> : <EventPageBuilderTopBar
        eventId={eventId}
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
        branding={branding ?? undefined}
        onPaymentPolicyChange={(policy) => void handlePaymentPolicyChange(policy).catch(() => {})}
        onPageSlugDraftChange={setPageSlugDraft}
        onSavePageSlug={() => void handleSavePageSlug().catch(() => {})}
        onPreview={handlePreview}
        onPreviewRegistration={handlePreviewRegistration}
        onPublishToggle={() => void handlePublishToggle().catch(() => {})}
      />}
      {autoSaveState === "error" ? <div role="alert" className="shrink-0 bg-red-50 px-4 py-3 text-sm text-red-800">Changes could not be saved. <button type="button" className="font-semibold underline" onClick={() => void flushDraft().catch(() => {})}>Retry save</button></div> : null}

      <div inert={publishing} className="flex min-h-0 flex-1 flex-col">
      {creatorStage === "review" ? <div className="max-h-[700px] overflow-auto bg-slate-100 p-3 sm:p-6"><EventPageDocument sections={sections} data={builderData} /></div> : <>
      <div className="flex shrink-0 border-b border-slate-400 bg-slate-800 p-1 lg:hidden" role="tablist" aria-label="Page builder panels">{(["sections", "preview", "settings"] as const).map((panel) => <button key={panel} type="button" role="tab" aria-selected={compactPanel === panel} onClick={() => setCompactPanel(panel)} className={`min-h-10 flex-1 border-b-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${compactPanel === panel ? "border-sky-400 bg-slate-700 text-white" : "border-transparent text-slate-400"}`}>{panel === "sections" ? "Sections" : panel === "settings" ? "Edit section" : "Preview"}</button>)}</div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <div className={`${compactPanel === "sections" ? "block" : "hidden"} min-h-0 lg:block`}><EventPageBuilderSectionRail
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
            const target = sections.find((section) => section.id === sectionId);
            setSections((current) => {
              const targetIndex = current.findIndex((section) => section.id === sectionId);
              if (targetIndex < 0) return current;
              if (current[targetIndex].enabled) {
                return current.map((section) => (section.id === sectionId ? { ...section, enabled: false } : section));
              }
              const next = [...current];
              const [enabledSection] = next.splice(targetIndex, 1);
              let insertionIndex = 0;
              next.forEach((section, index) => { if (section.enabled) insertionIndex = index + 1; });
              next.splice(insertionIndex, 0, { ...enabledSection, enabled: true });
              return next;
            });
            if (target?.enabled && selectedSectionId === sectionId) {
              const nextVisible = sections.find((section) => section.id !== sectionId && section.enabled);
              if (nextVisible) setSelectedSectionId(nextVisible.id);
            } else if (!target?.enabled) {
              setSelectedSectionId(sectionId);
            }
          }}
        /></div>

        <div className={`${compactPanel === "preview" ? "block" : "hidden"} min-h-0 lg:block`}><EventPageBuilderPreview
          sections={sections}
          selectedSectionId={selectedSection.id}
          data={builderData}
          onSelectSection={setSelectedSectionId}
        /></div>

        <div className={`${compactPanel === "settings" ? "block" : "hidden"} min-h-0 lg:block`}><EventPageBuilderInspector
          section={selectedSection}
          branding={branding ?? undefined}
          onUpdateSection={(sectionId, updater) => {
            setSections((current) => current.map((section) => (section.id === sectionId ? updater(section) : section)));
          }}
        /></div>
      </div>

      </>}
      </div>
      <EventPageBuilderPreviewDialog
        open={previewOpen}
        sections={sections}
        data={builderData}
        mode={previewMode}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
