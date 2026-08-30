"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, LayoutTemplate, RefreshCw } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

/** Event-first launcher for the canonical public-site workspace. */
export function EventsPageBuilderLanding() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadEvents() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        if (active) setEvents(Array.isArray(data) ? data : []);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Failed to load events.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadEvents();
    return () => { active = false; };
  }, [reloadKey]);

  return (
    <div className="min-h-full bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl border border-slate-300 bg-white shadow-sm">
        <header className="border-b border-slate-700 bg-slate-950 px-5 py-6 text-white sm:px-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Events / Public sites</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Choose an event to build</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">Each public site stays connected to its event record, tickets, sponsors, registration, and fundraising data.</p>
            </div>
            <Link href="/events/events" className="inline-flex h-10 items-center gap-2 border border-slate-600 bg-slate-900 px-4 text-xs font-semibold text-white hover:border-slate-400 hover:bg-slate-800">Manage events<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        <div className="flex min-h-12 items-center justify-between border-b border-slate-300 bg-slate-100 px-4 sm:px-5">
          <div className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-sky-700" /><h2 className="text-sm font-semibold text-slate-900">Event inventory</h2></div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{events.length} records</span>
        </div>

        {isLoading ? <div className="divide-y divide-slate-200" aria-label="Loading events">{[0, 1, 2].map((item) => <div key={item} className="h-[72px] animate-pulse bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50" />)}</div> : null}
        {error ? <div className="m-4 border-l-4 border-red-600 bg-red-50 p-4"><p className="text-sm font-semibold text-red-900">Could not load the event inventory</p><p className="mt-1 text-xs text-red-700">{error}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-3 inline-flex h-9 items-center gap-2 border border-red-300 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-100"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div> : null}

        {!isLoading && !error && events.length === 0 ? <div className="p-10 text-center"><CalendarDays className="mx-auto h-7 w-7 text-slate-400" /><h2 className="mt-3 text-base font-semibold text-slate-900">No events are ready to build</h2><p className="mt-1 text-sm text-slate-500">Create an event, then return here to configure its public site.</p><Link href="/events/events" className="mt-5 inline-flex h-10 items-center bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700">Open event manager</Link></div> : null}

        {!isLoading && !error && events.length > 0 ? <div className="divide-y divide-slate-200">{events.map((event) => (
          <div key={event.id} className="grid gap-3 px-4 py-4 transition hover:bg-sky-50/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center border border-slate-300 bg-slate-100"><CalendarDays className="h-4 w-4 text-slate-600" /></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950">{event.name}</h3><p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div></div>
            <div className="flex items-center gap-2 pl-[52px] sm:pl-0"><Link href={`/events/${encodeURIComponent(event.id)}/overview`} className="inline-flex h-9 items-center border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">Overview</Link><Link href={`/events/${encodeURIComponent(event.id)}/event-page`} className="inline-flex h-9 items-center gap-2 bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-700">Open builder<ArrowRight className="h-3.5 w-3.5" /></Link></div>
          </div>
        ))}</div> : null}
      </div>
    </div>
  );
}
