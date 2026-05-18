/** Event emails workspace with event-scoped audience preparation. */
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

interface EventGuest {
  id: string;
  email?: string;
  checkedIn: boolean;
  paymentStatus?: string;
  rsvpStatus?: string;
  table?: { name: string };
  constituent?: { firstName: string; lastName: string };
  firstName?: string;
  lastName?: string;
}

interface EventReport {
  donorInsights: {
    linkedGuests: number;
    unlinkedGuests: number;
    newDonors: number;
    needsFollowUp: number;
  };
  counts: {
    sponsors: number;
    activities: number;
  };
}

function formatDate(value?: string): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** EventCommunicationsPage prepares event email audiences and handoff paths. */
export default function EventCommunicationsPage() {
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
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [report, setReport] = useState<EventReport | null>(null);
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
        console.error("Failed to load events for communications workspace:", error);
      }
    }

    void loadEvents();
  }, [workspaceEventId]);

  async function loadWorkspace(eventId: string) {
    if (!eventId) {
      setGuests([]);
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [guestData, reportData] = await Promise.all([
        apiFetch<EventGuest[]>(`/api/events/${eventId}/guests`),
        apiFetch<EventReport>(`/api/events/${eventId}/report`),
      ]);
      setGuests(Array.isArray(guestData) ? guestData : []);
      setReport(reportData);
    } catch (error) {
      console.error("Failed to load event communications workspace:", error);
      setGuests([]);
      setReport(null);
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

  const guestsWithEmail = guests.filter((guest) => Boolean((guest.email ?? "").trim()));
  const noShows = guests.filter((guest) => !guest.checkedIn && guest.rsvpStatus === "CONFIRMED");
  const paymentFollowUp = guests.filter((guest) => guest.paymentStatus === "DUE" || guest.paymentStatus === "PENDING_CHECK");
  const checkedInGuests = guests.filter((guest) => guest.checkedIn);

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="event email communications" />;
  }

  return (
    <div className="space-y-6 p-6">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Event email sending is partially wired"
        description="Audience preparation and workspace routing are available, but scheduling and send execution still depend on central communications orchestration."
      />

      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Emails" },
        ]}
        statusLabel="Partially Working"
        metadata={`${guestsWithEmail.length.toLocaleString()} emailable guests · ${report?.donorInsights.needsFollowUp ?? 0} follow-up targets`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Audience">
          <WorkspaceRibbonButton label="Guests" href={selectedEventId ? `/events/${selectedEventId}/guests` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Hosts" href={selectedEventId ? `/events/${selectedEventId}/hosts` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Follow-Up" href={selectedEventId ? `/events/${selectedEventId}/follow-up` : undefined} disabled={!selectedEventId} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadWorkspace(selectedEventId)} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Open Communications" href="/communications" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Event email prep</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Event Communications Workspace</h1>
            <p className="mt-1 text-sm text-slate-600">Build event-targeted segments for confirmations, reminders, host instructions, and post-event thank-you campaigns.</p>
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
          Select an event to prepare communication audiences.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emailable Guests</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{guestsWithEmail.length}</p>
              <p className="text-xs text-slate-500">{selectedEvent?.name ?? "Selected event"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checked In</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{checkedInGuests.length}</p>
              <p className="text-xs text-slate-500">Post-event thank-you pool</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No-Shows</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{noShows.length}</p>
              <p className="text-xs text-slate-500">Reminder and retry audience</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Follow-Up</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">{paymentFollowUp.length}</p>
              <p className="text-xs text-slate-500">Pending and due payment statuses</p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Recommended event message segments</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Confirmed no-shows: {noShows.length}</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Checked-in thank-you recipients: {checkedInGuests.length}</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Payment follow-up recipients: {paymentFollowUp.length}</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Unlinked guests for donor cleanup: {report?.donorInsights.unlinkedGuests ?? 0}</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Sponsors requiring acknowledgments: {report?.counts.sponsors ?? 0}</li>
              </ul>
            </article>

            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-violet-900">Production status</h2>
              <p className="mt-2 text-xs leading-5 text-violet-900">
                Event email scheduling and send execution still depend on the central communications engine. This workspace is production-usable for segment prep and handoff links, with send orchestration marked partially working.
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <Link href="/communications" className="block font-semibold text-violet-700 hover:text-violet-900">Open central communications workspace</Link>
                <Link href={selectedEventId ? `/events/${selectedEventId}/reports` : "/events/reports"} className="block font-semibold text-violet-700 hover:text-violet-900">Review event report outcomes</Link>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

