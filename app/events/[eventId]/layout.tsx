/** Event workspace layout keeps selected event context locked for /events/[eventId]/* routes. */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";

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
  const [event, setEvent] = useState<EventSummary | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    async function loadEventContext() {
      try {
        const eventData = await apiFetch<EventSummary>(`/api/events/${eventId}`);
        if (!active) return;
        setEvent(eventData);
      } catch {
        if (!active) return;
        setEvent(null);
      }
    }
    void loadEventContext();
    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <div className="min-h-full">
      <div className="rounded-xl border border-violet-300/70 bg-gradient-to-r from-slate-950 via-slate-900 to-violet-950 px-4 py-3 shadow-[0_10px_25px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">
              Selected Event
            </span>
            <Link href="/events/events" className="font-medium text-violet-100 hover:text-white hover:underline">
              All Events
            </Link>
            <span className="text-violet-200/70" aria-hidden="true">/</span>
            <span className="font-semibold text-white">{event?.name ?? "Loading event"}</span>
            <span className="hidden text-xs text-violet-100/80 sm:inline">{event ? formatDate(event.startDate) : ""}</span>
            {event?.status ? (
              <span className="rounded-full border border-violet-300/60 bg-violet-300/20 px-2 py-0.5 text-[11px] font-semibold text-violet-100">
                {event.status.toLowerCase()}
              </span>
            ) : null}
          </div>

          <Link
            href="/events/events"
            className="inline-flex items-center rounded-md border border-violet-300/60 bg-violet-400/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-400/25"
          >
            Back To All Events
          </Link>
        </div>
      </div>

      <div className="mt-3">{children}</div>
    </div>
  );
}
