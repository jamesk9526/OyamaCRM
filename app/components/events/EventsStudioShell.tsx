// Unified Events shell. Trivia is an event mode, never a second application shell.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ExternalLink, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveLegacyGlobalEventsRedirect } from "@/app/lib/events-route-boundaries";

interface EventSummary { id: string; name?: string; type?: string; status?: string; startDate?: string; location?: string; }
const GLOBAL_SEGMENTS = new Set(["events", "reports", "templates", "page-builder", "workspace", "setup"]);

function activeEventId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "events" && parts[1] && !GLOBAL_SEGMENTS.has(parts[1]) ? parts[1] : null;
}

function eventDate(value?: string): string {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return date.toLocaleString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initials(name?: string | null): string {
  const value = String(name ?? "").trim();
  return value ? value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "OY";
}

/** One quiet event frame shared by planning, registration, operations, and trivia. */
export default function EventsStudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);
  const eventId = useMemo(() => activeEventId(pathname), [pathname]);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);
  const isProjector = /\/trivia\/projector(?:\/|$)/.test(pathname);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => { if (!loading && user && redirectTarget) router.replace(redirectTarget); }, [loading, user, redirectTarget, router]);
  useEffect(() => {
    let current = true;
    void apiFetch<EventSummary[]>("/api/events").then((items) => { if (current) setEvents(Array.isArray(items) ? items : []); }).catch(() => { if (current) setEvents([]); });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    if (!eventId) { setEvent(null); return; }
    let current = true;
    void apiFetch<EventSummary>(`/api/events/${eventId}`).then((item) => { if (current) setEvent(item); }).catch(() => { if (current) setEvent({ id: eventId }); });
    return () => { current = false; };
  }, [eventId]);
  useEffect(() => {
    function close(click: MouseEvent) { if (menuRef.current && !menuRef.current.contains(click.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (loading || !user) return <div className="grid min-h-screen place-items-center bg-stone-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-label="Loading Events" /></div>;
  if (isProjector) return <ErrorBoundary>{children}</ErrorBoundary>;

  const tabs = eventId ? [
    ["Overview", "overview"], ["Registration", "registration"], ["Guests", "guests"], ["Tables", "tables"], ["Payments", "payments"],
    ...(event?.type === "TRIVIA" ? [["Trivia", "trivia"]] : []),
    ["Communications", "communications"], ["Event Day", "day"],
  ] as const : [];

  return (
    <div className="event-studio-shell min-h-dvh bg-[#f6f7fb] text-slate-900">
      <header className="event-studio-header sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link href="/events" className="flex shrink-0 items-center gap-2 font-semibold" aria-label="Events home"><span className="event-studio-product-mark grid h-9 w-9 place-items-center rounded-xl text-white"><CalendarDays className="h-[18px] w-[18px]" /></span><span className="hidden sm:inline">Event Studio</span></Link>
          <span className="h-5 w-px bg-slate-200" />
          <select value={eventId ?? ""} onChange={(input) => router.push(input.target.value ? `/events/${input.target.value}/overview` : "/events")} aria-label="Switch event" className="h-9 min-w-0 max-w-[55vw] rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:min-w-64">
            <option value="">All events</option>
            {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            {eventId && !events.some((item) => item.id === eventId) ? <option value={eventId}>{event?.name ?? "Current event"}</option> : null}
          </select>
          <div className="ml-auto flex items-center gap-2">
            {eventId ? <Link href={`/events/${eventId}/event-page`} className="hidden min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 sm:inline-flex">Preview event <ExternalLink className="h-3.5 w-3.5" /></Link> : null}
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white" title={user.email}>{initials(`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email)}</div>
          </div>
        </div>
        {eventId ? <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
          <div className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0"><Link href="/events" className="text-xs font-semibold text-blue-700 hover:underline">← Events</Link><h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{event?.name ?? "Event"}</h1><p className="mt-1 truncate text-sm text-slate-500">{eventDate(event?.startDate)}{event?.location ? ` · ${event.location}` : ""}</p></div>
            <div className="relative shrink-0" ref={menuRef}><button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 hover:bg-slate-50" aria-label="Event actions" aria-expanded={menuOpen}><MoreHorizontal className="h-5 w-5" /></button>{menuOpen ? <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><Link href={`/events/${eventId}/event-page`} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">Preview event</Link><Link href={`/events/${eventId}/settings`} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">Event settings</Link></div> : null}</div>
          </div>
          <nav className="event-studio-tabs -mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Event workspace">{tabs.map(([label, segment]) => { const href = `/events/${eventId}/${segment}`; const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={segment} href={href} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${active ? "is-active border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"}`}>{label}</Link>; })}</nav>
        </div> : null}
      </header>
      <main className="min-h-[calc(100dvh-3.5rem)]"><ErrorBoundary>{redirectTarget ? <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Opening the selected event…</div> : children}</ErrorBoundary></main>
    </div>
  );
}
