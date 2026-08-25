"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventDetail { id: string; name: string; type: string; status: string; startDate: string; location?: string | null; capacity?: number | null; registrationGoal?: number | null; ticketTypes?: Array<{ id: string }>; _count?: { guests?: number; tables?: number; orders?: number }; }
interface Guest { id: string; checkedIn: boolean; table?: { id: string } | null; }
interface Order { id: string; status: string; totalAmount: number | string; }
interface Table { id: string; capacity: number; _count?: { guests: number }; }
interface PageStatus { status: "Draft" | "Published" | "Unpublished"; pageUrl?: string; }
interface TriviaEventSummary { id: string; linkedEventsEventId?: string; rounds?: Array<{ questions?: Array<{ prompt?: string; scoringAnswer?: string }> }>; teams?: unknown[]; }
interface TriviaState { state?: { events?: TriviaEventSummary[] }; }

function money(value: number): string { return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }

export default function EventOverviewPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [page, setPage] = useState<PageStatus | null>(null);
  const [trivia, setTrivia] = useState<TriviaEventSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    void Promise.all([
      apiFetch<EventDetail>(`/api/events/${eventId}`), apiFetch<Guest[]>(`/api/events/${eventId}/guests`), apiFetch<Order[]>(`/api/events/${eventId}/orders`), apiFetch<Table[]>(`/api/events/${eventId}/tables`), apiFetch<PageStatus>(`/api/events/${eventId}/page-builder-config`).catch(() => null), apiFetch<TriviaState>("/api/apps/trivia/state").catch(() => null),
    ]).then(([eventData, guestData, orderData, tableData, pageData, triviaData]) => { if (!current) return; setEvent(eventData); setGuests(guestData); setOrders(orderData); setTables(tableData); setPage(pageData); const match = triviaData?.state?.events?.find((item) => item.id === eventId || item.linkedEventsEventId === eventId); setTrivia(match ?? null); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [eventId]);

  const collected = orders.filter((order) => ["CONFIRMED", "COMPLETED", "PAID"].includes(order.status)).reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const assigned = guests.filter((guest) => guest.table).length;
  const capacity = event?.capacity ?? event?.registrationGoal ?? tables.reduce((sum, table) => sum + table.capacity, 0);
  const questions = trivia?.rounds?.reduce((sum, round) => sum + (round.questions?.length ?? 0), 0) ?? 0;
  const incompleteQuestions = trivia?.rounds?.reduce((sum, round) => sum + (round.questions?.filter((question) => !question.prompt?.trim() || !question.scoringAnswer?.trim()).length ?? 0), 0) ?? 0;
  const readiness = useMemo(() => event ? [
    { label: "Event page published", ready: page?.status === "Published", href: `/events/${eventId}/event-page` },
    { label: "Registration options configured", ready: Boolean(event.ticketTypes?.length), href: `/events/${eventId}/registration` },
    { label: guests.length && assigned < guests.length ? `${guests.length - assigned} guests need table assignments` : "Guests assigned to tables", ready: guests.length === 0 || assigned === guests.length, href: `/events/${eventId}/tables` },
    ...(event.type === "TRIVIA" ? [{ label: questions ? (incompleteQuestions ? `${incompleteQuestions} trivia questions are incomplete` : `${questions} trivia questions ready`) : "Trivia game needs questions", ready: questions > 0 && incompleteQuestions === 0, href: `/events/${eventId}/trivia` }] : []),
  ] : [], [assigned, event, eventId, guests.length, incompleteQuestions, page?.status, questions]);
  const next = readiness.find((item) => !item.ready) ?? readiness[0];

  if (loading || !event) return <div className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div>;

  return <div className="mx-auto max-w-5xl space-y-9 p-4 sm:p-6 lg:p-8">
    <section><h2 className="text-2xl font-semibold tracking-tight">Overview</h2><p className="mt-2 text-sm text-slate-500">Registration, revenue, and the next steps to get this event ready.</p></section>
    <section className="grid gap-6 border-y border-slate-200 py-7 sm:grid-cols-3"><div><p className="text-3xl font-semibold">{guests.length.toLocaleString()}</p><p className="mt-1 text-sm text-slate-500">Registered</p></div><div><p className="text-3xl font-semibold">{tables.length.toLocaleString()}</p><p className="mt-1 text-sm text-slate-500">Tables</p></div><div><p className="text-3xl font-semibold">{money(collected)}</p><p className="mt-1 text-sm text-slate-500">Collected</p></div></section>
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"><div><div className="flex items-end justify-between gap-3"><div><h3 className="font-semibold">Registration</h3><p className="mt-1 text-sm text-slate-500">{guests.length.toLocaleString()} of {capacity || "—"} expected</p></div><Link href={`/events/${eventId}/registration`} className="text-sm font-semibold text-blue-700 hover:underline">Manage</Link></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${capacity ? Math.min(100, Math.round(guests.length / capacity * 100)) : 0}%` }} /></div>
      <div className="mt-9 flex items-center justify-between gap-3"><h3 className="font-semibold">Event readiness</h3><span className="text-sm text-slate-500">{readiness.filter((item) => item.ready).length}/{readiness.length} ready</span></div><ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">{readiness.map((item) => <li key={item.label}><Link href={item.href} className="flex min-h-12 items-center gap-3 py-2 text-sm hover:text-blue-700">{item.ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />}<span>{item.label}</span></Link></li>)}</ul></div>
      <aside className="h-fit rounded-2xl bg-white p-5 ring-1 ring-slate-200"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">What should I do next?</p>{next ? <><h3 className="mt-3 text-lg font-semibold">{next.label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">Continue the most important unfinished setup task. You can return here at any time to see current readiness.</p><Link href={next.href} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Continue setup</Link></> : <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><Circle className="h-4 w-4 fill-current" />Event setup is ready</div>}</aside>
    </section>
  </div>;
}
