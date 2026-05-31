/** Event follow-up workspace for post-event donor and guest actions. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import EventScopedRibbonButton from "@/app/components/workspace-ribbon/EventScopedRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface DonorSafeExportRow {
  guestId: string;
  firstName: string;
  lastName: string;
  email: string;
  checkedIn: boolean;
  rsvpStatus: string;
  paymentStatus: string;
  table: string;
  linkedConstituentName: string;
  followUpAction: string;
}

interface DonorSafeExportResponse {
  event: { id: string; name: string; startDate: string };
  summary: {
    totalGuests: number;
    checkedIn: number;
    noShows: number;
    paymentFollowUp: number;
    linkFollowUp: number;
  };
  rows: DonorSafeExportRow[];
}

function formatDate(value?: string): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** EventFollowUpPage surfaces donor-safe follow-up queues and export shortcuts. */
export default function EventFollowUpPage() {
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
  const [exportData, setExportData] = useState<DonorSafeExportResponse | null>(null);
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
        console.error("Failed to load events for follow-up workspace:", error);
      }
    }

    void loadEvents();
  }, [workspaceEventId]);

  async function loadWorkspace(eventId: string) {
    if (!eventId) {
      setExportData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<DonorSafeExportResponse>(`/api/events/${eventId}/donor-safe-export`);
      setExportData(data);
    } catch (error) {
      console.error("Failed to load follow-up workspace:", error);
      setExportData(null);
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

  const topActions = (exportData?.rows ?? []).slice(0, 10);

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="post-event follow-up" />;
  }

  return (
    <div className="space-y-6 p-6">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Follow-Up automation is still in development"
        description="This workspace is ready for manual post-event review and exports, but automated task creation and orchestration are not fully implemented yet."
      />

      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Follow-Up" },
        ]}
        statusLabel="Partially Working"
        metadata={`${exportData?.summary.noShows ?? 0} no-shows · ${exportData?.summary.paymentFollowUp ?? 0} payment follow-up rows`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Workflow">
          <EventScopedRibbonButton label="Donations" eventId={selectedEventId} eventPath="donations" accentTone="purple" />
          <EventScopedRibbonButton label="Emails" eventId={selectedEventId} eventPath="emails" accentTone="purple" />
          <EventScopedRibbonButton label="Reports" eventId={selectedEventId} eventPath="reports" accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadWorkspace(selectedEventId)} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Download CSV" href={selectedEventId ? `/api/events/${selectedEventId}/donor-safe-export?format=csv` : undefined} disabled={!selectedEventId} variant="primary" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Post-event workflow</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Follow-Up Workspace</h1>
            <p className="mt-1 text-sm text-slate-600">Use donor-safe exports to drive thank-you outreach, no-show recovery, and constituent linking tasks after each event.</p>
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
          Select an event to build follow-up queues.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Guests</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{exportData?.summary.totalGuests ?? 0}</p>
              <p className="text-xs text-slate-500">{selectedEvent?.name ?? "Selected event"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No-Shows</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{exportData?.summary.noShows ?? 0}</p>
              <p className="text-xs text-slate-500">Confirmed but not checked in</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Follow-Up</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">{exportData?.summary.paymentFollowUp ?? 0}</p>
              <p className="text-xs text-slate-500">Due or pending payments</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Link Follow-Up</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{exportData?.summary.linkFollowUp ?? 0}</p>
              <p className="text-xs text-slate-500">Guests needing constituent links</p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Top follow-up queue</h2>
              {topActions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No follow-up rows available yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Guest</th>
                        <th className="px-3 py-2 text-left">Table</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {topActions.map((row) => (
                        <tr key={row.guestId}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{`${row.firstName} ${row.lastName}`.trim() || "Unnamed guest"}</p>
                            <p className="text-xs text-slate-500">{row.email || "No email"}</p>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.table}</td>
                          <td className="px-3 py-2 text-slate-700">{row.followUpAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-violet-900">Next-step handoffs</h2>
              <div className="mt-3 space-y-2 text-xs">
                <Link href={selectedEventId ? `/api/events/${selectedEventId}/donor-safe-export?format=csv` : "#"} className="block font-semibold text-violet-700 hover:text-violet-900">
                  Download donor-safe CSV
                </Link>
                <Link href={selectedEventId ? `/events/${selectedEventId}/emails` : "/events/emails"} className="block font-semibold text-violet-700 hover:text-violet-900">
                  Open event email segments
                </Link>
                <Link href={selectedEventId ? `/events/${selectedEventId}/donations` : "/events/donations"} className="block font-semibold text-violet-700 hover:text-violet-900">
                  Open donations workspace
                </Link>
              </div>
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Automated task generation is still in development. Staff should review this queue and trigger outreach manually.
              </p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

