/** EventsWorkspaceSelectorPage is the canonical event-first entry for Events CRM tools. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import NewEventModal from "@/app/components/events/NewEventModal";
import type { EventItem, EventsDashboardSummary } from "@/app/components/events/types";
import {
  EVENT_JOURNEY_STAGES,
  EVENT_WORKSPACE_TOOLS,
  GLOBAL_EVENTS_TOOLS,
  getEventTool,
  getEventToolHref,
  parseEventWorkspaceTool,
  type EventToolStatus,
  type EventWorkspaceTool,
  type EventWorkspaceToolMeta,
} from "@/app/components/events/events-workspace-config";

function statusTone(status: EventToolStatus): string {
  if (status === "Working") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Partially Working") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatEventDate(value?: string | null): string {
  if (!value) return "No date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortEventsForSelection(events: EventItem[]): EventItem[] {
  return [...events].sort((left, right) => {
    const leftDate = +new Date(left.startDate);
    const rightDate = +new Date(right.startDate);
    return leftDate - rightDate;
  });
}

function chooseDefaultEvent(events: EventItem[], requestedEventId: string | null): string {
  const requested = requestedEventId ? events.find((event) => event.id === requestedEventId) : null;
  if (requested) return requested.id;
  const now = Date.now();
  const upcoming = events.find((event) => event.active !== false && +new Date(event.startDate) >= now);
  const active = events.find((event) => event.active !== false);
  return upcoming?.id ?? active?.id ?? events[0]?.id ?? "";
}

function EventMetric({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function ToolCard({
  tool,
  active,
  href,
  onSelect,
}: {
  tool: EventWorkspaceToolMeta;
  active: boolean;
  href: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex min-h-[96px] w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50",
        !href ? "opacity-85" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{tool.label}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(tool.status)}`}>
          {tool.status}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{tool.description}</p>
      <p className="mt-auto pt-2 text-[11px] font-medium text-slate-500">
        {href ? "Open in selected event" : "Planned module"}
      </p>
    </button>
  );
}

function StageColumn({
  stage,
  tools,
  selectedTool,
  selectedEventId,
  onSelectTool,
}: {
  stage: EventWorkspaceToolMeta["stage"];
  tools: EventWorkspaceToolMeta[];
  selectedTool: EventWorkspaceTool;
  selectedEventId: string;
  onSelectTool: (tool: EventWorkspaceTool) => void;
}) {
  return (
    <section className="min-w-[230px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <h2 className="text-sm font-semibold text-slate-900">{stage}</h2>
      <div className="mt-3 space-y-2">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            href={getEventToolHref(tool, selectedEventId)}
            active={selectedTool === tool.id}
            onSelect={() => onSelectTool(tool.id)}
          />
        ))}
      </div>
    </section>
  );
}

/** EventsWorkspaceSelectorPage asks staff to choose an event before opening scoped tools. */
export default function EventsWorkspaceSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [summary, setSummary] = useState<EventsDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTool, setSelectedTool] = useState<EventWorkspaceTool>(() => parseEventWorkspaceTool(searchParams.get("tool")));
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  async function loadCommandCenter() {
    setLoading(true);
    try {
      const [eventData, summaryData] = await Promise.all([
        apiFetch<EventItem[]>("/api/events"),
        apiFetch<EventsDashboardSummary>("/api/events/dashboard-summary"),
      ]);
      const sortedEvents = sortEventsForSelection(Array.isArray(eventData) ? eventData : []);
      setEvents(sortedEvents);
      setSummary(summaryData);
      setSelectedEventId((current) => current || chooseDefaultEvent(sortedEvents, searchParams.get("eventId")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCommandCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const selectedToolMeta = useMemo(() => getEventTool(selectedTool), [selectedTool]);
  const targetHref = getEventToolHref(selectedToolMeta, selectedEventId);
  const toolsByStage = useMemo(
    () => EVENT_JOURNEY_STAGES.map((stage) => ({
      stage,
      tools: EVENT_WORKSPACE_TOOLS.filter((tool) => tool.stage === stage),
    })),
    [],
  );

  const checkInRate = (summary?.registeredGuests ?? 0) > 0
    ? Math.round(((summary?.checkedInGuests ?? 0) / (summary?.registeredGuests ?? 1)) * 100)
    : 0;

  function openSelectedTool() {
    if (!targetHref) return;
    router.push(targetHref);
  }

  return (
    <div className="space-y-3">
      <WorkspaceBreadcrumbBar
        accentTone="amber"
        items={[
          { label: "Events CRM", href: "/events" },
          { label: "Fundraising Event Command Center" },
        ]}
        statusLabel="Partially Working"
        metadata="Event-first nonprofit fundraising workflows"
        primaryAction={
          <button
            type="button"
            onClick={() => setShowNewEventModal(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Create Event
          </button>
        }
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Start">
          <WorkspaceRibbonButton label="All Events" href="/events/events" accentTone="amber" />
          <WorkspaceRibbonButton label="Templates" href="/events/templates" accentTone="amber" />
          <WorkspaceRibbonButton label="Global Reports" href="/events/reports" accentTone="amber" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Selected Event">
          <WorkspaceRibbonButton label="Overview" href={selectedEventId ? `/events/${selectedEventId}/overview` : undefined} disabled={!selectedEventId} accentTone="amber" />
          <WorkspaceRibbonButton label="Guests" href={selectedEventId ? `/events/${selectedEventId}/guests` : undefined} disabled={!selectedEventId} accentTone="amber" />
          <WorkspaceRibbonButton label="Tables" href={selectedEventId ? `/events/${selectedEventId}/tables` : undefined} disabled={!selectedEventId} accentTone="amber" />
          <WorkspaceRibbonButton label="Check-In" href={selectedEventId ? `/events/${selectedEventId}/check-in` : undefined} disabled={!selectedEventId} accentTone="amber" variant="primary" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Select event first</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950">Events CRM</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Manage fundraising banquets, table-host events, registrations, sponsors, guest lists, check-in, and post-event reporting from one event-scoped workspace.
              </p>
            </div>
            <label className="w-full max-w-md space-y-1">
              <span className="text-xs font-semibold text-slate-600">Active event</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                disabled={loading || events.length === 0}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              >
                <option value="">{loading ? "Loading events..." : "Select an event"}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {formatEventDate(event.startDate)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <EventMetric label="Active Events" value={loading ? "..." : summary?.activeEvents ?? 0} helper={`${summary?.upcomingEvents ?? 0} upcoming`} />
            <EventMetric label="Guests" value={loading ? "..." : summary?.registeredGuests ?? 0} helper={`${summary?.checkedInGuests ?? 0} checked in`} />
            <EventMetric label="Check-In Rate" value={loading ? "..." : `${checkInRate}%`} helper="Across current event data" />
            <EventMetric label="Revenue" value={loading ? "..." : `$${(summary?.totalRevenue ?? 0).toLocaleString()}`} helper="Event-linked payments" />
          </div>
        </div>

        <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Open workspace</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{selectedToolMeta.label}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">{selectedToolMeta.description}</p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">Selected event</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedEvent?.name ?? "No event selected"}</p>
            <p className="text-xs text-slate-500">{selectedEvent ? formatEventDate(selectedEvent.startDate) : "Create or select an event to continue."}</p>
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold text-slate-500">Status</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(selectedToolMeta.status)}`}>
              {selectedToolMeta.status}
            </span>
            <p className="mt-2 text-xs leading-5 text-slate-600">{selectedToolMeta.notes}</p>
          </div>
          <button
            type="button"
            onClick={openSelectedTool}
            disabled={!targetHref}
            className="mt-4 h-10 w-full rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {targetHref ? "Open Selected Tool" : "Tool Not Ready"}
          </button>
          {targetHref ? (
            <p className="mt-2 break-all text-xs text-amber-900">{targetHref}</p>
          ) : (
            <p className="mt-2 text-xs text-amber-900">This module is listed for planning clarity but is not exposed as a finished tool yet.</p>
          )}
        </aside>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-[1120px] gap-3">
          {toolsByStage.map(({ stage, tools }) => (
            <StageColumn
              key={stage}
              stage={stage}
              tools={tools}
              selectedTool={selectedTool}
              selectedEventId={selectedEventId}
              onSelectTool={setSelectedTool}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Before Selecting An Event</h2>
            <p className="mt-1 text-xs text-slate-500">Global tools are separate from event operations so guest, table, sponsor, and check-in data stays scoped.</p>
          </div>
          <Link href="/events/events" className="text-sm font-semibold text-amber-700 hover:text-amber-900">
            Review all events
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {GLOBAL_EVENTS_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:border-amber-300 hover:bg-amber-50/60"
            >
              <p className="text-sm font-semibold text-slate-900">{tool.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{tool.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {showNewEventModal ? (
        <NewEventModal
          onClose={() => setShowNewEventModal(false)}
          onCreated={() => {
            setShowNewEventModal(false);
            void loadCommandCenter();
          }}
        />
      ) : null}
    </div>
  );
}
