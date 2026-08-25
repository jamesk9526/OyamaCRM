"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Gamepad2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import NewEventModal from "@/app/components/events/NewEventModal";
import type { EventItem } from "@/app/components/events/types";

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not set" : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function EventRow({ event }: { event: EventItem }) {
  const registrations = event._count?.guests ?? event._count?.attendances ?? 0;
  const collected = Number(event.collectedRevenue ?? 0);
  return <article className="group grid gap-4 border-b border-slate-200 px-4 py-5 last:border-b-0 hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
    <div className="flex min-w-0 gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${event.type === "TRIVIA" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>{event.type === "TRIVIA" ? <Gamepad2 className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{event.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600">{event.type === "TRIVIA" ? "TRIVIA NIGHT" : "STANDARD EVENT"}</span></div><p className="mt-1 text-sm text-slate-500">{dateLabel(event.startDate)}{event.location ? ` · ${event.location}` : ""}</p><p className="mt-1 text-sm text-slate-600">{registrations.toLocaleString()} registered{collected > 0 ? ` · ${collected.toLocaleString("en-US", { style: "currency", currency: "USD" })} collected` : ""}</p></div></div>
    <Link href={`/events/${event.id}/overview`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:border-blue-500 hover:text-blue-700">Open <ChevronRight className="h-4 w-4" /></Link>
  </article>;
}

export default function EventsRegistryPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  useEffect(() => { let current = true; void apiFetch<EventItem[]>("/api/events").then((items) => { if (current) setEvents(Array.isArray(items) ? items : []); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, []);
  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return events.filter((event) => !needle || [event.name, event.location, event.type].some((value) => String(value ?? "").toLowerCase().includes(needle))); }, [events, query]);
  const upcoming = filtered.filter((event) => event.active && new Date(event.startDate).getTime() >= Date.now()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const past = filtered.filter((event) => !event.active || new Date(event.startDate).getTime() < Date.now()).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Events</h1><p className="mt-2 text-sm text-slate-500">Find an event, create one, or continue where you left off.</p></div><button type="button" onClick={() => setShowModal(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />New event</button></header>
    <label className="relative mt-7 block"><span className="sr-only">Search events</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input value={query} onChange={(input) => setQuery(input.target.value)} placeholder="Search events" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
    {loading ? <div className="mt-8 space-y-3"><div className="h-28 animate-pulse rounded-xl bg-slate-200" /><div className="h-28 animate-pulse rounded-xl bg-slate-200" /></div> : filtered.length === 0 ? <section className="mt-8 grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><CalendarDays className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-3 text-lg font-semibold">{events.length ? "No matching events" : "Create your first event"}</h2><p className="mt-1 text-sm text-slate-500">{events.length ? "Try a different search." : "Start with a standard event or trivia night."}</p>{!events.length ? <button type="button" onClick={() => setShowModal(true)} className="mt-4 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Create event</button> : null}</div></section> : <div className="mt-9 space-y-10">
      {upcoming.length ? <section><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Upcoming</h2><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{upcoming.map((event) => <EventRow key={event.id} event={event} />)}</div></section> : null}
      {past.length ? <section><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Past events</h2><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{past.map((event) => <EventRow key={event.id} event={event} />)}</div></section> : null}
    </div>}
    {showModal ? <NewEventModal onClose={() => setShowModal(false)} onCreated={(event) => { setShowModal(false); router.push(`/events/${event.id}/overview`); }} /> : null}
  </div>;
}
