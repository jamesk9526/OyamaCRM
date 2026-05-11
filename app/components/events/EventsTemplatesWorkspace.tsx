// EventsTemplatesWorkspace provides a global template utility for cloning prior events into reusable drafts.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

interface CreatedEvent {
  id: string;
  name: string;
}

/**
 * EventsTemplatesWorkspace lets staff generate draft event templates from past events
 * so teams can start future planning with real structure instead of manual re-entry.
 */
export function EventsTemplatesWorkspace() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creatingEventId, setCreatingEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EventItem[]>("/api/events");
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEvents();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadEvents]);

  /**
   * Clones a selected event into a private draft that teams can edit as a reusable template baseline.
   */
  async function createTemplateFromEvent(event: EventItem) {
    setCreatingEventId(event.id);
    setError(null);
    setNotice(null);

    try {
      const sourceDate = new Date(event.startDate);
      const templateStart = Number.isNaN(sourceDate.getTime()) ? new Date() : new Date(sourceDate);
      templateStart.setDate(templateStart.getDate() + 30);
      const templateEnd = new Date(templateStart);
      templateEnd.setHours(templateEnd.getHours() + 2);

      const created = await apiFetch<CreatedEvent>("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${event.name} Template`,
          description: `Template cloned from ${event.name}. Update date, goals, and details before publishing.`,
          type: event.type || "OTHER",
          status: "DRAFT",
          visibility: "PRIVATE",
          location: event.location ?? undefined,
          startDate: templateStart.toISOString(),
          endDate: templateEnd.toISOString(),
          active: false,
        }),
      });

      setNotice(`Template draft created: ${created.name}`);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template draft.");
    } finally {
      setCreatingEventId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h1 className="text-xl font-semibold text-gray-900">Event Templates</h1>
        <p className="text-sm text-amber-900 mt-1">
          Create reusable draft templates from prior events. This keeps setup consistent across gala, workshop, and campaign events.
        </p>
        <p className="text-xs text-amber-900 mt-2">
          In development: template metadata bundles (tickets, table maps, message templates) are not yet auto-cloned.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">Create A Template Draft From Existing Event</h2>
          <Link href="/events/events" className="text-xs font-medium text-green-700 hover:underline">
            Open Event Registry
          </Link>
        </div>

        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {isLoading ? <p className="text-sm text-gray-500">Loading events...</p> : null}

        {!isLoading ? (
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">No events available yet. Create an event first, then generate a template draft from it.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{event.name}</p>
                    <p className="text-xs text-gray-500">{new Date(event.startDate).toLocaleDateString()} • {event.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => createTemplateFromEvent(event)}
                    disabled={creatingEventId === event.id}
                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {creatingEventId === event.id ? "Creating..." : "Create Template Draft"}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
