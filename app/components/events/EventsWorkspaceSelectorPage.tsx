/**
 * EventsWorkspaceSelectorPage — Event selection and discovery interface.
 *
 * This is the landing page for the Events CRM when no specific event is selected.
 * It renders the event registry (all events) with summary metrics and journey overview cards.
 *
 * TODO: Replace the 4 summary metric cards with live data from /api/events/dashboard-summary
 *       once that endpoint returns accurate cross-event totals. Currently some values
 *       (volunteer hours, registered guest counts) are placeholders or approximations.
 *       See EventsDashboardSummary type in types.ts for the expected shape.
 *
 * TODO: Add search/filter controls to the event list (filter by type, date range, status).
 *       Large organizations will have 50+ events making scrolling impractical.
 *       Consider a top search bar + type/status filter chips above the event grid.
 *
 * TODO: Add an "Active / Upcoming / Past" tab switcher or filter pill row above the event grid
 *       instead of the current two static sections. This scales better with event volume.
 *
 * TODO: Add a quick "Duplicate event" action to each event card for organizations that
 *       run recurring annual events (Gala 2024 → Gala 2025).
 *
 * TODO: Show a "last updated" or event health indicator per card (registration open/closed,
 *       check-in status, page published) so staff can scan the registry for action items.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import NewEventModal from "@/app/components/events/NewEventModal";
import type { EventItem, EventsDashboardSummary } from "@/app/components/events/types";

function formatEventDate(value?: string | null): string {
  if (!value) return "No date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SummaryMetric({ label, value, note, icon }: { label: string; value: string | number; note: string; icon?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    GALA: "bg-purple-100 text-purple-700 border-purple-200",
    AUCTION: "bg-amber-100 text-amber-700 border-amber-200",
    CONFERENCE: "bg-blue-100 text-blue-700 border-blue-200",
    WORKSHOP: "bg-green-100 text-green-700 border-green-200",
    STEWARDSHIP: "bg-rose-100 text-rose-700 border-rose-200",
    CULTIVATION: "bg-indigo-100 text-indigo-700 border-indigo-200",
    VOLUNTEER: "bg-cyan-100 text-cyan-700 border-cyan-200",
    RUN_WALK: "bg-orange-100 text-orange-700 border-orange-200",
    ONLINE: "bg-pink-100 text-pink-700 border-pink-200",
  };
  return colors[type] || "bg-slate-100 text-slate-700 border-slate-200";
}

function EventCard({ event, onOpen }: { event: EventItem; onOpen: (eventId: string) => void }) {
  const startDate = new Date(event.startDate);
  const isUpcoming = startDate.getTime() > Date.now();

  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-2">{event.name}</h3>
          <p className="text-xs text-slate-500 mt-1">{event.location || "Location TBD"}</p>
        </div>
        <div className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold whitespace-nowrap ${getEventTypeColor(event.type)}`}>
          {event.type.replace(/_/g, " ")}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-sm">
          <span>📅</span>
          <span className="text-slate-700 font-medium">{formatEventDate(event.startDate)}</span>
          {isUpcoming && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">Upcoming</span>}
        </div>
        {event.active && <span className="w-2 h-2 rounded-full bg-green-500" />}
      </div>
      {event.description && <p className="text-xs text-slate-600 line-clamp-2">{event.description}</p>}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="text-slate-600">{event._count?.attendances ?? 0} <span className="text-slate-400">guests</span></div>
        {event.registrationGoal && (
          <div className="text-right">
            <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-violet-600" style={{ width: `${Math.min((((event._count?.attendances ?? 0) / event.registrationGoal) * 100), 100)}%` }} />
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-violet-600 group-hover:text-violet-700">Open event →</p>
    </button>
  );
}

/**
 * EventsWorkspaceSelectorPage — Event selection and discovery interface.
 * Shows event list with quick stats, journey stage overview, and tool discovery.
 * Production-polished design with clear journey visualization.
 */
