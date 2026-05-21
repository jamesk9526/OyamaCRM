/**
 * EventsShell — Production-ready layout for Events CRM with journey-based sidebar.
 *
 * Layout structure:
 *   1. Top bar — EventSTUDIO brand, current event name, event switcher, quick links, Back to DonorCRM
 *   2. Left sidebar — pinned Overview + 5 journey stages (Plan → Fill → Fundraise → Run → Follow Up)
 *                     + global "Studio Tools" section at the bottom
 *   3. Main content — flex-1 scrollable area for page content
 *
 * Journey stage → tool mapping lives in events-workspace-config.ts.
 * Each tool shows an icon, label, and a status dot (green = Working, amber = Partial).
 *
 * TODO: Add module-level permission check — currently only auth is enforced, not Events module access.
 *       See app/events/layout.tsx for the placeholder comment.
 * TODO: Replace the native <select> event switcher with a custom Combobox/Popover component
 *       (shadcn Command or Headless UI Combobox) for better UX and keyboard navigation.
 * TODO: Wire up a real-time event status indicator in the top bar (e.g. "Check-In Live" badge
 *       when the event's check-in is active). Requires a lightweight /api/events/[id]/status endpoint.
 */
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";
import {
  EVENT_JOURNEY_STAGES,
  EVENT_WORKSPACE_TOOLS,
  GLOBAL_EVENTS_TOOLS,
  STAGE_META,
  getEventToolHref,
  type EventWorkspaceTool,
  type EventStage,
} from "@/app/components/events/events-workspace-config";

