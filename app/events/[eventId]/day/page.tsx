"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Gamepad2, Users } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventDayData { id: string; name: string; type: string; startDate: string; location?: string; _count?: { guests?: number; tables?: number; orders?: number }; }

export default function EventDayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDayData | null>(null);
  useEffect(() => { void apiFetch<EventDayData>(`/api/events/${eventId}`).then(setEvent); }, [eventId]);
  return <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8"><header><p className="text-sm font-semibold text-blue-700">Event day</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Good evening</h2><p className="mt-2 text-sm text-slate-500">A focused launch point for staff and volunteers running {event?.name ?? "this event"}.</p></header>
    <section className="grid gap-5 border-y border-slate-200 py-7 sm:grid-cols-3"><div><p className="text-3xl font-semibold">{event?._count?.guests ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Expected guests</p></div><div><p className="text-3xl font-semibold">{event?._count?.tables ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Tables</p></div><div><p className="text-3xl font-semibold">{event?._count?.orders ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Orders to monitor</p></div></section>
    <section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5"><CheckCircle2 className="h-6 w-6 text-blue-700" /><h3 className="mt-4 text-lg font-semibold">Check in guests</h3><p className="mt-1 text-sm text-slate-500">Search, scan, handle walk-ins, and resolve arrival issues.</p><Link href={`/events/${eventId}/check-in`} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Start check-in</Link></article>{event?.type === "TRIVIA" ? <article className="rounded-2xl border border-slate-200 bg-white p-5"><Gamepad2 className="h-6 w-6 text-violet-700" /><h3 className="mt-4 text-lg font-semibold">Trivia night</h3><p className="mt-1 text-sm text-slate-500">Open the host console after tables and teams are ready.</p><Link href={`/events/${eventId}/trivia/host`} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Open host console</Link></article> : <article className="rounded-2xl border border-slate-200 bg-white p-5"><Users className="h-6 w-6 text-blue-700" /><h3 className="mt-4 text-lg font-semibold">Tables and arrivals</h3><p className="mt-1 text-sm text-slate-500">Review seating and table readiness before doors open.</p><Link href={`/events/${eventId}/tables`} className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold">Review tables</Link></article>}</section>
  </div>;
}
