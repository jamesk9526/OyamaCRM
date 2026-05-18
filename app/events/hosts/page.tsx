/** Event hosts workspace for table-host operations and readiness tracking. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface EventTable {
  id: string;
  name: string;
  capacity: number;
  isSponsored: boolean;
  hostName?: string;
  tableNumber?: number;
  _count: { guests: number };
}

function formatDate(value?: string): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** EventHostsPage surfaces host coverage and sponsored table readiness. */
export default function EventHostsPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;
  const router = useRouter();

  // Legacy global route redirects to the event selector when no event is selected.
  useEffect(() => {
    if (!eventScoped) {
      router.replace("/events/events");
    }
  }, [eventScoped, router]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [tables, setTables] = useState<EventTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceEventId) setSelectedEventId(workspaceEventId);
  }, [workspaceEventId]);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        const activeEvents = (Array.isArray(data) ? data : []).filter((event) => event.active !== false);
        setEvents(activeEvents);
        if (!workspaceEventId && activeEvents.length > 0) {
          setSelectedEventId((current) => current || activeEvents[0].id);
        }
      } catch (error) {
        console.error("Failed to load events for hosts workspace:", error);
      }
    }

    void loadEvents();
  }, [workspaceEventId]);

  async function loadWorkspace(eventId: string) {
    if (!eventId) {
      setTables([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const tableData = await apiFetch<EventTable[]>(`/api/events/${eventId}/tables`);
      setTables(Array.isArray(tableData) ? tableData : []);
    } catch (error) {
      console.error("Failed to load hosts workspace:", error);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace(selectedEventId);
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const sponsoredTables = tables.filter((table) => table.isSponsored);
  const hostedTables = tables.filter((table) => Boolean((table.hostName ?? "").trim()));
  const missingHostCoverage = sponsoredTables.filter((table) => !(table.hostName ?? "").trim());
  const openHostSeats = hostedTables.reduce((sum, table) => sum + Math.max(0, table.capacity - table._count.guests), 0);

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="table host coverage" />;
  }

  return (
    <div className="space-y-6 p-6">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Table Host Manager is partially working"
        description="Host invite links, resend controls, and host portal workflows are still in development. Use this workspace for host coverage tracking and staff handoff planning."
      />

      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Hosts" },
        ]}
        statusLabel="Partially Working"
        metadata={`${hostedTables.length.toLocaleString()} hosted tables · ${missingHostCoverage.length.toLocaleString()} sponsor tables missing host owner`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Navigation">
          <WorkspaceRibbonButton label="Tables" href={selectedEventId ? `/events/${selectedEventId}/tables` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Guests" href={selectedEventId ? `/events/${selectedEventId}/guests` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Follow-Up" href={selectedEventId ? `/events/${selectedEventId}/follow-up` : undefined} disabled={!selectedEventId} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadWorkspace(selectedEventId)} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Open Table Manager" href={selectedEventId ? `/events/${selectedEventId}/tables` : undefined} disabled={!selectedEventId} variant="primary" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Table host management</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Hosts Workspace</h1>
            <p className="mt-1 text-sm text-slate-600">Review host ownership, sponsored table coverage, and open-seat pressure before event-night check-in begins.</p>
          </div>
          {!eventScoped ? (
            <label className="w-full max-w-sm space-y-1">
              <span className="text-xs font-semibold text-slate-600">Selected event</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="">{loading ? "Loading events..." : "Select an event"}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {formatDate(event.startDate)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-violet-700">Event lock active. Switch from All Events.</p>
          )}
        </div>
      </section>

      {!selectedEventId ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Select an event to manage table-host coverage.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hosted Tables</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{hostedTables.length}</p>
              <p className="text-xs text-slate-500">{selectedEvent?.name ?? "Selected event"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sponsored Tables</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{sponsoredTables.length}</p>
              <p className="text-xs text-slate-500">Sponsor package tables</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing Host Coverage</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{missingHostCoverage.length}</p>
              <p className="text-xs text-slate-500">Sponsored tables without host owner</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Seats</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{openHostSeats}</p>
              <p className="text-xs text-slate-500">Across hosted tables</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Host coverage by table</h2>
              <Link href={selectedEventId ? `/events/${selectedEventId}/tables` : "/events/tables"} className="text-xs font-semibold text-violet-700 hover:text-violet-900">
                Manage tables
              </Link>
            </div>
            {tables.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No tables found for this event.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Table</th>
                      <th className="px-3 py-2 text-left">Host</th>
                      <th className="px-3 py-2 text-left">Seats</th>
                      <th className="px-3 py-2 text-left">Coverage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {tables.map((table) => {
                      const hostName = (table.hostName ?? "").trim();
                      const openSeats = Math.max(0, table.capacity - table._count.guests);
                      return (
                        <tr key={table.id}>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {table.tableNumber != null ? `#${table.tableNumber} ` : ""}
                            {table.name}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{hostName || "Unassigned"}</td>
                          <td className="px-3 py-2 text-slate-700">{table._count.guests}/{table.capacity} ({openSeats} open)</td>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {hostName ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">Owned</span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Needs owner</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Host invite links and one-click resend controls are still in development. Use table records and manual communication handoff for now.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

