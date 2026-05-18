/** Event workspace layout shows the active event switcher for all /events/[eventId]/* routes. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

/** Minimal event shape needed for the event-scoped context bar. */
interface EventSummary {
  id: string;
  name: string;
  startDate: string;
  type?: string;
  status?: string;
}

function formatDate(value?: string): string {
  if (!value) return "No date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date set";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toolSegmentFromPath(pathname: string, eventId: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part === eventId);
  return index >= 0 ? parts[index + 1] ?? "overview" : "overview";
}

/**
 * EventWorkspaceLayout keeps the selected fundraising event visible while users
 * move between guests, tables, sponsors, registration, check-in, and reports.
 */
export default function EventWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { eventId } = useParams<{ eventId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    async function loadEventContext() {
      try {
        const [eventData, eventList] = await Promise.all([
          apiFetch<EventSummary>(`/api/events/${eventId}`),
          apiFetch<EventItem[]>("/api/events"),
        ]);
        if (!active) return;
        setEvent(eventData);
        setEvents(Array.isArray(eventList) ? eventList.filter((item) => item.active !== false) : []);
      } catch {
        if (!active) return;
        setEvent(null);
        setEvents([]);
      }
    }
    void loadEventContext();
    return () => {
      active = false;
    };
  }, [eventId]);

  const sortedEvents = useMemo(
    () => [...events].sort((left, right) => +new Date(left.startDate) - +new Date(right.startDate)),
    [events],
  );

  function switchEvent(nextEventId: string) {
    if (!nextEventId || nextEventId === eventId) return;
    const toolSegment = toolSegmentFromPath(pathname, eventId);
    router.push(`/events/${nextEventId}/${toolSegment}`);
  }

  return (
    <div className="min-h-full">
      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Link href="/events" className="font-medium text-amber-700 hover:text-amber-900 hover:underline">
              All Events
            </Link>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900">{event?.name ?? "Loading event"}</span>
            <span className="hidden text-xs text-slate-500 sm:inline">{event ? formatDate(event.startDate) : ""}</span>
            {event?.status ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {event.status.toLowerCase()}
              </span>
            ) : null}
          </div>

          <label className="flex min-w-[260px] items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Active event</span>
            <select
              value={eventId}
              onChange={(selectEvent) => switchEvent(selectEvent.target.value)}
              className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              {sortedEvents.length === 0 ? (
                <option value={eventId}>{event?.name ?? "Loading event"}</option>
              ) : (
                sortedEvents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {formatDate(item.startDate)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3">{children}</div>
    </div>
  );
}
