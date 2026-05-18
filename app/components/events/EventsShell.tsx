/**
 * EventsShell — Production-ready layout for Events CRM with journey-based sidebar.
 * Organizes tools by event stage: Before / During / After / Other tools.
 * Shows current selection and provides unified styling across all event workspaces.
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
  getEventTool,
  getEventToolHref,
  type EventWorkspaceTool,
} from "@/app/components/events/events-workspace-config";

interface EventsShellProps {
  children: React.ReactNode;
  selectedEventId?: string;
  selectedTool?: EventWorkspaceTool;
}

/** Sidebar section header for a journey stage. */
function SidebarStageHeader({ stage, icon }: { stage: string; icon: string }) {
  const stageConfig: Record<string, { title: string; emoji: string }> = {
    "Before Event": { title: "Before Event", emoji: "📋" },
    "During Event": { title: "During Event", emoji: "🎪" },
    "After Event": { title: "After Event", emoji: "✅" },
  };
  const config = stageConfig[stage] || { title: stage, emoji: "🔧" };
  return (
    <div className="px-3 pt-4 pb-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className="mr-1.5">{config.emoji}</span>
        {config.title}
      </p>
    </div>
  );
}

/** Sidebar tool link. */
function SidebarToolLink({
  tool,
  eventId,
  isActive,
  isDisabled,
}: {
  tool: (typeof EVENT_WORKSPACE_TOOLS)[number];
  eventId: string;
  isActive: boolean;
  isDisabled: boolean;
}) {
  const href = getEventToolHref(tool, eventId);
  
  if (!href || isDisabled) {
    return (
      <button
        type="button"
        disabled
        className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-400 opacity-60 cursor-not-allowed"
      >
        {tool.label}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={[
        "block px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-l-2 border-violet-600 bg-violet-50 text-violet-900"
          : "border-l-2 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      {tool.label}
    </Link>
  );
}

/** Production-ready Events shell with journey-based sidebar. */
export default function EventsShell({ children, selectedEventId, selectedTool }: EventsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve selected event ID if not provided
  const eventId = useMemo(() => {
    return selectedEventId || searchParams.get("eventId") || "";
  }, [selectedEventId, searchParams]);

  // Load events on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        const items = Array.isArray(data) ? data : [];
        setEvents(items);
        
        // Set selected event
        if (eventId) {
          const found = items.find((e) => e.id === eventId);
          setSelectedEvent(found || null);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [eventId]);

  // Determine current tool from pathname
  const currentTool = useMemo(() => {
    const match = pathname.match(/\/events\/[^/]+\/([a-z-]+)/);
    if (!match) return null;
    const toolId = match[1] as EventWorkspaceTool;
    return EVENT_WORKSPACE_TOOLS.find((t) => t.id === toolId) || null;
  }, [pathname]);

  // Group tools by stage
  const toolsByStage = useMemo(() => {
    return EVENT_JOURNEY_STAGES.map((stage) => ({
      stage,
      tools: EVENT_WORKSPACE_TOOLS.filter((tool) => tool.stage === stage),
    }));
  }, []);

  // Navigate to event
  function handleEventChange(newEventId: string) {
    if (!newEventId) return;
    // Navigate to the event's overview page
    router.push(`/events/${newEventId}/overview`);
  }

  // Show selector if no event selected
  if (!eventId || !selectedEvent) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">EventSTUDIO</h1>
            <p className="mt-2 text-sm text-slate-600">Select an event to begin</p>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Choose Event</span>
              <select
                value={eventId}
                onChange={(e) => handleEventChange(e.target.value)}
                disabled={loading || events.length === 0}
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="">{loading ? "Loading..." : "Select an event"}</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} - {new Date(e.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <Link
                href="/events/events"
                className="text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                View all events →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* ────────── Top Bar ────────── */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href="/events" className="flex items-center gap-2 shrink-0 hover:opacity-75 transition-opacity">
              <span className="text-lg font-bold text-violet-600">EventSTUDIO</span>
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">Current Event</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{selectedEvent.name}</p>
            </div>
          </div>

          {/* Event selector dropdown */}
          <select
            value={eventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100 shrink-0"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          {/* Quick links */}
          <div className="flex items-center gap-2">
            <Link
              href="/events/events"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              All Events
            </Link>
            <Link
              href="/events/reports"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              Reports
            </Link>
          </div>
        </div>
      </header>

      {/* ────────── Main Content ────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ────────── Sidebar ────────── */}
        <aside className="w-56 border-r border-slate-200 bg-white overflow-y-auto shadow-sm">
          <nav className="space-y-1 py-2">
            {/* Overview (always first) */}
            <div className="px-3 py-2">
              <Link
                href={`/events/${eventId}/overview`}
                className={[
                  "block px-3 py-2 text-sm font-medium transition-colors rounded-lg",
                  currentTool?.id === "overview"
                    ? "bg-violet-50 text-violet-900 border-l-2 border-violet-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                📊 Overview
              </Link>
            </div>

            {/* Journey stages */}
            {toolsByStage.map(({ stage, tools }) => (
              <div key={stage}>
                <SidebarStageHeader stage={stage} icon="📋" />
                <nav className="space-y-0">
                  {tools.map((tool) => (
                    <SidebarToolLink
                      key={tool.id}
                      tool={tool}
                      eventId={eventId}
                      isActive={currentTool?.id === tool.id}
                      isDisabled={!getEventToolHref(tool, eventId)}
                    />
                  ))}
                </nav>
              </div>
            ))}

            {/* Divider */}
            <div className="my-2 border-t border-slate-200"></div>

            {/* Other tools */}
            <div className="px-3 pt-4 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">🔧 Other Tools</p>
            </div>
            <nav className="space-y-0">
              {GLOBAL_EVENTS_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="block px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {tool.label}
                </Link>
              ))}
            </nav>
          </nav>
        </aside>

        {/* ────────── Content ────────── */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
