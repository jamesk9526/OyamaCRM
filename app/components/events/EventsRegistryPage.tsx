"use client";
/** EventsRegistryPage is the searchable starting point for every EventSTUDIO workflow. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, MapPin, Plus, Search, Users } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import NewEventModal from "@/app/components/events/NewEventModal";
import EventsMetricCard from "@/app/components/events/EventsMetricCard";
import type { EventItem } from "@/app/components/events/types";

function badge(type: string) {
  switch (type) {
    case "GALA": return "bg-[#f5f0f8] text-[#5c2d91]";
    case "TRIVIA": return "bg-[#eff6fc] text-[#0f548c]";
    case "FUNDRAISER": return "bg-[#dff6dd] text-[#0b6a0b]";
    case "AUCTION": return "bg-[#fff4ce] text-[#835b00]";
    default: return "bg-[#f3f2f1] text-[#424242]";
  }
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date not set" : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EventsRegistryPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"upcoming" | "all" | "archived">("upcoming");

  async function refreshRegistry() {
    setLoading(true);
    try { const data = await apiFetch<EventItem[]>("/api/events"); setEvents(Array.isArray(data) ? data : []); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    void apiFetch<EventItem[]>("/api/events").then((data) => { if (!cancelled) setEvents(Array.isArray(data) ? data : []); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const activeCount = events.filter((event) => event.active).length;
  const registrations = events.reduce((sum, event) => sum + (event._count?.attendances ?? 0), 0);
  const upcoming = events.filter((event) => event.active && new Date(event.startDate) >= now).length;
  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events
      .filter((event) => view === "all" || (view === "archived" ? !event.active : event.active && new Date(event.startDate) >= new Date()))
      .filter((event) => !normalized || [event.name, event.location, event.type, event.description].some((value) => String(value ?? "").toLowerCase().includes(normalized)))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events, query, view]);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 p-3 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-4 border-b border-[#d1d1d1] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0f6cbd]">EVENTSTUDIO</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#242424]">Events</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#616161]">Choose an event to continue, or start a new event from a reusable plan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/events/templates" className="event-studio-secondary-button"><FileText className="h-4 w-4" />Browse templates</Link>
          <button type="button" onClick={() => setShowModal(true)} className="event-studio-primary-button"><Plus className="h-4 w-4" />New event</button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden border border-[#d1d1d1] bg-[#d1d1d1] lg:grid-cols-4" aria-label="Event summary">
        <EventsMetricCard label="Upcoming" value={upcoming} helper="Scheduled events" />
        <EventsMetricCard label="Active" value={activeCount} helper="Open workspaces" />
        <EventsMetricCard label="Registrations" value={registrations} helper="Across all events" />
        <EventsMetricCard label="All events" value={events.length} helper="Complete history" />
      </section>

      <section className="border border-[#d1d1d1] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e1dfdd] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist" aria-label="Event view">
            {(["upcoming", "all", "archived"] as const).map((option) => <button key={option} type="button" role="tab" aria-selected={view === option} onClick={() => setView(option)} className={`min-h-9 border-b-2 px-3 text-sm font-semibold capitalize ${view === option ? "border-[#0f6cbd] text-[#0f548c]" : "border-transparent text-[#616161] hover:bg-[#f3f2f1]"}`}>{option}</button>)}
          </div>
          <label className="relative block w-full sm:w-72"><span className="sr-only">Search events</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#616161]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" className="h-9 w-full border border-[#8a8886] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]" /></label>
        </div>

        {loading ? (
          <div className="grid gap-px bg-[#e1dfdd] md:grid-cols-2"><div className="h-48 animate-pulse bg-white" /><div className="h-48 animate-pulse bg-white" /></div>
        ) : visibleEvents.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center"><div><CalendarDays className="mx-auto h-9 w-9 text-[#8a8886]" /><h2 className="mt-3 text-base font-semibold">{events.length ? "No events match this view" : "Create your first event"}</h2><p className="mt-1 text-sm text-[#616161]">{events.length ? "Try another search or event status." : "Start with a blank event or choose a reusable template."}</p>{!events.length ? <button type="button" className="event-studio-primary-button mt-4" onClick={() => setShowModal(true)}><Plus className="h-4 w-4" />New event</button> : null}</div></div>
        ) : (
          <div className="grid gap-px bg-[#e1dfdd] md:grid-cols-2 xl:grid-cols-3">
            {visibleEvents.map((event) => {
              const attendeeCount = event._count?.attendances ?? 0;
              const goal = event.registrationGoal ?? 0;
              const pct = goal > 0 ? Math.min(100, Math.round((attendeeCount / goal) * 100)) : 0;
              return (
                <article key={event.id} className="flex min-w-0 flex-col bg-white p-4 transition-colors hover:bg-[#fafafa]">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-semibold text-[#242424]">{event.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-[#616161]"><CalendarDays className="h-3.5 w-3.5" />{formatDate(event.startDate)}</p></div><span className={`shrink-0 px-2 py-1 text-[11px] font-semibold ${badge(event.type)}`}>{event.type}</span></div>
                  <p className="mt-3 flex min-h-5 items-center gap-1.5 truncate text-sm text-[#616161]"><MapPin className="h-4 w-4 shrink-0" />{event.location || "Location not set"}</p>
                  <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-xs text-[#616161]"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{attendeeCount} registered</span><span>{goal > 0 ? `${pct}% of ${goal}` : "No goal"}</span></div><div className="h-1.5 overflow-hidden bg-[#edebe9]"><div className="h-full bg-[#0f6cbd]" style={{ width: `${pct}%` }} /></div></div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#edebe9] pt-3"><span className="inline-flex items-center gap-1.5 text-xs text-[#616161]"><span className={`h-2 w-2 rounded-full ${event.active ? "bg-[#107c10]" : "bg-[#8a8886]"}`} />{event.active ? "Active" : "Archived"}</span><Link href={`/events/${event.id}`} className="inline-flex min-h-8 items-center gap-1 px-2 text-sm font-semibold text-[#0f6cbd] hover:bg-[#eff6fc]">Open workspace<ChevronRight className="h-4 w-4" /></Link></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showModal ? <NewEventModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); void refreshRegistry(); }} /> : null}
    </div>
  );
}
