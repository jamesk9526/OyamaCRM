/**
 * Event workspace layout — wraps all /events/[eventId]/* pages with an event context banner.
 * Shows the event name, date, and a link back to the full event list.
 * Uses amber-100 background to distinguish event-scoped pages from the global list views.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

/** Minimal event shape needed for the banner strip. */
interface EventSummary {
  id: string;
  name: string;
  startDate: string;
  type?: string;
  status?: string;
}

/**
 * EventWorkspaceLayout — nested layout inside app/events/layout.tsx.
 *
 * Renders a sticky amber banner with:
 *   - ← All Events breadcrumb link
 *   - Event name
 *   - Event date
 * Then renders {children} (the individual event sub-page).
 */
export default function EventWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventSummary | null>(null);

  /** Fetch minimal event details for the banner — fires once per eventId. */
  useEffect(() => {
    if (!eventId) return;
    apiFetch<EventSummary>(`/api/events/${eventId}`)
      .then(setEvent)
      .catch(() => setEvent(null));
  }, [eventId]);

  return (
    <div className="min-h-full">
      {/* Amber context banner — identifies the event workspace */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <Link
          href="/events"
          className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
        >
          ← All Events
        </Link>
        <span className="text-amber-300">|</span>
        <span className="text-amber-500">📅</span>
        {event ? (
          <>
            <span className="text-sm font-semibold text-amber-900">{event.name}</span>
            <span className="text-amber-400 text-xs">—</span>
            <span className="text-xs text-amber-700">
              {new Date(event.startDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {event.status && (
              <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                event.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                event.status === "DRAFT" ? "bg-gray-100 text-gray-700" :
                event.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                "bg-amber-100 text-amber-800"
              }`}>
                {event.status.toLowerCase()}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-amber-500 italic">Loading event...</span>
        )}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
