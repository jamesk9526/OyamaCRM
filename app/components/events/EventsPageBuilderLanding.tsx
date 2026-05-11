// EventsPageBuilderLanding surfaces global event-page creation workflows outside event-scoped tools.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

/**
 * EventsPageBuilderLanding lists events and links staff into the shared website builder
 * so teams can create and edit public event pages without selecting a scoped event workspace first.
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
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h1 className="text-xl font-semibold text-gray-900">Event Page Builder</h1>
        <p className="text-sm text-blue-900 mt-1">
          This global tool sends staff into the shared website builder so event landing pages stay managed in one place.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/webmaster?source=events"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Website Builder
          </Link>
          <Link
            href="/events/workspace"
            className="inline-flex items-center rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Back To Events Workspace Selector
          </Link>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-gray-600">Loading events...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-900">Jump Into A Specific Event Page</h2>
            <span className="text-xs text-gray-500">{events.length} event(s)</span>
          </div>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">No events found yet. Create an event first, then attach a page in the website builder.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{event.name}</p>
                    <p className="text-xs text-gray-500">{new Date(event.startDate).toLocaleDateString()}</p>
                  </div>
                  <Link
                    href={`/webmaster?source=events&eventId=${encodeURIComponent(event.id)}`}
                    className="inline-flex items-center rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Build / Edit Event Page
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
