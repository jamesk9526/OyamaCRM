"use client";
/** EventSetupWorkspace provides a dedicated setup-oriented workspace for preparing events. */

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import EventSetupChecklist from "@/app/components/events/EventSetupChecklist";
import EventsActionCard from "@/app/components/events/EventsActionCard";
import type { EventItem } from "@/app/components/events/types";

/** Event setup configuration and readiness state. */
interface EventSetupState {
  eventId: string;
  ticketTypesConfigured: boolean;
  sponsorPackagesConfigured: boolean;
  communicationsReady: boolean;
  checkInReady: boolean;
  tablesConfigured: boolean;
  guestsImported: boolean;
}

/**
 * EventSetupWorkspace is a command center for preparing a single event,
 * surfacing setup progress, readiness checks, and quick actions.
 */
export default function EventSetupWorkspace() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        if (!cancelled) {
          const eventList = Array.isArray(data) ? data : [];
          setEvents(eventList);
          // Auto-select the first upcoming active event
          const upcoming = eventList.find((e) => e.active && new Date(e.startDate) >= new Date());
          if (upcoming) {
            setSelectedEventId(upcoming.id);
          } else if (eventList.length > 0) {
            setSelectedEventId(eventList[0].id);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Mock setup state - in production, this would come from backend setup status API
  const setupState: EventSetupState = {
    eventId: selectedEventId ?? "",
    ticketTypesConfigured: false,
    sponsorPackagesConfigured: false,
    communicationsReady: false,
    checkInReady: false,
    tablesConfigured: false,
    guestsImported: false,
  };

  const setupSteps = [
    {
      label: "Configure ticket types and pricing",
      complete: setupState.ticketTypesConfigured,
      href: "/events/tickets",
      helper: "Define general admission, VIP, sponsor tables, and other ticket categories",
    },
    {
      label: "Set up sponsor packages",
      complete: setupState.sponsorPackagesConfigured,
      href: "/events/sponsors",
      helper: "Create sponsorship tiers (platinum, gold, silver) with benefits and pricing",
    },
    {
      label: "Import or create guest list",
      complete: setupState.guestsImported,
      href: "/events/guests",
      helper: "Add guests manually, import from CSV, or sync from constituent records",
    },
    {
      label: "Configure table assignments",
      complete: setupState.tablesConfigured,
      href: "/events/tables",
      helper: "Define table names, capacities, hosts, and preferred seating arrangements",
    },
    {
      label: "Prepare communications templates",
      complete: setupState.communicationsReady,
      href: "/events/communications",
      helper: "Draft confirmation emails, reminder messages, and thank-you notes",
    },
    {
      label: "Activate check-in workflow",
      complete: setupState.checkInReady,
      href: "/events/check-in",
      helper: "Test QR scanning, name search, and badge printing before event night",
    },
  ];

  const Icons = {
    Ticket: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 010-4V8z" />
      </svg>
    ),
    Users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Table: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" strokeWidth={1.75} />
        <circle cx="12" cy="4" r="1.5" strokeWidth={1.75} />
        <circle cx="20" cy="12" r="1.5" strokeWidth={1.75} />
        <circle cx="12" cy="20" r="1.5" strokeWidth={1.75} />
        <circle cx="4" cy="12" r="1.5" strokeWidth={1.75} />
      </svg>
    ),
    CheckCircle: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Event Setup</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Prepare events for registration, check-in, and follow-up workflows.
            </p>
          </div>
          <Link
            href="/events/events"
            className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            Create First Event
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-500">No events yet. Create your first event to begin setup.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Event Setup</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prepare events for registration, check-in, and follow-up workflows.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/events/events"
            className="px-3 py-2 text-sm font-medium border border-amber-200 text-amber-700 rounded-lg bg-white hover:bg-amber-50 transition-colors"
          >
            View All Events
          </Link>
          <Link
            href="/events"
            className="px-3 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Event selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          Select Event to Configure
        </label>
        <select
          value={selectedEventId ?? ""}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-900"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} — {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.5fr] gap-6">
        {/* Setup checklist */}
        <div>
          {selectedEvent && (
            <EventSetupChecklist
              eventName={selectedEvent.name}
              steps={setupSteps}
            />
          )}
        </div>

        {/* Quick actions and readiness cards */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Setup Actions</h2>
            <div className="grid gap-3">
              <EventsActionCard
                title="Ticket Types"
                description="Define ticket categories, pricing, and capacity limits for registration."
                badge="NOT SET"
                badgeColor="amber"
                actionLabel="Configure Tickets"
                icon={Icons.Ticket}
              />
              <EventsActionCard
                title="Guest Management"
                description="Import guest lists from CSV, sync from constituents, or add manually."
                badge="0 GUESTS"
                badgeColor="blue"
                actionLabel="Manage Guests"
                icon={Icons.Users}
              />
              <EventsActionCard
                title="Table Assignments"
                description="Set up table names, capacities, and seating arrangements for the event."
                badge="0 TABLES"
                badgeColor="blue"
                actionLabel="Configure Tables"
                icon={Icons.Table}
              />
              <EventsActionCard
                title="Check-In Readiness"
                description="Test QR scanning, name search, and badge printing before event night."
                badge="NOT READY"
                badgeColor="red"
                actionLabel="Test Check-In"
                icon={Icons.CheckCircle}
              />
            </div>
          </div>

          {selectedEvent && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Event Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Event Type</span>
                  <span className="font-medium text-gray-900">{selectedEvent.type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-gray-900">{selectedEvent.location || "Not set"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Start Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(selectedEvent.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Guest Goal</span>
                  <span className="font-medium text-gray-900">{selectedEvent.registrationGoal || "Not set"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Revenue Goal</span>
                  <span className="font-medium text-gray-900">
                    {selectedEvent.revenueGoal ? `$${selectedEvent.revenueGoal.toLocaleString()}` : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedEvent.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {selectedEvent.active ? "ACTIVE" : "ARCHIVED"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
