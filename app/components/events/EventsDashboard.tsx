"use client";
/** EventsDashboard renders the main command-center dashboard for the Events CRM module. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import EventsKPICard from "@/app/components/events/EventsKPICard";
import EventsActionCard from "@/app/components/events/EventsActionCard";
import type { EventItem, EventsDashboardSummary } from "@/app/components/events/types";

/**
 * EventsDashboard focuses on live operational event metrics and quick navigation
 * so staff can move from planning into registration and check-in workflows.
 */
export default function EventsDashboard() {
  const [summary, setSummary] = useState<EventsDashboardSummary | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [summaryData, eventData] = await Promise.all([
          apiFetch<EventsDashboardSummary>("/api/events/dashboard-summary"),
          apiFetch<EventItem[]>("/api/events"),
        ]);
        if (!cancelled) {
          setSummary(summaryData);
          setEvents(Array.isArray(eventData) ? eventData : []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingEvents = [...events]
    .filter((e) => new Date(e.startDate) >= new Date() && e.active)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, 3);

  const Icons = {
    Calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    Users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Dollar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Ticket: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 010-4V8z" />
      </svg>
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events CRM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Command center for event planning, registrations, check-in, sponsors, volunteers, and follow-up.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/events/setup" className="px-3 py-2 text-sm font-medium border border-amber-200 text-amber-700 rounded-lg bg-white hover:bg-amber-50 transition-colors">
            Event Setup
          </Link>
          <Link href="/events/events" className="px-3 py-2 text-sm font-medium border border-amber-200 text-amber-700 rounded-lg bg-white hover:bg-amber-50 transition-colors">
            Events Registry
          </Link>
          <Link href="/events/check-in" className="px-3 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
            Launch Check-In
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <EventsKPICard
          label="Active Events"
          value={loading ? "…" : (summary?.activeEvents ?? 0)}
          helper={`${summary?.upcomingEvents ?? 0} upcoming`}
          trend="neutral"
          comparison="this quarter"
          icon={Icons.Calendar}
        />
        <EventsKPICard
          label="Registered Guests"
          value={loading ? "…" : (summary?.registeredGuests ?? 0)}
          helper={`${summary?.checkedInGuests ?? 0} checked in`}
          trend="up"
          trendValue="+12%"
          comparison="vs last event"
          icon={Icons.Users}
        />
        <EventsKPICard
          label="Revenue Tracked"
          value={loading ? "…" : `$${(summary?.totalRevenue ?? 0).toLocaleString()}`}
          helper="Event-linked payments"
          trend="up"
          trendValue="+8%"
          comparison="this quarter"
          icon={Icons.Dollar}
        />
        <EventsKPICard
          label="Open Seats"
          value={loading ? "…" : (summary?.openSeats ?? 0)}
          helper={`${summary?.totalEvents ?? 0} total events`}
          trend="neutral"
          icon={Icons.Ticket}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Operational Queue</h2>
              <p className="text-xs text-gray-500 mt-0.5">Critical actions needed across your events</p>
            </div>
            <div className="p-5 grid gap-3 sm:grid-cols-2">
              <EventsActionCard
                title="Incomplete Event Setup"
                description="2 events need ticket types, sponsor packages, or table assignments configured."
                badge="2 PENDING"
                badgeColor="amber"
                actionLabel="Review Setup"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
              />
              <EventsActionCard
                title="Pending Guest Check-Ins"
                description="Next event starts in 3 days. 47 registered guests have not checked in yet."
                badge="47 GUESTS"
                badgeColor="blue"
                actionLabel="View Guest List"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <EventsActionCard
                title="Unassigned Table Seats"
                description="Table 5 and Table 8 have open seats. Assign guests or mark as available."
                badge="2 TABLES"
                badgeColor="amber"
                actionLabel="Manage Tables"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4" strokeWidth={1.75} />
                    <circle cx="12" cy="4" r="1.5" strokeWidth={1.75} />
                    <circle cx="20" cy="12" r="1.5" strokeWidth={1.75} />
                    <circle cx="12" cy="20" r="1.5" strokeWidth={1.75} />
                    <circle cx="4" cy="12" r="1.5" strokeWidth={1.75} />
                  </svg>
                }
              />
              <EventsActionCard
                title="Post-Event Follow-Up"
                description="3 past events need thank-you emails sent and donor tasks created."
                badge="3 EVENTS"
                badgeColor="red"
                actionLabel="Send Thank-Yous"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Quick Event Workflows</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "Create Event", href: "/events/events" },
                { label: "Event Setup", href: "/events/setup" },
                { label: "Add Guests", href: "/events/guests" },
                { label: "Configure Tickets", href: "/events/tickets" },
                { label: "Add Sponsors", href: "/events/sponsors" },
                { label: "Seating Chart", href: "/events/tables" },
                { label: "Check-In", href: "/events/check-in" },
                { label: "Event Reports", href: "/events/reports" },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg border border-amber-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50 hover:border-amber-300 transition-colors text-center"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Events</h2>
            <p className="text-xs text-gray-500 mt-0.5">Next events requiring attention</p>
            <div className="mt-4 space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500">No upcoming events scheduled.</p>
                  <Link
                    href="/events/events"
                    className="inline-block mt-3 text-sm font-semibold text-amber-600 hover:text-amber-700"
                  >
                    Create your first event →
                  </Link>
                </div>
              ) : (
                upcomingEvents.map((event) => {
                  const daysUntil = Math.ceil((+new Date(event.startDate) - +new Date()) / (1000 * 60 * 60 * 24));
                  const attendeeCount = event._count?.attendances ?? 0;
                  const goal = event.registrationGoal ?? 0;
                  const pct = goal > 0 ? Math.min(100, Math.round((attendeeCount / goal) * 100)) : 0;

                  return (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-4 hover:border-amber-200 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{event.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {event.location ? ` · ${event.location}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
                          daysUntil <= 3 ? "bg-red-100 text-red-700" : daysUntil <= 7 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "TOMORROW" : `${daysUntil}D`}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{attendeeCount} registered</span>
                          {goal > 0 && <span>{pct}% of {goal}</span>}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Module Status</h2>
            <div className="mt-4 space-y-2">
              {([
                { label: "Event Registry", status: "ACTIVE", color: "green" },
                { label: "Ticket Configuration", status: "IN PROGRESS", color: "amber" },
                { label: "Guest Management", status: "IN PROGRESS", color: "amber" },
                { label: "Table Assignments", status: "PLANNED", color: "blue" },
                { label: "Check-In Workflow", status: "PLANNED", color: "blue" },
                { label: "Post-Event Reporting", status: "PLANNED", color: "blue" },
              ] as const).map((item) => {
                const colorMap = {
                  green: "bg-green-100 text-green-700 border-green-200",
                  amber: "bg-amber-100 text-amber-700 border-amber-200",
                  blue: "bg-blue-100 text-blue-700 border-blue-200",
                };
                return (
                  <div key={item.label} className="flex items-center justify-between text-sm py-2">
                    <span className="text-gray-700">{item.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${colorMap[item.color]}`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
