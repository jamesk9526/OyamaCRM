// Unified Events shell. Trivia is an event mode, never a second application shell.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  Gamepad2,
  Globe2,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  TableProperties,
  TicketCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveLegacyGlobalEventsRedirect } from "@/app/lib/events-route-boundaries";

interface EventSummary { id: string; name?: string; type?: string; status?: string; startDate?: string; location?: string; }
interface EventNavItem { label: string; segment: string; icon: React.ComponentType<{ className?: string }>; }
interface EventNavGroup { label: string; items: EventNavItem[]; }

const GLOBAL_SEGMENTS = new Set(["events", "reports", "templates", "page-builder", "workspace", "setup"]);
const RIGHT_RAIL_KEY = "oyama.events.right-rail.collapsed.v1";

function activeEventId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "events" && parts[1] && !GLOBAL_SEGMENTS.has(parts[1]) ? parts[1] : null;
}

function eventDate(value?: string): string {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initials(name?: string | null): string {
  const value = String(name ?? "").trim();
  return value ? value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "OY";
}

function statusLabel(value?: string): string { return value ? value.replaceAll("_", " ") : "setup"; }

/** One event-scoped frame with a single, collapsible right-hand navigator. */
export default function EventsStudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = useMemo(() => activeEventId(pathname), [pathname]);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);
  const isProjector = /\/trivia\/projector(?:\/|$)/.test(pathname);
  const isTriviaWorkspace = /\/events\/[^/]+\/trivia(?:\/|$)/.test(pathname);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => { if (!loading && user && redirectTarget) router.replace(redirectTarget); }, [loading, user, redirectTarget, router]);
  useEffect(() => {
    try { setRailCollapsed(window.localStorage.getItem(RIGHT_RAIL_KEY) === "1"); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(RIGHT_RAIL_KEY, railCollapsed ? "1" : "0"); } catch { /* Storage is optional. */ }
  }, [railCollapsed]);
  useEffect(() => {
    let current = true;
    void apiFetch<EventSummary[]>("/api/events").then((items) => { if (current) setEvents(Array.isArray(items) ? items : []); }).catch(() => { if (current) setEvents([]); });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    setMobileRailOpen(false);
    if (!eventId) { setEvent(null); return; }
    let current = true;
    void apiFetch<EventSummary>(`/api/events/${eventId}`).then((item) => { if (current) setEvent(item); }).catch(() => { if (current) setEvent({ id: eventId }); });
    return () => { current = false; };
  }, [eventId]);

  const navGroups: EventNavGroup[] = eventId ? [
    { label: "Plan", items: [
      { label: "Overview", segment: "overview", icon: LayoutDashboard },
      { label: "Registration", segment: "registration", icon: TicketCheck },
      { label: "Event page", segment: "event-page", icon: Globe2 },
    ] },
    { label: "People & tables", items: [
      { label: "Guests", segment: "guests", icon: Users },
      { label: "Tables", segment: "tables", icon: TableProperties },
      { label: "Payments", segment: "payments", icon: CircleDollarSign },
    ] },
    { label: "Run & communicate", items: [
      ...(event?.type === "TRIVIA" ? [{ label: "Trivia night", segment: "trivia", icon: Gamepad2 }] : []),
      { label: "Communications", segment: "communications", icon: MessageSquareText },
      { label: "Event day", segment: "day", icon: ClipboardCheck },
    ] },
    { label: "Manage", items: [{ label: "Event settings", segment: "settings", icon: Settings2 }] },
  ] : [];
  const allNavItems = navGroups.flatMap((group) => group.items);
  const currentItem = allNavItems.find((item) => pathname === `/events/${eventId}/${item.segment}` || pathname.startsWith(`/events/${eventId}/${item.segment}/`));

  if (loading || !user) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" aria-label="Loading Events" /></div>;
  if (isProjector) return <ErrorBoundary>{children}</ErrorBoundary>;

  function toggleRail() { setRailCollapsed((value) => !value); }
  function renderRail(collapsed: boolean) {
    return <>
      <div className={`border-b border-slate-200 ${collapsed ? "p-2" : "p-4"}`}>
        {collapsed ? <div className="grid place-items-center"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><CalendarDays className="h-4 w-4" /></span></div> : <div><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Current event</p><h2 className="mt-1 truncate text-base font-bold text-slate-950">{event?.name ?? "Event"}</h2></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold capitalize text-indigo-700">{statusLabel(event?.status)}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{eventDate(event?.startDate)}{event?.location ? <><br />{event.location}</> : null}</p></div>}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Event workspace navigation">
        {navGroups.map((group) => <section key={group.label} className="mb-4 last:mb-0">{!collapsed ? <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.label}</p> : null}<div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const href = `/events/${eventId}/${item.segment}`; const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={item.segment} href={href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} onClick={() => setMobileRailOpen(false)} className={`event-studio-right-nav-item ${active ? "is-active" : ""} ${collapsed ? "is-collapsed" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}</Link>; })}</div></section>)}
      </nav>
      <div className="border-t border-slate-200 p-2">
        <button type="button" onClick={toggleRail} className="event-studio-right-nav-item hidden w-full lg:flex" aria-label={collapsed ? "Expand event navigation" : "Collapse event navigation"}>{collapsed ? <PanelRightOpen className="h-[18px] w-[18px]" /> : <PanelRightClose className="h-[18px] w-[18px]" />}{!collapsed ? <span>Collapse navigation</span> : null}</button>
      </div>
    </>;
  }

  return (
    <div className="event-studio-shell min-h-dvh bg-[#f6f7fb] text-slate-900">
      <header className="event-studio-header sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-3 sm:px-5">
          <Link href="/events" className="flex shrink-0 items-center gap-2 font-semibold" aria-label="Events home"><span className="event-studio-product-mark grid h-9 w-9 place-items-center text-white"><CalendarDays className="h-[18px] w-[18px]" /></span><span className="hidden sm:block"><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">Oyama</span><span className="block text-sm leading-4 text-white">Event Operations</span></span></Link>
          <span className="h-5 w-px bg-slate-200" />
          <select value={eventId ?? ""} onChange={(input) => router.push(input.target.value ? `/events/${input.target.value}/overview` : "/events")} aria-label="Switch event" className="h-10 min-w-0 max-w-[48vw] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 sm:min-w-64">
            <option value="">All events</option>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{eventId && !events.some((item) => item.id === eventId) ? <option value={eventId}>{event?.name ?? "Current event"}</option> : null}
          </select>
          {eventId ? <div className="hidden min-w-0 lg:block"><p className="truncate text-sm font-bold">{currentItem?.label ?? "Event workspace"}</p><p className="truncate text-[11px] text-slate-500">{event?.name ?? "Event"}</p></div> : null}
          <div className="ml-auto flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white" title={user.email}>{initials(`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email)}</div>
            {eventId ? <button type="button" onClick={() => setMobileRailOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-300 bg-white lg:hidden" aria-label="Open event navigation"><Menu className="h-5 w-5" /></button> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1800px] items-start">
        <main className={`min-h-[calc(100dvh-4rem)] min-w-0 flex-1 ${isTriviaWorkspace ? "event-trivia-admin-content" : ""}`}><ErrorBoundary>{redirectTarget ? <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">Opening the selected event…</div> : children}</ErrorBoundary></main>
        {eventId ? <aside className={`event-studio-right-rail sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-l lg:flex ${railCollapsed ? "w-[68px]" : "w-[260px]"}`}>{renderRail(railCollapsed)}</aside> : null}
      </div>

      {eventId && mobileRailOpen ? <><button type="button" className="fixed inset-0 z-50 bg-slate-950/55 lg:hidden" onClick={() => setMobileRailOpen(false)} aria-label="Close event navigation" /><aside className="event-studio-mobile-rail fixed inset-y-0 right-0 z-[60] flex w-[min(88vw,320px)] flex-col border-l shadow-2xl lg:hidden"><div className="flex h-14 items-center justify-between border-b px-4"><div className="flex items-center gap-2"><ChevronLeft className="h-4 w-4 text-amber-400" /><span className="text-sm font-bold">Event navigation</span></div><button type="button" onClick={() => setMobileRailOpen(false)} className="grid h-9 w-9 place-items-center hover:bg-white/10" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>{renderRail(false)}</aside></> : null}
    </div>
  );
}
