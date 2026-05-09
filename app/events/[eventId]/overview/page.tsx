/**
 * Event Overview page — /events/[eventId]/overview
 *
 * Scoped dashboard for a single event showing:
 *   - Event KPIs (guests, check-in %, revenue, confirmed RSVPs, payment issues, tables)
 *   - Event detail card (name, type, status, dates, location, capacity)
 *   - Quick action cards linking to the event's global management pages
 *   - Event-night readiness checklist
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventDetail {
  id: string;
  name: string;
  type?: string;
  status?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  capacity?: number;
  revenueGoal?: string;
  description?: string;
  active?: boolean;
  _count?: {
    guests?: number;
    sponsors?: number;
    tables?: number;
    orders?: number;
  };
}

interface GuestSummary {
  id: string;
  checkedIn: boolean;
  paymentStatus?: string;
  rsvpStatus?: string;
}

// ─── Helper Components ────────────────────────────────────────────────────────

/**
 * KPI card — amber-accented metric tile used in the overview grid.
 */
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Tailwind text color class override for the value */
  accent?: string;
}) {
  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200">
      <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Quick action card — links to a global event management page with eventId pre-filtered.
 */
function ActionCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white p-4 rounded-lg border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-gray-900 group-hover:text-amber-700">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * EventOverviewPage — event-scoped KPI dashboard.
 * Fetches the event details and its guest list to compute live metrics.
 */
export default function EventOverviewPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [eventData, guestsData] = await Promise.all([
        apiFetch<EventDetail>(`/api/events/${eventId}`),
        apiFetch<GuestSummary[]>(`/api/events/${eventId}/guests`),
      ]);
      setEvent(eventData);
      setGuests(guestsData);
    } catch (err) {
      console.error("Failed to load event overview:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        Event not found or could not be loaded.
      </div>
    );
  }

  // ─── Computed KPIs from the guest list ──────────────────────────────────────

  const totalGuests = guests.length;
  const checkedIn = guests.filter((g) => g.checkedIn).length;
  const checkedInPct = totalGuests > 0 ? Math.round((checkedIn / totalGuests) * 100) : 0;
  const confirmedRsvp = guests.filter((g) => g.rsvpStatus === "CONFIRMED").length;
  const paymentIssues = guests.filter(
    (g) => g.paymentStatus === "DUE" || g.paymentStatus === "PENDING_CHECK"
  ).length;

  // Revenue: sum from orders would require additional API call — use _count as proxy
  const tableCount = event._count?.tables ?? 0;
  const sponsorCount = event._count?.sponsors ?? 0;
  const orderCount = event._count?.orders ?? 0;

  // ─── Readiness checklist ──────────────────────────────────────────────────

  const checklist = [
    { label: "Guests registered", done: totalGuests > 0 },
    { label: "RSVP confirmations received", done: confirmedRsvp > 0 },
    { label: "Tables configured", done: tableCount > 0 },
    { label: "Sponsors logged", done: sponsorCount > 0 },
    { label: "Orders / payment complete", done: paymentIssues === 0 && orderCount > 0 },
    { label: "Check-in started", done: checkedIn > 0 },
  ];

  const readyCount = checklist.filter((c) => c.done).length;

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{event.name} — Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live dashboard for this event</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Guests" value={totalGuests} />
        <KpiCard
          label="Checked In"
          value={`${checkedInPct}%`}
          sub={`${checkedIn} of ${totalGuests}`}
          accent={checkedInPct >= 80 ? "text-green-600" : checkedInPct >= 40 ? "text-amber-600" : "text-gray-900"}
        />
        <KpiCard
          label="Confirmed RSVP"
          value={confirmedRsvp}
          accent="text-amber-600"
        />
        <KpiCard
          label="Payment Issues"
          value={paymentIssues}
          accent={paymentIssues > 0 ? "text-red-600" : "text-green-600"}
        />
        <KpiCard label="Tables" value={tableCount} />
        <KpiCard label="Sponsors" value={sponsorCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event detail card */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Event Details</h2>
          <dl className="space-y-2 text-sm">
            {event.type && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Type</dt>
                <dd className="text-gray-900 font-medium">{event.type.replace("_", " ")}</dd>
              </div>
            )}
            {event.status && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Status</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                    event.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                    event.status === "DRAFT" ? "bg-gray-100 text-gray-700" :
                    event.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {event.status.toLowerCase()}
                  </span>
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-20 shrink-0">Start</dt>
              <dd className="text-gray-900">
                {new Date(event.startDate).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </dd>
            </div>
            {event.endDate && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">End</dt>
                <dd className="text-gray-900">
                  {new Date(event.endDate).toLocaleString("en-US", {
                    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
            {event.location && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Location</dt>
                <dd className="text-gray-900">{event.location}</dd>
              </div>
            )}
            {event.capacity && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Capacity</dt>
                <dd className="text-gray-900">{event.capacity.toLocaleString()}</dd>
              </div>
            )}
            {event.revenueGoal && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Goal</dt>
                <dd className="text-gray-900 font-semibold text-amber-700">
                  ${Number(event.revenueGoal).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Quick action cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Quick Actions</h2>
          <div className="space-y-2">
            <ActionCard
              icon="✅"
              title="Check-In"
              description="Start door check-in for this event"
              href="/events/check-in"
            />
            <ActionCard
              icon="👥"
              title="Guest List"
              description="View and manage all registered guests"
              href="/events/guests"
            />
            <ActionCard
              icon="🏆"
              title="Sponsors"
              description="Manage event sponsors and packages"
              href="/events/sponsors"
            />
            <ActionCard
              icon="📋"
              title="Tables"
              description="Assign guests to tables and seating"
              href="/events/tables"
            />
          </div>
        </div>

        {/* Event-night readiness checklist */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Readiness</h2>
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              {readyCount}/{checklist.length}
            </span>
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <span className={item.done ? "text-green-500" : "text-gray-300"}>
                  {item.done ? "✓" : "○"}
                </span>
                <span className={item.done ? "text-gray-700" : "text-gray-400"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          {readyCount === checklist.length && (
            <p className="mt-4 text-xs text-green-700 font-semibold bg-green-50 rounded px-2 py-1 text-center">
              🎉 Event is ready!
            </p>
          )}
        </div>
      </div>

      {/* Last refreshed */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Live data — {new Date().toLocaleTimeString()}
        </p>
        <button
          onClick={loadData}
          className="text-xs text-amber-600 hover:text-amber-800 font-medium"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
