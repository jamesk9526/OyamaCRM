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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    const nextEvent = createEvent({
      name: name.trim(),
      venue: venue.trim(),
      hostName: hostName.trim(),
      startAt: new Date(startAt).toISOString(),
    });

    router.push(`/apps/trivia/events/${nextEvent.id}/builder`);
  }

  return (
    <section className="max-w-2xl space-y-4">
      <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <h1 className="text-2xl font-semibold text-white">Create Trivia Event</h1>
        <p className="text-sm text-slate-300 mt-1">This writes directly to persistent standalone trivia storage.</p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Host name" className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
        <button type="submit" className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black">Create and Open Builder</button>
      </form>
    </section>
  );
}
