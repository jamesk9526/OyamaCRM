// EventsPageBuilderLanding helps staff choose an event before opening the scoped Event Page Builder.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

/**
 * EventsPageBuilderLanding keeps event-first selection as the only entrypoint for
 * the Event Page Builder so public pages stay tied to one selected event.
 */
export function EventsPageBuilderLanding() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Load all events once so page builders can jump directly into the right event context.
    async function loadEvents() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        if (isMounted) {
          setEvents(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load events.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <h1 className="text-xl font-semibold text-slate-900">Event Page Builder</h1>
        <p className="mt-1 text-sm text-violet-900">
          The Event Page Builder is now an event-scoped Events CRM tool. Select an event, then build and publish its public page from the same event command center.
        </p>
        <ul className="mt-2 space-y-1 text-xs text-violet-800">
          <li>• Uses event record source-of-truth fields for date, location, tickets, sponsors, and fundraising progress.</li>
          <li>• Keeps event staff inside Events CRM without routing into Oyama Webmaster.</li>
          <li>• Preserves fast event-first flow: select event to open builder, preview, and publish.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/events/events"
            className="inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Open All Events
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
          >
            Back To Events Dashboard
          </Link>
        </div>
      </section>

      {isLoading ? <p className="text-sm text-slate-600">Loading events...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isLoading && !error ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Choose Event For Public Page</h2>
            <span className="text-xs text-slate-500">{events.length} event(s)</span>
          </div>

          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No events found. Create an event first, then open the event-scoped page builder.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{event.name}</p>
                    <p className="text-xs text-slate-500">{new Date(event.startDate).toLocaleDateString()}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/events/${encodeURIComponent(event.id)}/overview`}
                      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Overview
                    </Link>
                    <Link
                      href={`/events/${encodeURIComponent(event.id)}/event-page`}
                      className="inline-flex items-center rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      Build / Edit Page
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
