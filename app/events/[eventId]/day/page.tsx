"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Gamepad2, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventDayData { id: string; name: string; type: string; startDate: string; location?: string; _count?: { guests?: number; tables?: number; orders?: number }; }

export default function EventDayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDayData | null>(null);
  const [error, setError] = useState("");
  function loadEvent() { setError(""); void apiFetch<EventDayData>(`/api/events/${eventId}`).then(setEvent).catch((reason) => setError(reason instanceof Error ? reason.message : "Event-day tools could not be loaded.")); }
  useEffect(() => { loadEvent(); }, [eventId]);
  if (error && !event) return <div className="mx-auto max-w-3xl p-5 sm:p-8"><section className="event-industrial-panel p-6"><TriangleAlert className="h-6 w-6 text-amber-700" /><h1 className="mt-3 text-xl font-semibold">Event day unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button type="button" onClick={loadEvent} className="event-industrial-secondary mt-5"><RefreshCw className="h-4 w-4" />Try again</button></section></div>;
  return <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8"><header className="event-industrial-page-header"><div><p className="event-industrial-kicker">Live operations / Event day</p><h1>{event ? "Run the room" : "Preparing event day…"}</h1><p>A focused launch point for staff and volunteers running {event?.name ?? "this event"}.</p></div>{event ? <span className="event-industrial-state is-warning">Live workspace</span> : null}</header>
    <section className="grid gap-5 border-y border-slate-200 py-7 sm:grid-cols-3"><div><p className="text-3xl font-semibold">{event?._count?.guests ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Expected guests</p></div><div><p className="text-3xl font-semibold">{event?._count?.tables ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Tables</p></div><div><p className="text-3xl font-semibold">{event?._count?.orders ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Orders to monitor</p></div></section>
    <section className="grid gap-4 md:grid-cols-2"><article className="event-industrial-panel p-5"><CheckCircle2 className="h-6 w-6 text-amber-700" /><h3 className="mt-4 text-lg font-semibold">Check in guests</h3><p className="mt-1 text-sm text-slate-500">Search, scan, handle walk-ins, and resolve arrival issues.</p><Link href={`/events/${eventId}/check-in`} className="event-industrial-primary mt-5">Start check-in</Link></article>{event?.type === "TRIVIA" ? <article className="event-industrial-panel p-5"><Gamepad2 className="h-6 w-6 text-amber-700" /><h3 className="mt-4 text-lg font-semibold">Trivia night</h3><p className="mt-1 text-sm text-slate-500">Open the host console after tables and teams are ready.</p><Link href={`/events/${eventId}/trivia/host`} className="event-industrial-primary mt-5">Open host console</Link></article> : <article className="event-industrial-panel p-5"><Users className="h-6 w-6 text-amber-700" /><h3 className="mt-4 text-lg font-semibold">Tables and arrivals</h3><p className="mt-1 text-sm text-slate-500">Review seating and table readiness before doors open.</p><Link href={`/events/${eventId}/tables`} className="event-industrial-secondary mt-5">Review tables</Link></article>}</section>
  </div>;
}
