// Trivia events list page for opening builder, host, score, and display routes.
"use client";

import Link from "next/link";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaEventsPage lists all persisted trivia events with operational route shortcuts.
 */
export default function TriviaEventsPage() {
  const { state, deleteEvent, updateEventStatus } = useTriviaModuleState();

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <h1 className="text-2xl font-semibold text-white">Trivia Events</h1>
        <p className="text-sm text-slate-300 mt-1">All events in the standalone trivia data store.</p>
      </header>

      <div className="space-y-3">
        {state.events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{event.name}</h2>
                <p className="text-sm text-slate-300 mt-1">{event.venue} • Host {event.hostName}</p>
                <p className="text-xs text-slate-400 mt-1">Status: {event.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => updateEventStatus(event.id, "live")} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black">Go Live</button>
                <button onClick={() => updateEventStatus(event.id, "completed")} className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-white">Complete</button>
                <button onClick={() => deleteEvent(event.id)} className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-1.5 text-xs text-white">Delete</button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
              <Link href={`/apps/trivia/events/${event.id}/builder`} className="rounded-lg border border-slate-600 bg-slate-950 hover:bg-slate-800 px-3 py-2 text-xs text-center text-white">Builder</Link>
              <Link href={`/apps/trivia/events/${event.id}/host`} className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-xs text-center text-emerald-100">Host Panel</Link>
              <Link href={`/apps/trivia/events/${event.id}/scores`} className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 px-3 py-2 text-xs text-center text-cyan-100">Scores</Link>
              <Link href={`/apps/trivia/events/${event.id}/answer-key`} className="rounded-lg border border-violet-500/50 bg-violet-500/15 hover:bg-violet-500/25 px-3 py-2 text-xs text-center text-violet-100">Answer Key</Link>
              <Link href={`/apps/trivia/display/${event.id}`} target="_blank" className="rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 text-xs text-center text-amber-100">Projector</Link>
              <Link href={`/apps/trivia/events/${event.id}/host`} className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 px-3 py-2 text-xs text-center text-fuchsia-100">Live Controls</Link>
            </div>
          </article>
        ))}

        {state.events.length === 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No events exist yet. Create your first event to start hosting live trivia.
          </div>
        ) : null}
      </div>
    </section>
  );
}
