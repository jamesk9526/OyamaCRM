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
import EventScopedRibbonButton from "@/app/components/workspace-ribbon/EventScopedRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

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
  const [audience, setAudience] = useState("all");
  const [subject, setSubject] = useState("Important information for {eventName}");
  const [messageBody, setMessageBody] = useState("Hello {firstName},\n\nWe are looking forward to seeing you at {eventName} on {eventDate}.\n\nLocation: {eventLocation}\nOrder: {orderNumber}\nReservation PIN: {reservationPin}\nManage reservation: {manageReservationUrl}\n\nThank you.");
  const [sendPreview, setSendPreview] = useState<{ eligibleCount: number; skippedCount: number; recipients: Array<{ name: string; email: string; tableName?: string }> } | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

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

  async function reviewOrSend(confirmed: boolean) {
    if (!selectedEventId) return;
    setSendBusy(true);
    setSendMessage("");
    try {
      const response = await apiFetch<{ preview: boolean; eligibleCount: number; skippedCount?: number; recipients?: Array<{ name: string; email: string; tableName?: string }>; sentCount?: number; failedCount?: number }>(`/api/events/${selectedEventId}/emails/send`, {
        method: "POST",
        body: JSON.stringify({ audience, subject, message: messageBody, confirmed }),
      });
      if (confirmed) {
        setSendPreview(null);
        setSendMessage(`${response.sentCount ?? 0} email${response.sentCount === 1 ? "" : "s"} sent${response.failedCount ? `; ${response.failedCount} failed` : ""}.`);
      } else {
        setSendPreview({ eligibleCount: response.eligibleCount, skippedCount: response.skippedCount ?? 0, recipients: response.recipients ?? [] });
        setSendMessage("Audience reviewed. Confirm the recipient count before sending.");
      }
    } catch (error) {
      setSendMessage(error instanceof Error ? error.message : "Email action failed.");
    } finally {
      setSendBusy(false);
    }
  }

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="event email communications" />;
  }

  return (
    <div className="space-y-6 p-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Emails" },
        ]}
        statusLabel="Ready"
        metadata={`${guestsWithEmail.length.toLocaleString()} emailable guests · ${report?.donorInsights.needsFollowUp ?? 0} follow-up targets`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Audience">
          <EventScopedRibbonButton label="Guests" eventId={selectedEventId} eventPath="guests" accentTone="purple" />
          <EventScopedRibbonButton label="Hosts" eventId={selectedEventId} eventPath="hosts" accentTone="purple" />
          <EventScopedRibbonButton label="Follow-Up" eventId={selectedEventId} eventPath="follow-up" accentTone="purple" />
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
          <section className="border border-[#d1d1d1] bg-white p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">Send event email</p><h2 className="mt-1 text-lg font-semibold text-[#242424]">Choose an audience, review it, then send</h2><p className="mt-1 max-w-3xl text-sm text-[#616161]">Every send rechecks communication eligibility. Use merge fields such as <code>{"{firstName}"}</code>, <code>{"{eventName}"}</code>, <code>{"{eventDate}"}</code>, <code>{"{orderNumber}"}</code>, <code>{"{reservationPin}"}</code>, <code>{"{manageReservationUrl}"}</code>, and <code>{"{tableName}"}</code>.</p></div><Link href="/event-reservations" target="_blank" className="text-sm font-semibold text-[#0f6cbd] hover:underline">Preview reservation manager ↗</Link></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div><label className="block text-sm font-semibold text-[#424242]">Audience<select value={audience} onChange={(event) => { setAudience(event.target.value); setSendPreview(null); }} className="mt-1 min-h-11 w-full border border-[#8a8886] bg-white px-3 text-sm"><option value="all">All emailable guests</option><option value="payment_due">Payment due</option><option value="checked_in">Checked-in guests</option><option value="no_show">Confirmed no-shows</option><option value="hosts">Table hosts</option></select></label><div className="mt-3 border border-[#d1d1d1] bg-[#faf9f8] p-3 text-xs text-[#616161]"><strong className="block text-[#242424]">How it works</strong><ol className="mt-2 space-y-1"><li>1. Review resolves the live audience.</li><li>2. Ineligible or suppressed addresses are skipped.</li><li>3. Send uses the organization email provider and records audit evidence.</li></ol></div></div>
              <div className="space-y-3"><label className="block text-sm font-semibold text-[#424242]">Subject<input value={subject} onChange={(event) => { setSubject(event.target.value); setSendPreview(null); }} className="mt-1 min-h-11 w-full border border-[#8a8886] px-3 text-sm" /></label><label className="block text-sm font-semibold text-[#424242]">Message<textarea value={messageBody} onChange={(event) => { setMessageBody(event.target.value); setSendPreview(null); }} rows={8} className="mt-1 w-full border border-[#8a8886] p-3 text-sm leading-6" /></label></div>
            </div>
            {sendPreview ? <div className="mt-4 border-l-4 border-[#0f6cbd] bg-[#f2f7fc] p-4"><p className="font-semibold">{sendPreview.eligibleCount} eligible recipient{sendPreview.eligibleCount === 1 ? "" : "s"} · {sendPreview.skippedCount} skipped</p><p className="mt-1 text-xs text-[#616161]">{sendPreview.recipients.slice(0, 6).map((recipient) => `${recipient.name} <${recipient.email}>`).join(" · ") || "No eligible recipients"}</p></div> : null}
            {sendMessage ? <p className="mt-3 text-sm text-[#424242]" aria-live="polite">{sendMessage}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void reviewOrSend(false)} disabled={sendBusy || !subject.trim() || !messageBody.trim()} className="min-h-11 border border-[#0f6cbd] px-4 text-sm font-semibold text-[#0f6cbd] hover:bg-[#f2f7fc] disabled:opacity-50">{sendBusy ? "Working…" : "Review audience"}</button><button type="button" onClick={() => void reviewOrSend(true)} disabled={sendBusy || !sendPreview || sendPreview.eligibleCount === 0} className="min-h-11 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:bg-[#c8c6c4]">Confirm and send to {sendPreview?.eligibleCount ?? 0}</button></div>
          </section>

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

            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-950">Email and reservation access</h2>
              <p className="mt-2 text-xs leading-5 text-blue-900">Registration receipts include the order number, reservation PIN, check-in codes, payment state, and a link to the safe attendee editor. Event sends remain review-first and enforce recipient eligibility at send time.</p>
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

