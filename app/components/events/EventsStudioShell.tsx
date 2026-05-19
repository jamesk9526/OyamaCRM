// EventsStudioShell gives EventSTUDIO its own dark studio frame, separate from the standard CRM shell.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveLegacyGlobalEventsRedirect } from "@/app/lib/events-route-boundaries";

interface EventSummary {
  id: string;
  name?: string;
  status?: string;
  startDate?: string;
  location?: string;
}

const STATIC_EVENT_SEGMENTS = new Set([
  "workspace",
  "reports",
  "page-builder",
  "templates",
  "events",
  "setup",
  "settings",
  "guests",
  "tables",
  "hosts",
  "sponsors",
  "check-in",
  "emails",
  "communications",
  "donations",
  "fundraising",
  "follow-up",
  "orders",
  "tickets",
  "tasks",
  "volunteers",
  "files",
]);

function getActiveEventId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "events" || !parts[1] || STATIC_EVENT_SEGMENTS.has(parts[1])) return null;
  return parts[1];
}

function initials(name?: string | null, fallback = "SM"): string {
  const source = String(name ?? "").trim();
  if (!source) return fallback;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function routeLabel(pathname: string): string {
  if (pathname.endsWith("/event-page") || pathname.includes("/page-builder")) return "Event Page Builder";
  if (pathname.endsWith("/guests")) return "Guests";
  if (pathname.endsWith("/tables")) return "Tables";
  if (pathname.endsWith("/hosts")) return "Table Hosts";
  if (pathname.endsWith("/sponsors")) return "Sponsors";
  if (pathname.endsWith("/donations")) return "Donations";
  if (pathname.endsWith("/check-in")) return "Check-In";
  if (pathname.endsWith("/emails")) return "Emails";
  if (pathname.endsWith("/reports")) return "Reports";
  if (pathname.endsWith("/follow-up")) return "Follow-Up";
  if (pathname.endsWith("/settings")) return "Settings";
  if (pathname.endsWith("/events")) return "All Events";
  return "Overview";
}

function formatEventDate(value?: string): string {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EventStudioIcon({ label }: { label: string }) {
  const iconMap: Record<string, string> = {
    Events: "□",
    Overview: "◷",
    Guests: "♙",
    Tables: "▥",
    Hosts: "♧",
    Sponsors: "◇",
    Donations: "$",
    "Check-In": "☑",
    "Event Page": "▣",
    Emails: "✉",
    Reports: "⌁",
    "Follow-Up": "↳",
    Settings: "⚙",
  };

  return <span className="grid h-5 w-5 place-items-center text-[15px] leading-none">{iconMap[label] ?? "•"}</span>;
}

/** Dark EventSTUDIO app frame with an event-first navigation model. */
export default function EventsStudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const activeEventId = useMemo(() => getActiveEventId(pathname), [pathname]);
  const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);
  const activeToolLabel = routeLabel(pathname);
  const isEventPageRoute = pathname.endsWith("/event-page") || pathname.includes("/page-builder");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user || !redirectTarget) return;
    router.replace(redirectTarget);
  }, [loading, user, redirectTarget, router]);

  useEffect(() => {
    setWorkspaceMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!activeEventId) {
      setActiveEvent(null);
      return;
    }

    const eventId = activeEventId;
    let active = true;
    async function loadEvent() {
      try {
        const event = await apiFetch<EventSummary>(`/api/events/${eventId}`);
        if (active) setActiveEvent(event);
      } catch {
        if (active) setActiveEvent({ id: eventId });
      }
    }

    void loadEvent();
    return () => {
      active = false;
    };
  }, [activeEventId]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#080a22] text-white">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  const eventName = activeEvent?.name ?? "Select Event";
  const scopedNav = activeEventId
    ? [
        { label: "Overview", href: `/events/${activeEventId}/overview` },
        { label: "Guests", href: `/events/${activeEventId}/guests` },
        { label: "Tables", href: `/events/${activeEventId}/tables` },
        { label: "Hosts", href: `/events/${activeEventId}/hosts` },
        { label: "Sponsors", href: `/events/${activeEventId}/sponsors` },
        { label: "Donations", href: `/events/${activeEventId}/donations` },
        { label: "Check-In", href: `/events/${activeEventId}/check-in` },
        { label: "Event Page", href: `/events/${activeEventId}/event-page` },
        { label: "Emails", href: `/events/${activeEventId}/emails` },
        { label: "Reports", href: `/events/${activeEventId}/reports` },
        { label: "Follow-Up", href: `/events/${activeEventId}/follow-up` },
        { label: "Settings", href: `/events/${activeEventId}/settings` },
      ]
    : [
        { label: "Events", href: "/events/events" },
      ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fc] text-slate-950">
      <aside className="hidden w-28 shrink-0 flex-col border-r border-white/10 bg-[linear-gradient(180deg,#241062_0%,#120c3b_55%,#0a0d27_100%)] text-white shadow-[12px_0_36px_rgba(17,24,39,0.22)] lg:flex">
        <div className="flex h-16 items-center justify-center border-b border-white/10">
          <Link href="/events/events" className="text-center text-sm font-bold tracking-tight">
            Event<span className="text-violet-300">STUDIO</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {scopedNav.map((item) => {
            const active = pathname === item.href || (item.label === "Overview" && pathname === `/events/${activeEventId}`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition",
                  active ? "bg-violet-500 text-white shadow-lg shadow-violet-950/30" : "text-violet-100/88 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                <EventStudioIcon label={item.label} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-2 py-3">
          <Link href="/events/events" className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-violet-100/90 hover:bg-white/10">
            <span className="text-lg">‹</span>
            <span>Events</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#080a22] px-3 text-white shadow-[0_12px_36px_rgba(15,23,42,0.22)] sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/events/events" className="lg:hidden text-sm font-bold">
              Event<span className="text-violet-300">STUDIO</span>
            </Link>

            <div className="hidden h-8 w-px bg-white/10 lg:block" />

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setWorkspaceMenuOpen((open) => !open)}
                className="min-w-52 rounded-lg border border-white/10 bg-white/8 px-3 py-1.5 text-left text-xs shadow-inner shadow-white/5 hover:bg-white/12"
                aria-expanded={workspaceMenuOpen}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">Workspace</span>
                <span className="flex max-w-48 items-center justify-between gap-2 truncate font-semibold text-white">
                  EventSTUDIO <span className="text-violet-300">⌄</span>
                </span>
              </button>

              {workspaceMenuOpen ? (
                <div className="absolute left-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-white/12 bg-[#111434] p-2 text-sm shadow-2xl shadow-slate-950/35">
                  {[
                    { label: "Donor CRM", href: "/" },
                    { label: "Compassion CRM", href: "/compassion/dashboard" },
                    { label: "EventSTUDIO", href: "/events/events" },
                    { label: "Steward AI", href: "/steward-ai-workspace" },
                    { label: "HRM", href: "/hrm" },
                    { label: "Webmaster", href: "/webmaster" },
                    { label: "Watchdog", href: "/watchdog" },
                  ].map((workspace) => (
                    <Link
                      key={workspace.href}
                      href={workspace.href}
                      className={[
                        "flex items-center justify-between rounded-lg px-3 py-2 font-semibold transition",
                        workspace.label === "EventSTUDIO" ? "bg-violet-600 text-white" : "text-violet-50 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <span>{workspace.label}</span>
                      {workspace.label === "EventSTUDIO" ? <span className="text-violet-200">Current</span> : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="min-w-0 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-semibold text-white">{activeToolLabel}</span>
                {activeEventId ? <span className="text-white/35">/</span> : null}
                {activeEventId ? <span className="truncate text-white/86">{eventName}</span> : null}
              </div>
              {activeEventId ? (
                <p className="truncate text-[11px] text-violet-100/65">
                  {formatEventDate(activeEvent?.startDate)} {activeEvent?.location ? `• ${activeEvent.location}` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1 text-xs font-semibold text-emerald-300 sm:inline-flex">✓ Saved</span>
            {activeEventId ? (
              <>
                <Link href={`/events/${activeEventId}/event-page`} className="hidden rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 md:inline-flex">
                  Page Builder
                </Link>
                <Link href={`/events/${activeEventId}/check-in`} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-500">
                  Live Check-In
                </Link>
              </>
            ) : null}
            <Link href="/settings/ai" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/8 text-sm font-semibold hover:bg-white/12">
              ?
            </Link>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {initials(`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email)}
            </div>
          </div>
        </header>

        <main className={`min-h-0 flex-1 bg-[#f7f8fc] ${isEventPageRoute ? "overflow-hidden" : "overflow-auto"}`}>
          <ErrorBoundary>
            {redirectTarget ? (
              <section className="m-4 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                Redirecting to event-first workspace flow...
              </section>
            ) : (
              children
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
