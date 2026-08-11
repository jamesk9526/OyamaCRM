// EventsStudioShell provides the canonical Fluent-style event-first workspace.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  TableProperties,
  Ticket,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveLegacyGlobalEventsRedirect } from "@/app/lib/events-route-boundaries";
import { EVENT_JOURNEY_STAGES, EVENT_WORKSPACE_TOOLS, STAGE_META } from "@/app/components/events/events-workspace-config";

interface EventSummary {
  id: string;
  name?: string;
  status?: string;
  startDate?: string;
  location?: string;
  type?: string;
}

const STATIC_EVENT_SEGMENTS = new Set([
  "workspace", "reports", "page-builder", "templates", "events", "setup", "settings", "guests", "tables",
  "hosts", "sponsors", "check-in", "emails", "communications", "donations", "fundraising", "follow-up",
  "orders", "tickets", "tasks", "volunteers", "files",
]);

function getActiveEventId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "events" || !parts[1] || STATIC_EVENT_SEGMENTS.has(parts[1])) return null;
  return parts[1];
}

function initials(name?: string | null, fallback = "SM"): string {
  const source = String(name ?? "").trim();
  if (!source) return fallback;
  return source.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function routeLabel(pathname: string): string {
  if (pathname.endsWith("/event-page") || pathname.includes("/page-builder")) return "Event Page";
  const labels: Record<string, string> = {
    guests: "Guests", tables: "Tables", hosts: "Table Hosts", sponsors: "Sponsors", donations: "Donations",
    fundraising: "Fundraising", "check-in": "Check-in", emails: "Email", communications: "Outreach",
    reports: "Reports", "follow-up": "Follow-up", settings: "Settings", events: "All events", tickets: "Registration",
  };
  return labels[pathname.split("/").filter(Boolean).at(-1) ?? ""] ?? "Overview";
}

function formatEventDate(value?: string): string {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  registration: Ticket,
  "event-page": Globe2,
  guests: Users,
  tables: TableProperties,
  hosts: UserRoundCheck,
  sponsors: Sparkles,
  donations: CircleDollarSign,
  emails: Mail,
  "check-in": CheckCircle2,
  reports: BarChart3,
  "follow-up": UserRoundCheck,
  settings: Settings,
};

/** One responsive navigation surface shared by desktop and mobile. */
function EventNavigation({
  activeEventId,
  pathname,
  collapsed,
  onNavigate,
}: {
  activeEventId: string | null;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const globalItems = [
    { label: "All events", href: "/events/events", icon: CalendarDays },
    { label: "Templates", href: "/events/templates", icon: FileText },
    { label: "Cross-event reports", href: "/events/reports", icon: BarChart3 },
  ];

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Event workflow">
      {!activeEventId ? (
        <div className="space-y-1">
          {!collapsed ? <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#616161]">Event workspace</p> : null}
          {globalItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined} className={`event-studio-nav-item ${active ? "is-active" : ""}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {EVENT_JOURNEY_STAGES.map((stage) => (
            <section key={stage}>
              {!collapsed ? <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#616161]">{STAGE_META[stage].label}</p> : null}
              <div className="space-y-0.5">
                {EVENT_WORKSPACE_TOOLS.filter((tool) => tool.stage === stage).map((tool) => {
                  const href = `/events/${activeEventId}/${tool.routeSegment ?? "overview"}`;
                  const active = pathname === href || (tool.id === "overview" && pathname === `/events/${activeEventId}`);
                  const Icon = TOOL_ICONS[tool.id] ?? LayoutDashboard;
                  return (
                    <Link key={tool.id} href={href} onClick={onNavigate} title={collapsed ? tool.label : undefined} className={`event-studio-nav-item ${active ? "is-active" : ""}`}>
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed ? <span className="min-w-0 truncate">{tool.label}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </nav>
  );
}

/** Fluent-style EventSTUDIO frame with an event-first navigation model. */
export default function EventsStudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeEventId = useMemo(() => getActiveEventId(pathname), [pathname]);
  const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);
  const activeToolLabel = routeLabel(pathname);
  const isEventPageRoute = pathname.endsWith("/event-page") || pathname.includes("/page-builder");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => { if (!loading && user && redirectTarget) router.replace(redirectTarget); }, [loading, user, redirectTarget, router]);
  useEffect(() => { setWorkspaceMenuOpen(false); setMobileNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (!activeEventId) { setActiveEvent(null); return; }
    const eventId = activeEventId;
    let active = true;
    void apiFetch<EventSummary>(`/api/events/${eventId}`)
      .then((event) => { if (active) setActiveEvent(event); })
      .catch(() => { if (active) setActiveEvent({ id: eventId }); });
    return () => { active = false; };
  }, [activeEventId]);

  useEffect(() => {
    let active = true;
    void apiFetch<EventSummary[]>("/api/events")
      .then((result) => { if (active) setEvents(Array.isArray(result) ? result : []); })
      .catch(() => { if (active) setEvents([]); });
    return () => { active = false; };
  }, []);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center bg-[#f5f5f5]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f6cbd] border-t-transparent" aria-label="Loading EventSTUDIO" /></div>;
  }

  const eventName = activeEvent?.name ?? "Select event";
  const activeSegment = pathname.split("/").filter(Boolean).at(-1) ?? "overview";
  function switchEvent(eventId: string) {
    if (!eventId) { router.push("/events/events"); return; }
    const segment = EVENT_WORKSPACE_TOOLS.some((tool) => tool.routeSegment === activeSegment) ? activeSegment : "overview";
    router.push(`/events/${eventId}/${segment}`);
  }

  return (
    <div className="event-studio-shell flex h-dvh min-h-0 overflow-hidden bg-[#f5f5f5] text-[#242424]">
      {mobileNavOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMobileNavOpen(false)} /> : null}

      <aside className={`${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-[#e1dfdd] bg-[#fafafa] shadow-xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${navCollapsed ? "lg:w-14" : "lg:w-[232px]"}`}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#e1dfdd] px-3">
          <Link href="/events/events" className="flex min-w-0 flex-1 items-center gap-2" aria-label="EventSTUDIO home">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[#0f6cbd] text-sm font-bold text-white">E</span>
            {!navCollapsed ? <span className="min-w-0"><strong className="block truncate text-sm font-semibold">EventSTUDIO</strong><span className="block truncate text-[10px] text-[#616161]">Plan, invite, run, follow up</span></span> : null}
          </Link>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-sm text-[#424242] hover:bg-[#edebe9] lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>

        <EventNavigation activeEventId={activeEventId} pathname={pathname} collapsed={navCollapsed} onNavigate={() => setMobileNavOpen(false)} />

        <div className="shrink-0 border-t border-[#e1dfdd] p-2">
          <Link href="/" title={navCollapsed ? "Donor CRM" : undefined} className="event-studio-nav-item"><span className="grid h-[18px] w-[18px] place-items-center text-sm" aria-hidden="true">←</span>{!navCollapsed ? <span>Donor CRM</span> : null}</Link>
          <div className="hidden lg:block"><button type="button" className="event-studio-nav-item mt-0.5 w-full" onClick={() => setNavCollapsed((value) => !value)} aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}>
            {navCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!navCollapsed ? <span>Collapse navigation</span> : null}
          </button></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d1d1d1] bg-white px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-sm hover:bg-[#f3f2f1] lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open event navigation"><Menu className="h-5 w-5" /></button>
            <div className="relative hidden sm:block">
              <button type="button" onClick={() => setWorkspaceMenuOpen((open) => !open)} className="flex h-9 items-center gap-2 rounded-sm px-2 text-sm font-semibold hover:bg-[#f3f2f1]" aria-expanded={workspaceMenuOpen}>
                EventSTUDIO <ChevronDown className="h-4 w-4 text-[#616161]" />
              </button>
              {workspaceMenuOpen ? (
                <div className="absolute left-0 top-11 z-50 w-60 border border-[#d1d1d1] bg-white p-1 shadow-lg">
                  {[
                    { label: "Donor CRM", href: "/" }, { label: "EventSTUDIO", href: "/events/events" },
                    { label: "Steward AI", href: "/steward-ai-workspace" }, { label: "Webmaster", href: "/webmaster" }, { label: "Watchdog", href: "/watchdog" },
                  ].map((workspace) => <Link key={workspace.href} href={workspace.href} className={`flex min-h-9 items-center justify-between px-3 text-sm hover:bg-[#f3f2f1] ${workspace.label === "EventSTUDIO" ? "bg-[#eff6fc] text-[#0f6cbd]" : ""}`}><span>{workspace.label}</span>{workspace.label === "EventSTUDIO" ? <span className="text-xs">Current</span> : null}</Link>)}
                </div>
              ) : null}
            </div>
            <span className="hidden h-5 w-px bg-[#d1d1d1] sm:block" />
            <div className="min-w-0">
              <select aria-label="Switch event" value={activeEventId ?? ""} onChange={(event) => switchEvent(event.target.value)} className="h-9 min-w-0 max-w-[46vw] border border-[#8a8886] bg-white px-2 text-sm outline-none hover:border-[#323130] focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd] sm:max-w-72 sm:min-w-56">
                <option value="">All events</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                {activeEventId && !events.some((event) => event.id === activeEventId) ? <option value={activeEventId}>{eventName}</option> : null}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {activeEventId ? <Link href={`/events/${activeEventId}/check-in`} className="event-studio-primary-button hidden sm:inline-flex"><CheckCircle2 className="h-4 w-4" />Open check-in</Link> : <Link href="/events/events" className="event-studio-primary-button">New event</Link>}
            <Link href="/settings/ai" className="grid h-9 w-9 place-items-center rounded-sm hover:bg-[#f3f2f1]" aria-label="Help and settings"><HelpCircle className="h-5 w-5" /></Link>
            <div className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[#0f6cbd] text-xs font-semibold text-white" title={user.email}>{initials(`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email)}</div>
          </div>
        </header>

        <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[#e1dfdd] bg-[#fafafa] px-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm"><span className="truncate font-semibold">{activeEventId ? eventName : "Events"}</span><span className="text-[#8a8886]">/</span><span className="truncate text-[#616161]">{activeToolLabel}</span></div>
            {activeEventId ? <p className="hidden truncate text-[11px] text-[#616161] sm:block">{formatEventDate(activeEvent?.startDate)}{activeEvent?.location ? ` · ${activeEvent.location}` : ""}</p> : null}
          </div>
          {activeEventId ? <div className="flex shrink-0 items-center gap-2"><span className="hidden items-center gap-1 text-xs text-[#616161] md:inline-flex"><span className="h-2 w-2 rounded-full bg-[#107c10]" />{activeEvent?.status?.replace(/_/g, " ") || "Event selected"}</span><Link href={`/events/${activeEventId}/event-page`} className="event-studio-secondary-button hidden md:inline-flex"><Globe2 className="h-4 w-4" />Event page</Link></div> : null}
        </div>

        <main className={`min-h-0 flex-1 bg-[#f5f5f5] ${isEventPageRoute ? "overflow-hidden" : "overflow-auto"}`}>
          <ErrorBoundary>
            {redirectTarget ? <section className="m-4 border border-[#96c6eb] bg-[#eff6fc] px-4 py-3 text-sm text-[#0f548c]">Opening the selected event workspace…</section> : children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
