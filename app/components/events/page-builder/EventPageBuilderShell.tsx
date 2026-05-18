"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";
import EventPageBuilderTopBar from "@/app/components/events/page-builder/EventPageBuilderTopBar";
import EventPageBuilderSectionRail from "@/app/components/events/page-builder/EventPageBuilderSectionRail";
import EventPageBuilderPreview from "@/app/components/events/page-builder/EventPageBuilderPreview";
import EventPageBuilderInspector from "@/app/components/events/page-builder/EventPageBuilderInspector";
import { createDefaultEventPageSectionState, EVENT_PAGE_SECTION_DEFINITIONS } from "@/app/components/events/page-builder/section-config";
import type {
  EventPageBuilderConfig,
  EventBuilderEventDetail,
  EventBuilderReport,
  EventBuilderSponsor,
  EventBuilderTicketType,
  EventPageSectionId,
  EventPageSectionState,
  EventPageStatus,
} from "@/app/components/events/page-builder/types";
import type { EventItem } from "@/app/components/events/types";

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

function formatEventDate(value?: string | null): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fallbackEventPageUrl(eventName?: string | null): string {
  if (!eventName) return "https://oyamachurch.org/events";
  return `https://oyamachurch.org/events/${slugify(eventName)}`;
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

/** Event-scoped page builder shell for creating and publishing public event pages from Events CRM data. */
export default function EventPageBuilderShell({ eventId }: EventPageBuilderShellProps) {
  const [event, setEvent] = useState<EventBuilderEventDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<EventBuilderTicketType[]>([]);
  const [sponsors, setSponsors] = useState<EventBuilderSponsor[]>([]);
  const [report, setReport] = useState<EventBuilderReport | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sections, setSections] = useState<EventPageSectionState[]>(createDefaultEventPageSectionState());
  const [selectedSectionId, setSelectedSectionId] = useState<EventPageSectionId>(EVENT_PAGE_SECTION_DEFINITIONS[0].id);
  const [pageStatus, setPageStatus] = useState<EventPageStatus>("Draft");
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>("https://oyamachurch.org/events");
  const [pageUrlDraft, setPageUrlDraft] = useState<string>("https://oyamachurch.org/events");
  const [saveUrlPending, setSaveUrlPending] = useState(false);
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceData() {
      setLoading(true);
      setError(null);

      try {
        const [eventData, ticketData, sponsorData, reportData, eventsData, pageConfig] = await Promise.all([
          apiFetch<EventBuilderEventDetail>(`/api/events/${eventId}`),
          apiFetch<EventBuilderTicketType[]>(`/api/events/${eventId}/ticket-types`),
          apiFetch<EventBuilderSponsor[]>(`/api/events/${eventId}/sponsors`),
          apiFetch<EventBuilderReport>(`/api/events/${eventId}/report`).catch(() => null),
          apiFetch<EventItem[]>("/api/events"),
          apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`).catch(() => null),
        ]);

        if (!active) return;

        setEvent(eventData);
        setTicketTypes(Array.isArray(ticketData) ? ticketData : []);
        setSponsors(Array.isArray(sponsorData) ? sponsorData : []);
        setReport(reportData);
        setEvents(Array.isArray(eventsData) ? eventsData : []);

        const resolvedUrl = pageConfig?.pageUrl?.trim() || fallbackEventPageUrl(eventData.name);
        setPublicUrl(resolvedUrl);
        setPageUrlDraft(resolvedUrl);
        setPageStatus(pageConfig?.status ?? "Draft");
        setLastPublishedAt(pageConfig?.lastPublishedAt ?? null);
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

  const selectedEvent = useMemo(
    () => events.find((entry) => entry.id === eventId) ?? null,
    [events, eventId],
  );

  function handlePreview() {
    if (typeof window === "undefined") return;
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSavePageUrl() {
    const nextUrl = pageUrlDraft.trim();
    if (!nextUrl) {
      setUrlFeedback("Enter a full URL before saving.");
      return;
    }

    setSaveUrlPending(true);
    setUrlFeedback(null);
    try {
      const updated = await apiFetch<EventPageBuilderConfig>(`/api/events/${eventId}/page-builder-config`, {
        method: "PATCH",
        body: JSON.stringify({ pageUrl: nextUrl }),
      });
      setPublicUrl(updated.pageUrl);
      setPageUrlDraft(updated.pageUrl);
      setPageStatus(updated.status);
      setLastPublishedAt(updated.lastPublishedAt);
      setUrlFeedback("Event page URL saved.");
    } catch (saveError) {
      setUrlFeedback(saveError instanceof Error ? saveError.message : "Failed to save event page URL.");
    } finally {
      setSaveUrlPending(false);
    }
  }

  function handlePublishToggle() {
    if (pageStatus === "Published") {
      setPageStatus("Draft");
      return;
    }

    setPageStatus("Published");
    setLastPublishedAt(new Date().toISOString());
  }

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
          <div className="h-[520px] animate-pulse rounded-xl bg-slate-100" />
          <div className="h-[520px] animate-pulse rounded-xl bg-slate-100" />
          <div className="h-[520px] animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Event not found."}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 sm:p-4 lg:p-5">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Event Page Builder persistence is still in development"
        description="Event-scoped editing and source-of-truth data loading are active, but section-level save history and full publish pipeline persistence are not complete yet."
      />

      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: event.name, href: `/events/${eventId}/overview` },
          { label: "Event Page Builder" },
        ]}
        statusLabel="Partially Working"
        metadata="Event-scoped public page builder connected to Events CRM source data"
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Event Workspace">
          <WorkspaceRibbonButton label="Overview" href={`/events/${eventId}/overview`} accentTone="purple" />
          <WorkspaceRibbonButton label="Guests" href={`/events/${eventId}/guests`} accentTone="purple" />
          <WorkspaceRibbonButton label="Donations" href={`/events/${eventId}/donations`} accentTone="purple" />
          <WorkspaceRibbonButton label="Reports" href={`/events/${eventId}/reports`} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Preview Page" onClick={handlePreview} accentTone="purple" />
          <WorkspaceRibbonButton label={pageStatus === "Published" ? "Unpublish" : "Publish"} onClick={handlePublishToggle} variant="primary" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <EventPageBuilderTopBar
        eventName={event.name}
        publicUrl={publicUrl}
        pageUrlDraft={pageUrlDraft}
        saveUrlPending={saveUrlPending}
        urlFeedback={urlFeedback}
        status={pageStatus}
        lastPublishedAt={lastPublishedAt}
        onPageUrlDraftChange={setPageUrlDraft}
        onSavePageUrl={handleSavePageUrl}
        onPreview={handlePreview}
        onPublishToggle={handlePublishToggle}
      />

      <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
        <EventPageBuilderSectionRail
          sections={sections}
          selectedSectionId={selectedSection.id}
          onSelectSection={setSelectedSectionId}
          onMoveSection={(sectionId, direction) => {
            setSections((current) => moveSectionOrder(current, sectionId, direction));
          }}
        />

        <EventPageBuilderPreview
          sections={sections}
          selectedSectionId={selectedSection.id}
          data={{
            event,
            ticketTypes,
            sponsors,
            report,
            publicUrl,
          }}
        />

        <EventPageBuilderInspector
          section={selectedSection}
          onUpdateSection={(sectionId, updater) => {
            setSections((current) => current.map((section) => (section.id === sectionId ? updater(section) : section)));
          }}
        />
      </div>

      <section className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
        <p className="font-semibold">Source Of Truth Behavior</p>
        <p className="mt-1">
          This builder reads event name, timing, location, registration settings, ticket/table options, sponsor records, and fundraising metrics from Events CRM APIs.
          Changes in event setup propagate here automatically when data is refreshed.
        </p>
        {selectedEvent ? (
          <p className="mt-1 text-violet-800">
            Current scoped event: {selectedEvent.name} ({formatEventDate(selectedEvent.startDate)})
          </p>
        ) : null}
        <p className="mt-2">
          Need full persistence for section-level design overrides and publish history.
          <Link href={`/events/${eventId}/settings?tab=integrations`} className="ml-1 font-semibold underline">
            Integration settings
          </Link>
          remain available for event manager connectivity.
        </p>
      </section>
    </div>
  );
}
