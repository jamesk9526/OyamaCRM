// Trivia events list page for opening builder, host, score, and display routes.
"use client";

import Link from "next/link";
import { useState } from "react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaEventsPage lists all persisted trivia events with operational route shortcuts.
 */
export default function TriviaEventsPage() {
  const { state, deleteEvent, updateEventStatus } = useTriviaModuleState();
  const [armedAction, setArmedAction] = useState<string | null>(null);

  function guardedAction(key: string, action: () => void) {
    if (armedAction !== key) {
      setArmedAction(key);
      return;
    }
    action();
    setArmedAction(null);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <h1 className="text-2xl font-semibold text-white">Trivia Events</h1>
        <p className="text-sm text-slate-300 mt-1">All events in the standalone trivia data store.</p>
      </header>

      <div className="space-y-3">
        {state.events.map((event) => (
          <article key={event.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            {(() => {
              const questionCount = event.rounds.reduce((total, round) => total + round.questions.length, 0);
              const reviewCount = Number(event.rounds.length === 0) + Number(questionCount === 0) + Number(event.teams.length === 0) + Number(!event.linkedEventsEventId);
              const liveKey = `live:${event.id}`;
              const completeKey = `complete:${event.id}`;
              const deleteKey = `delete:${event.id}`;
              return <>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{event.name}</h2>
                <p className="text-sm text-slate-300 mt-1">{event.venue} • Host {event.hostName}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">{event.status.replaceAll("_", " ")}</span><span className={reviewCount ? "rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-amber-200" : "rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200"}>{reviewCount ? `${reviewCount} setup checks` : "Ready to run"}</span><span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-cyan-200">{event.teams.length} teams · {event.rounds.length} rounds · {questionCount} questions</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => guardedAction(liveKey, () => updateEventStatus(event.id, "live"))} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black">{armedAction === liveKey ? "Confirm Go Live" : "Go Live"}</button>
                <button onClick={() => guardedAction(completeKey, () => updateEventStatus(event.id, "completed"))} className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-white">{armedAction === completeKey ? "Confirm Complete" : "Complete"}</button>
                <button onClick={() => guardedAction(deleteKey, () => deleteEvent(event.id))} className={`rounded-lg px-3 py-1.5 text-xs text-white ${armedAction === deleteKey ? "bg-rose-500 ring-2 ring-rose-300" : "bg-rose-800 hover:bg-rose-700"}`}>{armedAction === deleteKey ? "Delete permanently" : "Delete"}</button>
              </div>
            </div>

            {armedAction === liveKey && reviewCount > 0 ? <p className="mt-3 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">This event still has {reviewCount} readiness check{reviewCount === 1 ? "" : "s"}. Confirm only if the host has reviewed the missing setup.</p> : null}
            {armedAction === deleteKey ? <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">This permanently removes Trivia game content and score history. The linked EventSTUDIO RSVP record is retained for audit and guest follow-up.</p> : null}

            <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
              <Link href={`/apps/trivia/events/${event.id}/builder`} className="rounded-lg border border-slate-600 bg-slate-950 hover:bg-slate-800 px-3 py-2 text-xs text-center text-white">Builder</Link>
              <Link href={`/apps/trivia/events/${event.id}/host`} className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-xs text-center text-emerald-100">Host Panel</Link>
              <Link href={`/apps/trivia/events/${event.id}/scores`} className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 px-3 py-2 text-xs text-center text-cyan-100">Scores</Link>
              <Link href={`/apps/trivia/events/${event.id}/answer-key`} className="rounded-lg border border-violet-500/50 bg-violet-500/15 hover:bg-violet-500/25 px-3 py-2 text-xs text-center text-violet-100">Answer Key</Link>
              <Link href={`/apps/trivia/display/${event.id}`} target="_blank" className="rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 text-xs text-center text-amber-100">Projector</Link>
              <Link href={`/apps/trivia/events/${event.id}/host`} className="rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 px-3 py-2 text-xs text-center text-fuchsia-100">Live Controls</Link>
            </div>
            </>;
            })()}
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
