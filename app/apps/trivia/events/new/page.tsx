// New trivia event creation route for fully working event setup.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaEventCreatePage creates persisted trivia events with no demo dependencies.
 */
export default function TriviaEventCreatePage() {
  const router = useRouter();
  const { createEvent } = useTriviaModuleState();

  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [hostName, setHostName] = useState("");
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 16));
  const [maximumTables, setMaximumTables] = useState(30);
  const [seatsPerTable, setSeatsPerTable] = useState(6);
  const [tablePrice, setTablePrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const nextEvent = await createEvent({
        name: name.trim(),
        venue: venue.trim(),
        hostName: hostName.trim(),
        startAt: new Date(startAt).toISOString(),
        maximumTables,
        seatsPerTable,
        tablePrice,
      });
      router.push(`/apps/trivia/events/${nextEvent.id}/overview?created=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The connected event could not be created.");
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-4">
      <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <h1 className="text-2xl font-semibold text-white">Create Trivia Event</h1>
        <p className="text-sm text-slate-300 mt-1">One setup creates the Trivia game, its EventSTUDIO workspace, and a live public RSVP page.</p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-300">Event name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Community Trivia Night" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-300">Venue<input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Community Center" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-semibold text-slate-300">Host<input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Host name" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        </div>
        <label className="block text-xs font-semibold text-slate-300">Doors open<input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-300">Maximum teams<input type="number" min={1} max={500} value={maximumTables} onChange={(e) => setMaximumTables(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-semibold text-slate-300">Players per team<input type="number" min={1} max={50} value={seatsPerTable} onChange={(e) => setSeatsPerTable(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="block text-xs font-semibold text-slate-300">Price per team<input type="number" min={0} step="0.01" value={tablePrice} onChange={(e) => setTablePrice(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        </div>
        <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">The public page opens immediately. Free RSVPs are confirmed online; paid team reservations are recorded for staff payment follow-up.</div>
        {error ? <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">{error}</p> : null}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">{saving ? "Creating connected event…" : "Create Event, Trivia & RSVP Site"}</button>
      </form>
    </section>
  );
}
