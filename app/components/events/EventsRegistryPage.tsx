"use client";
/** EventsRegistryPage renders the main event list and create flow for the Events CRM. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import NewEventModal from "@/app/components/events/NewEventModal";
import EventsMetricCard from "@/app/components/events/EventsMetricCard";
import type { EventItem } from "@/app/components/events/types";

/** Helper badge color based on event type. */
function badge(type: string) {
  switch (type) {
    case "GALA": return "bg-purple-50 text-purple-700";
    case "AUCTION": return "bg-amber-50 text-amber-700";
    case "CONFERENCE": return "bg-blue-50 text-blue-700";
    case "VOLUNTEER": return "bg-green-50 text-green-700";
    case "ONLINE": return "bg-cyan-50 text-cyan-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

/**
 * EventsRegistryPage upgrades the previous single events page into a registry workspace
 * with stronger KPI framing and a better creation flow.
 */
export default function EventsRegistryPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function refreshRegistry() {
    setLoading(true);
    try {
      const data = await apiFetch<EventItem[]>("/api/events");
      setEvents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialRegistry() {
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialRegistry();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = events.filter((event) => event.active).length;
  const registrations = events.reduce((sum, event) => sum + (event._count?.attendances ?? 0), 0);
  const volunteerHours = events.reduce((sum, event) => sum + (event._count?.volunteerHours ?? 0), 0);
  const upcoming = events.filter((event) => new Date(event.startDate) >= new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage fundraisers, galas, banquets, conferences, and ministry events.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm font-medium border border-amber-200 text-amber-700 rounded-lg bg-white hover:bg-amber-50 transition-colors">
            Import Event List
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            + New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <EventsMetricCard label="Total Events" value={events.length} helper="All events on record" />
        <EventsMetricCard label="Active Events" value={activeCount} helper="Currently open or in progress" />
        <EventsMetricCard label="Upcoming" value={upcoming} helper="Future events on the calendar" />
        <EventsMetricCard label="Registrations" value={registrations} helper={`${volunteerHours} volunteer hours linked`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Event Registry</h2>
              <p className="text-xs text-gray-500 mt-0.5">Operational list of all fundraising and ministry events</p>
            </div>
            <span className="text-xs text-gray-400">{events.length} total</span>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-44 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-gray-500">No events yet. Create your first event to launch the Events CRM workflow.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 p-5">
              {events.map((event) => {
                const attendeeCount = event._count?.attendances ?? 0;
                const goal = event.registrationGoal ?? 0;
                const pct = goal > 0 ? Math.min(100, Math.round((attendeeCount / goal) * 100)) : 0;
                return (
                  <div key={event.id} className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:border-amber-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{event.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-xs font-medium ${badge(event.type)}`}>{event.type}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{event.description || "No description provided yet."}</p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <p>Location: {event.location || "Not set"}</p>
                      <p>Status: {event.active ? "Active" : "Archived / closed"}</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{attendeeCount} registered</span>
                        <span>{goal > 0 ? `${pct}% of ${goal}` : "Goal not set"}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="pt-1">
                      <Link
                        href={`/events/${event.id}`}
                        className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        Open Event Workspace
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Recommended Next Steps</h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-amber-600">1.</span><span>Create ticket types and pricing rules</span></li>
              <li className="flex gap-2"><span className="text-amber-600">2.</span><span>Open orders and manual registration workflows</span></li>
              <li className="flex gap-2"><span className="text-amber-600">3.</span><span>Build guest linking and table assignments</span></li>
              <li className="flex gap-2"><span className="text-amber-600">4.</span><span>Turn on event-night check-in and post-event reporting</span></li>
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Workflow Coverage</h2>
            <div className="mt-4 space-y-3">
              {([
                ["Create an event", true],
                ["Track registrations", true],
                ["Ticket types", false],
                ["Orders & guests", false],
                ["Tables & seating", false],
                ["Check-in", false],
                ["Constituent sync", false],
              ] as Array<[string, boolean]>).map(([label, enabled]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {enabled ? "LIVE" : "NEXT"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <NewEventModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            void refreshRegistry();
          }}
        />
      )}
    </div>
  );
}
