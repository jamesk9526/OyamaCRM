"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TriviaEvent } from "@/app/apps/trivia/lib/trivia-types";
import { apiFetch } from "@/app/lib/auth-client";

interface EventsLinkPayload {
  link: {
    oyamaEventId: string;
    oyamaEventName: string;
    syncMode: "automatic" | "manual";
    lastSyncedAt: string | null;
    error: string | null;
    publicPagePath: string | null;
  };
  availableEvents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: string;
    location?: string | null;
    _count: { tables: number; guests: number };
  }>;
}

function formatSyncTime(value: string | null): string {
  if (!value) return "Not synchronized yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synchronized yet";
  return `Last synchronized ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** Links a Trivia roster to EventSTUDIO's durable tables, seats, guests, and public RSVP page. */
export default function TriviaEventsLinkPanel({
  event,
  onRefresh,
  compact = false,
}: {
  event: TriviaEvent;
  onRefresh?: () => Promise<void> | void;
  compact?: boolean;
}) {
  const [payload, setPayload] = useState<EventsLinkPayload | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(event.linkedEventsEventId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unlinkArmed, setUnlinkArmed] = useState(false);

  async function loadLink() {
    try {
      const result = await apiFetch<EventsLinkPayload>(`/api/apps/trivia/events/${event.id}/events-link`);
      setPayload(result);
      setSelectedEventId(result.link.oyamaEventId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Oyama Events linkage.");
    }
  }

  useEffect(() => {
    void loadLink();
    // The event ID is the stable identity for this integration panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  async function linkEvent() {
    if (!selectedEventId) return;
    setBusy(true);
    setMessage("Linking and synchronizing tables…");
    try {
      await apiFetch(`/api/apps/trivia/events/${event.id}/events-link`, {
        method: "PATCH",
        body: JSON.stringify({ oyamaEventId: selectedEventId, syncMode: "automatic" }),
      });
      await loadLink();
      await onRefresh?.();
      setMessage("Connected. Oyama Events is now the table and RSVP source for this trivia night.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The event could not be linked.");
    } finally {
      setBusy(false);
    }
  }

  async function sync(direction: "from_events" | "to_events") {
    setBusy(true);
    setMessage(direction === "from_events" ? "Refreshing tables from Oyama Events…" : "Sending the reviewed Trivia roster to Oyama Events…");
    try {
      await apiFetch(`/api/apps/trivia/events/${event.id}/events-sync`, {
        method: "POST",
        body: JSON.stringify({ direction }),
      });
      await loadLink();
      await onRefresh?.();
      setMessage(direction === "from_events" ? "Tables and members refreshed." : "Trivia table changes saved to Oyama Events.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Roster synchronization failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!unlinkArmed) {
      setUnlinkArmed(true);
      setMessage("Tap Remove link again to confirm. Existing EventSTUDIO records will not be deleted.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/apps/trivia/events/${event.id}/events-link`, {
        method: "PATCH",
        body: JSON.stringify({ oyamaEventId: "" }),
      });
      setUnlinkArmed(false);
      await loadLink();
      await onRefresh?.();
      setMessage("Link removed. Existing records remain in both workspaces.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The link could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  const link = payload?.link;
  const linkedEvent = payload?.availableEvents.find((item) => item.id === link?.oyamaEventId);

  return (
    <section className={`border border-[#d1d1d1] bg-white text-[#242424] ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">EventSTUDIO connection</p>
          <h2 className={`${compact ? "text-base" : "text-lg"} mt-1 font-semibold text-[#242424]`}>
            {link?.oyamaEventId ? `${link.oyamaEventName || "Linked event"} roster` : "Use one table and RSVP source"}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#616161]">
            EventSTUDIO owns tables, seats, guests, public RSVP pages, and payment status. Trivia keeps questions, scoring, and projector flow.
          </p>
        </div>
        {link?.oyamaEventId ? (
          <span className="inline-flex w-fit items-center gap-2 border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" /> Automatic sync
          </span>
        ) : null}
      </div>

      {!link?.oyamaEventId ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={selectedEventId}
            onChange={(input) => setSelectedEventId(input.target.value)}
            className="min-h-12 w-full border border-[#8a8886] bg-white px-3 text-sm text-[#242424] outline-none focus:border-[#0f6cbd]"
          >
            <option value="">Choose an Oyama Events record…</option>
            {payload?.availableEvents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.type.replaceAll("_", " ")} · {candidate._count.tables} tables / {candidate._count.guests} guests
              </option>
            ))}
          </select>
          <button type="button" disabled={busy || !selectedEventId} onClick={() => void linkEvent()} className="min-h-12 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:bg-[#c8c6c4]">
            Connect event
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-2 border border-[#d1d1d1] bg-[#faf9f8] p-3 text-xs text-[#616161] sm:grid-cols-3">
            <div><span className="block">Event type</span><strong className="mt-1 block text-[#242424]">{linkedEvent?.type.replaceAll("_", " ") ?? "Event"}</strong></div>
            <div><span className="block">Roster</span><strong className="mt-1 block text-[#242424]">{linkedEvent?._count.tables ?? event.teams.length} tables · {linkedEvent?._count.guests ?? event.teams.reduce((sum, team) => sum + team.players.length, 0)} guests</strong></div>
            <div><span className="block">Status</span><strong className="mt-1 block text-[#242424]">{formatSyncTime(link?.lastSyncedAt ?? null)}</strong></div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" disabled={busy} onClick={() => void sync("from_events")} className="min-h-12 border border-[#0f6cbd] px-3 text-xs font-semibold text-[#0f6cbd] hover:bg-[#f2f7fc] disabled:opacity-50">Refresh roster</button>
            <button type="button" disabled={busy} onClick={() => void sync("to_events")} className="min-h-12 bg-[#0f6cbd] px-3 text-xs font-semibold text-white hover:bg-[#115ea3] disabled:opacity-50">Save to Events</button>
          </div>
        </div>
      )}

      {link?.oyamaEventId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/events/${link.oyamaEventId}/tables`} className="inline-flex min-h-11 items-center border border-[#d1d1d1] bg-white px-3 text-xs font-semibold text-[#242424] hover:bg-[#f5f5f5]">Manage tables & members in Events →</Link>
          <Link href={`/events/${link.oyamaEventId}/event-page`} className="inline-flex min-h-11 items-center border border-[#d1d1d1] bg-white px-3 text-xs font-semibold text-[#242424] hover:bg-[#f5f5f5]">Edit RSVP site →</Link>
          {link.publicPagePath ? <Link href={link.publicPagePath} target="_blank" className="inline-flex min-h-11 items-center border border-emerald-600 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Open live RSVP site ↗</Link> : null}
          <button type="button" disabled={busy} onClick={() => void unlink()} className={`min-h-11 border px-3 text-xs font-semibold disabled:opacity-50 ${unlinkArmed ? "border-rose-600 bg-rose-50 text-rose-800" : "border-[#8a8886] text-[#424242] hover:bg-[#f5f5f5]"}`}>{unlinkArmed ? "Confirm remove link" : "Remove link"}</button>
        </div>
      ) : null}

      {(message || link?.error) ? <p className={`mt-3 border-l-4 px-3 py-2 text-xs ${link?.error ? "border-amber-600 bg-amber-50 text-amber-900" : "border-[#0f6cbd] bg-[#f2f7fc] text-[#0f548c]"}`} aria-live="polite">{link?.error || message}</p> : null}
    </section>
  );
}