export default function EventsWorkspaceSelectorPage() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [summary, setSummary] = useState<EventsDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [eventData, summaryData] = await Promise.all([
          apiFetch<EventItem[]>("/api/events"),
          apiFetch<EventsDashboardSummary>("/api/events/dashboard-summary"),
        ]);
        const sorted = (Array.isArray(eventData) ? eventData : []).sort((a, b) => 
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        setEvents(sorted);
        setSummary(summaryData);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const upcomingEvents = useMemo(
    () => events.filter((e) => new Date(e.startDate).getTime() > Date.now()),
    [events],
  );

  const pastEvents = useMemo(
    () => events.filter((e) => new Date(e.startDate).getTime() <= Date.now()),
    [events],
  );

  function openEvent(eventId: string) {
    router.push(`/events/${eventId}/overview`);
  }

  /** Opens the selected event from the primary dropdown selector. */
  function openSelectedEvent() {
    if (!selectedEventId) return;
    openEvent(selectedEventId);
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <WorkspaceBreadcrumbBar
        accentTone="purple"
        items={[
          { label: "EventSTUDIO", href: "/events" },
          { label: "Fundraising Events" },
        ]}
        metadata="Event-first fundraising management"
        primaryAction={
          <button
            type="button"
            onClick={() => setShowNewEventModal(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm hover:shadow-md"
          >
            + Create Event
          </button>
        }
      />

      {/* Ribbon */}
      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Tools">
          <WorkspaceRibbonButton label="All Events" href="/events/events" accentTone="purple" />
          <WorkspaceRibbonButton label="Templates" href="/events/templates" accentTone="purple" />
          <WorkspaceRibbonButton label="Global Reports" href="/events/reports" accentTone="purple" />
          <WorkspaceRibbonButton label="Page Builder" href="/events/page-builder" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {/* Primary event selector */}
      <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label
              htmlFor="eventstudio-root-selector"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Select event workspace
            </label>
            <select
              id="eventstudio-root-selector"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              disabled={loading || events.length === 0}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {loading ? "Loading events..." : events.length === 0 ? "No events found" : "Choose an event..."}
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {formatEventDate(event.startDate)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={openSelectedEvent}
            disabled={!selectedEventId}
            className="h-10 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open Workspace
          </button>
          <button
            type="button"
            onClick={() => setShowNewEventModal(true)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            Create Event
          </button>
        </div>
      </section>

      {/* Summary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          label="Total Events"
          value={summary?.totalEvents ?? 0}
          note={`${summary?.activeEvents ?? 0} active`}
          icon="🎪"
        />
        <SummaryMetric
          label="Registered Guests"
          value={summary?.registeredGuests ?? 0}
          note={`${summary?.checkedInGuests ?? 0} checked in`}
          icon="👥"
        />
        <SummaryMetric
          label="Total Revenue"
          value={`$${(summary?.totalRevenue ?? 0).toLocaleString()}`}
          note="Across all events"
          icon="💰"
        />
        <SummaryMetric
          label="Volunteer Hours"
          value={summary?.volunteerHours ?? 0}
          note="Logged so far"
          icon="⏱️"
        />
      </div>

      {/* Journey overview */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Event Journey</h2>
          <p className="text-sm text-slate-500 mt-1">A complete workflow from planning through follow-up</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="font-semibold text-slate-900">Before Event</h3>
                <p className="text-xs text-slate-600 mt-1">Plan, register guests, manage sponsors, and set up tables</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎪</span>
              <div>
                <h3 className="font-semibold text-slate-900">During Event</h3>
                <p className="text-xs text-slate-600 mt-1">Live check-in, real-time operations, and guest management</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-slate-900">After Event</h3>
                <p className="text-xs text-slate-600 mt-1">Follow-up communications, reports, and analysis</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Events list */}
      {!loading && events.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">No events yet</p>
          <p className="text-sm text-slate-600 mt-1">Create your first event to get started with EventSTUDIO</p>
          <button
            type="button"
            onClick={() => setShowNewEventModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Create Event
          </button>
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Upcoming Events</h2>
            <p className="text-sm text-slate-500 mt-1">{upcomingEvents.length} event{upcomingEvents.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} onOpen={openEvent} />
            ))}
          </div>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Past Events</h2>
            <p className="text-sm text-slate-500 mt-1">{pastEvents.length} event{pastEvents.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} onOpen={openEvent} />
            ))}
          </div>
        </section>
      )}

      {/* Modal */}
      {showNewEventModal && (
        <NewEventModal
          onClose={() => setShowNewEventModal(false)}
          onCreated={() => {
            setShowNewEventModal(false);
            apiFetch<EventItem[]>("/api/events").then((data) => {
              setEvents(Array.isArray(data) ? data : []);
            });
          }}
        />
      )}
    </div>
  );
}
