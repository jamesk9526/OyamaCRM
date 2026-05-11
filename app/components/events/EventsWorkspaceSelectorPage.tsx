/** EventsWorkspaceSelectorPage enforces event-first routing before opening scoped event tools. */
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

type EventWorkspaceTool =
  | "overview"
  | "tickets"
  | "orders"
  | "guests"
  | "tables"
  | "check-in"
  | "sponsors"
  | "communications"
  | "reports"
  | "tasks"
  | "volunteers"
  | "files"
  | "settings";

const TOOL_OPTIONS: Array<{ id: EventWorkspaceTool; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Live event dashboard and readiness" },
  { id: "tickets", label: "Tickets", description: "Ticket types, capacity, and limits" },
  { id: "orders", label: "Orders", description: "Purchases, payments, and order activity" },
  { id: "guests", label: "Guests", description: "Guest roster and constituent linking" },
  { id: "tables", label: "Tables", description: "Seating assignments and open seat tracking" },
  { id: "check-in", label: "Check-In", description: "Door check-in and code scan flow" },
  { id: "sponsors", label: "Sponsors", description: "Sponsor records and package tracking" },
  { id: "communications", label: "Communications", description: "Event-specific messaging workflows" },
  { id: "reports", label: "Reports", description: "Attendance and revenue reporting" },
  { id: "tasks", label: "Tasks", description: "Event ops task queue" },
  { id: "volunteers", label: "Volunteers", description: "Volunteer assignments and shifts" },
  { id: "files", label: "Files", description: "Event documents and assets" },
  { id: "settings", label: "Settings", description: "Event defaults and controls" },
];

const GLOBAL_TOOL_OPTIONS: Array<{ label: string; description: string; href: string }> = [
  { label: "Global Reports", description: "Cross-event analytics and performance benchmarking.", href: "/events/reports" },
  { label: "Event Page Creation", description: "Design and publish event pages through the shared website builder.", href: "/events/page-builder" },
  { label: "Event Templates", description: "Create reusable draft templates from prior events.", href: "/events/templates" },
  { label: "Overall Event Management", description: "Registry and lifecycle management for all events.", href: "/events/events" },
];

/** Parses a safe workspace tool from URL query input. */
function parseTool(raw: string | null): EventWorkspaceTool {
  if (!raw) return "overview";
  const match = TOOL_OPTIONS.find((tool) => tool.id === raw);
  return match ? match.id : "overview";
}

/** EventsWorkspaceSelectorPage asks staff to choose an event before opening scoped tools. */
export default function EventsWorkspaceSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTool, setSelectedTool] = useState<EventWorkspaceTool>(() => parseTool(searchParams.get("tool")));

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        const scoped = Array.isArray(data)
          ? [...data].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
          : [];
        setEvents(scoped);
        if (scoped.length > 0) {
          const requestedEventId = searchParams.get("eventId");
          const requested = requestedEventId ? scoped.find((event) => event.id === requestedEventId) : null;
          const activeEvent = scoped.find((event) => event.active);
          setSelectedEventId(requested?.id ?? activeEvent?.id ?? scoped[0].id);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadEvents();
  }, [searchParams]);

  const selectedToolMeta = useMemo(
    () => TOOL_OPTIONS.find((tool) => tool.id === selectedTool) ?? TOOL_OPTIONS[0],
    [selectedTool],
  );

  const targetHref = selectedEventId ? `/events/${selectedEventId}/${selectedTool}` : null;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Event Workspace Selector</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose an event first, then open one scoped tool path. This keeps attendees, orders, tables, and reports tied to the same event context.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">1) Select Event</h2>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Event</span>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">{loading ? "Loading events..." : "Select event"}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.startDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>

          <h2 className="text-sm font-semibold text-gray-900 pt-2">2) Select Tool</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOOL_OPTIONS.map((tool) => {
              const active = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedTool(tool.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{tool.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Workspace Route</h2>
          <p className="text-xs text-gray-500">Selected tool</p>
          <p className="text-sm font-medium text-gray-900">{selectedToolMeta.label}</p>
          <p className="text-xs text-gray-500">{selectedToolMeta.description}</p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all">
            {targetHref ?? "Select an event to generate a workspace route."}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!targetHref) return;
              router.push(targetHref);
            }}
            disabled={!targetHref}
            className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Open Event Workspace
          </button>

          <Link
            href="/events/events"
            className="block text-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Back To Events Registry
          </Link>
        </aside>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Global Tools (Outside Event Scope)</h2>
          <p className="text-xs text-gray-500 mt-1">
            Use these when you need cross-event reporting, template management, page creation, or event registry administration.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {GLOBAL_TOOL_OPTIONS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-lg border border-gray-200 px-3 py-2 hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-900">{tool.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