interface EventsShellProps {
  children: React.ReactNode;
  /** Optional: override the event ID from URL (used by nested [eventId] layouts). */
  selectedEventId?: string;
  /** Optional: override the active tool (used when route segment differs from tool id). */
  selectedTool?: EventWorkspaceTool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage divider header in the sidebar.
 * Shows the stage icon + name from STAGE_META so it always stays in sync with the config.
 */
function SidebarStageHeader({ stage }: { stage: EventStage }) {
  const meta = STAGE_META[stage];
  return (
    <div className="px-3 pt-3 pb-1">
      <p className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <span className="text-xs leading-none">{meta.icon}</span>
        {meta.label}
      </p>
    </div>
  );
}

function SidebarStageHeaderCompact({ stage }: { stage: EventStage }) {
  const meta = STAGE_META[stage];
  return (
    <div className="px-2 pt-3 pb-1 text-center" title={meta.label}>
      <p className="text-xs leading-none text-slate-400" aria-hidden>{meta.icon}</p>
    </div>
  );
}

/**
 * Status dot shown next to each sidebar tool.
 * Green = Working, amber = Partially Working, hidden when fully working to reduce noise.
 *
 * TODO: Consider surfacing "Not Implemented" tools as greyed-out with a lock icon
 *       once we have a clear upgrade/feature-gating story.
 */
function StatusDot({ status }: { status: "Working" | "Partially Working" | "Not Implemented" }) {
  if (status === "Working") return null; // no dot for fully working tools — keep sidebar clean
  if (status === "Partially Working") {
    return (
      <span
        title="Partially implemented — some features still in progress"
        className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-amber-400"
      />
    );
  }
  // Not Implemented
  return (
    <span
      title="Not yet implemented"
      className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-slate-300"
    />
  );
}

/**
 * Individual sidebar tool link.
 * Shows icon, label, and an optional status dot for non-Working tools.
 * Disabled state for tools where the route isn't available yet.
 */
function SidebarToolLink({
  tool,
  eventId,
  isActive,
  collapsed,
}: {
  tool: (typeof EVENT_WORKSPACE_TOOLS)[number];
  eventId: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  const href = getEventToolHref(tool, eventId);

  // Skip overview in stage loops — it's pinned at the top of the sidebar separately.
  if (tool.id === "overview") return null;

  if (!href) {
    // Route segment missing — tool is not yet routed
    return (
      <div
        title={tool.notes || tool.label}
        className={[
          "mx-2 flex cursor-not-allowed select-none items-center rounded-md py-1.5 text-sm opacity-50",
          collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        ].join(" ")}
      >
        <span className="shrink-0 text-sm leading-none">{tool.icon}</span>
        {!collapsed && <span className="truncate font-medium text-slate-400">{tool.label}</span>}
        {!collapsed && <StatusDot status={tool.status} />}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={collapsed ? `${tool.label} (${tool.status})` : tool.notes}
      className={[
        "mx-2 flex items-center rounded-md py-1.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        isActive
          ? "bg-violet-50 text-violet-900 font-semibold"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      ].join(" ")}
    >
      <span className="shrink-0 text-sm leading-none">{tool.icon}</span>
      {!collapsed && <span className="truncate">{tool.label}</span>}
      {!collapsed && <StatusDot status={tool.status} />}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Known static route segments that should NOT be treated as event IDs.
// These are global Events CRM pages that don't require a selected event.
// Keep this list in sync with AGENTS.md events-crm-boundary-rules.
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_EVENT_SEGMENTS = new Set([
  "events",
  "workspace",
  "reports",
  "templates",
  "page-builder",
]);

const EVENTS_SIDEBAR_COLLAPSED_KEY = "events-shell-sidebar-collapsed";
const EVENTS_RECENT_IDS_KEY = "events-shell-recent-ids";
const EVENTS_RECENT_LIMIT = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────────────────────

/** Production-ready Events shell with journey-based sidebar navigation. */
export default function EventsShell({ children, selectedEventId, selectedTool }: EventsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentEventIds, setRecentEventIds] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasManualSidebarPreference, setHasManualSidebarPreference] = useState(false);
  /** Pending selection in the no-event-selected dialog before the user confirms. */
  const [pendingEventId, setPendingEventId] = useState("");

  // Restore persisted sidebar state. If no preference exists, auto-collapse on compact desktop widths.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(EVENTS_SIDEBAR_COLLAPSED_KEY);
    if (persisted === "1" || persisted === "0") {
      setIsSidebarCollapsed(persisted === "1");
      setHasManualSidebarPreference(true);
      return;
    }
    setIsSidebarCollapsed(window.innerWidth < 1280);
  }, []);

  // Keep sidebar adaptive on small laptops until user explicitly chooses a preference.
  useEffect(() => {
    if (typeof window === "undefined" || hasManualSidebarPreference) return;
    const onResize = () => setIsSidebarCollapsed(window.innerWidth < 1280);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasManualSidebarPreference]);

  // Persist user-selected sidebar preference.
  useEffect(() => {
    if (typeof window === "undefined" || !hasManualSidebarPreference) return;
    window.localStorage.setItem(EVENTS_SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed ? "1" : "0");
  }, [hasManualSidebarPreference, isSidebarCollapsed]);

  // Load recent events list for quick re-entry in the selector dialog.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(EVENTS_RECENT_IDS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setRecentEventIds(parsed.filter((id): id is string => typeof id === "string"));
    } catch {
      // Ignore malformed localStorage payloads.
    }
  }, []);

  const recentEvents = useMemo(() => {
    if (recentEventIds.length === 0 || events.length === 0) return [];
    const eventMap = new Map(events.map((event) => [event.id, event]));
    return recentEventIds
      .map((id) => eventMap.get(id))
      .filter((event): event is EventItem => Boolean(event));
  }, [events, recentEventIds]);

  /**
   * Detect whether this pathname requires a selected event.
   * Global routes (e.g. /events, /events/reports) render without the full sidebar.
   */
  const isEventRoute = useMemo(() => {
    const match = pathname.match(/^\/events\/([^/]+)/);
    if (!match) return false; // root /events — global
    return !GLOBAL_EVENT_SEGMENTS.has(match[1]);
  }, [pathname]);

  /**
   * Resolve the active event ID from:
   *   1. Explicit prop (from nested layout)
   *   2. ?eventId= query param
   *   3. /events/[eventId]/[tool] URL segment
   */
  const eventId = useMemo(() => {
    if (selectedEventId) return selectedEventId;
    const searchParam = searchParams.get("eventId");
    if (searchParam) return searchParam;
    const match = pathname.match(/^\/events\/([^/]+)(?:\/|$)/);
    if (match && !GLOBAL_EVENT_SEGMENTS.has(match[1])) return match[1];
    return "";
  }, [selectedEventId, searchParams, pathname]);

  /**
   * Load the full event list. Clears selectedEvent immediately when eventId changes
   * so we don't briefly display a stale event while the new one loads.
   *
   * TODO: Cache the event list in a React context (EventsContext) so sibling routes
   *       don't each trigger their own /api/events fetch. This shell re-mounts on
   *       layout transitions and causes unnecessary repeated fetches.
   */
  useEffect(() => {
    setSelectedEvent(null);
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        const items = Array.isArray(data) ? data : [];
        setEvents(items);
        if (eventId) {
          setSelectedEvent(items.find((e) => e.id === eventId) ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [eventId]);

  /** Determine the active tool ID from the current URL segment. */
  const currentTool = useMemo(() => {
    const match = pathname.match(/\/events\/[^/]+\/([a-z-]+)/);
    if (!match) return null;
    const toolId = match[1] as EventWorkspaceTool;
    return EVENT_WORKSPACE_TOOLS.find((t) => t.id === toolId) ?? null;
  }, [pathname]);

  /** Tools grouped by stage for sidebar rendering. */
  const toolsByStage = useMemo(
    () =>
      EVENT_JOURNEY_STAGES.map((stage) => ({
        stage,
        tools: EVENT_WORKSPACE_TOOLS.filter((t) => t.stage === stage),
      })),
    [],
  );

  /** Switch to a different event and navigate to its overview. */
  function rememberRecentEvent(eventIdValue: string) {
    if (!eventIdValue || typeof window === "undefined") return;
    setRecentEventIds((prev) => {
      const next = [eventIdValue, ...prev.filter((id) => id !== eventIdValue)].slice(0, EVENTS_RECENT_LIMIT);
      window.localStorage.setItem(EVENTS_RECENT_IDS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleEventChange(newId: string) {
    if (!newId) return;
    rememberRecentEvent(newId);
    router.push(`/events/${newId}/overview`);
  }

  /** Confirm the pending event selection from the selector dialog. */
  function handleOpenEvent() {
    if (!pendingEventId) return;
    rememberRecentEvent(pendingEventId);
    router.push(`/events/${pendingEventId}/overview`);
  }

  useEffect(() => {
    if (selectedEvent?.id) {
      rememberRecentEvent(selectedEvent.id);
    }
  }, [selectedEvent?.id]);

  // ── Global routes: minimal header only, no sidebar ────────────────────────
  if (!isEventRoute) {
    return (
      <div className="flex h-screen flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Back to DonorCRM */}
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              ← DonorCRM
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <Link href="/events" className="text-base font-bold text-violet-600 hover:opacity-75 transition-opacity">
              EventSTUDIO
            </Link>
            <div className="flex-1" />
            <Link
              href="/events/workspace"
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              ← Event Selector
            </Link>
            <Link href="/events/events" className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
              All Events
            </Link>
            <Link href="/events/reports" className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
              Reports
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    );
  }

  // ── Event-scoped route with no valid event selected ───────────────────────
  if (!eventId || !selectedEvent) {
    return (
      <div className="flex h-screen flex-col bg-slate-50">
        {/* Minimal header so user isn't stranded */}
        <header className="border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              ← DonorCRM
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-base font-bold text-violet-600">EventSTUDIO</span>
          </div>
        </header>

        {/* Centered selector card */}
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
            {/* Card header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">
                🎪
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Open Event Workspace</h2>
                <p className="text-xs text-slate-500">Select an event to get started</p>
              </div>
            </div>

            {/* Event picker */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Event
                </label>
                <select
                  value={pendingEventId}
                  onChange={(e) => setPendingEventId(e.target.value)}
                  disabled={loading}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
                >
                  <option value="">
                    {loading ? "Loading events…" : events.length === 0 ? "No events found" : "Select an event…"}
                  </option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.startDate
                        ? ` — ${new Date(e.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : ""}
                    </option>
                  ))}
                </select>
                {/* TODO: Replace <select> with a searchable Combobox for orgs with 50+ events. */}
              </div>

              <button
                type="button"
                onClick={handleOpenEvent}
                disabled={!pendingEventId}
                className="w-full h-10 rounded-lg bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Open Event Workspace
              </button>

              {recentEvents.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recently Viewed</p>
                  <div className="space-y-1">
                    {recentEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => {
                          setPendingEventId(event.id);
                          handleEventChange(event.id);
                        }}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                      >
                        {event.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer links */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/events/events"
                className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
              >
                View all events →
              </Link>
              <Link
                href="/"
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← DonorCRM
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Full event workspace shell ─────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-slate-50">

      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      {/*
       * TODO: Add a "Check-In Live" pill badge here (violet border, pulsing dot) when
       *       the event's checkin_started_at is set and checkin_ended_at is null.
       *       Requires a lightweight GET /api/events/[id]/status route.
       */}
      <header className="shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-2.5">

          {/* Back to event selector */}
          <Link
            href="/events/workspace"
            title="Back to event selector"
            className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            ← Events
          </Link>
          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Brand + event identity / switcher */}
          <Link
            href="/events"
            title="EventSTUDIO home"
            className="shrink-0 text-sm font-bold text-violet-600 hover:opacity-75 transition-opacity tracking-tight"
          >
            EventSTUDIO
          </Link>
          <span className="shrink-0 text-slate-300 select-none" aria-hidden>›</span>

          {/* Event identity + switcher — single control: shows current event name and lets staff switch events.
           * TODO: Replace with a custom Combobox/Popover (shadcn Command or Headless UI Combobox)
           *       that shows event date + type badge per option for faster scanning.
           */}
          <select
            value={eventId}
            onChange={(e) => handleEventChange(e.target.value)}
            aria-label="Switch event"
            className="min-w-0 flex-1 h-8 max-w-[320px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-colors cursor-pointer"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          {/* Quick nav links */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setHasManualSidebarPreference(true);
                setIsSidebarCollapsed((prev) => !prev);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? "Expand Nav" : "Collapse Nav"}
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <Link
              href="/events/events"
              className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              All Events
            </Link>
            <Link
              href="/events/reports"
              className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              Reports
            </Link>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            {/* Back to DonorCRM — styled as a subtle but clear navigation anchor */}
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              ← DonorCRM
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body (sidebar + content) ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className={[
          "flex shrink-0 flex-col border-r border-slate-200 bg-white overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent]",
          isSidebarCollapsed ? "w-16" : "w-52",
        ].join(" ")}>
          <nav className="flex-1 py-2" aria-label="Event workspace navigation">

            {/* ── Overview (pinned, outside stages) ── */}
            <div className="px-2 pb-1">
              <Link
                href={`/events/${eventId}/overview`}
                className={[
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  isSidebarCollapsed ? "justify-center px-2" : "",
                  currentTool?.id === "overview" || (!currentTool && pathname.endsWith("/overview"))
                    ? "bg-violet-100 text-violet-900"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")}
                title={isSidebarCollapsed ? "Overview" : undefined}
              >
                <span className="shrink-0 text-sm leading-none">📊</span>
                {!isSidebarCollapsed && <span>Overview</span>}
              </Link>
            </div>

            {/* Thin separator before journey stages */}
            <div className="mx-4 my-2 border-t border-slate-100" />

            {/* ── Journey stages ── */}
            {toolsByStage.map(({ stage, tools }) => {
              // Skip rendering a stage if all its non-overview tools have no links
              const visibleTools = tools.filter((t) => t.id !== "overview");
              if (visibleTools.length === 0) return null;

              return (
                <div key={stage}>
                  {isSidebarCollapsed ? <SidebarStageHeaderCompact stage={stage} /> : <SidebarStageHeader stage={stage} />}
                  <div className="space-y-0.5 mb-1">
                    {visibleTools.map((tool) => (
                      <SidebarToolLink
                        key={tool.id}
                        tool={tool}
                        eventId={eventId}
                        isActive={currentTool?.id === tool.id}
                        collapsed={isSidebarCollapsed}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ── Studio Tools (global) ── */}
            <div className="mx-4 my-2 border-t border-slate-100" />
            <div className="px-3 pt-2 pb-1">
              <p className={[
                "flex items-center px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400",
                isSidebarCollapsed ? "justify-center" : "gap-1.5",
              ].join(" ")}>
                <span className="text-xs leading-none">🛠️</span>
                {!isSidebarCollapsed && "Studio Tools"}
              </p>
            </div>
            <div className="space-y-0.5 mb-2">
              {GLOBAL_EVENTS_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  title={tool.description}
                  className={[
                    "mx-2 flex items-center rounded-md py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
                    isSidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
                  ].join(" ")}
                >
                  <span className="shrink-0 text-sm leading-none">{tool.icon}</span>
                  {!isSidebarCollapsed && <span className="truncate">{tool.label}</span>}
                </Link>
              ))}
            </div>

          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>

      </div>
    </div>
  );
}

