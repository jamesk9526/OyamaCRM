// Trivia dashboard route for live event quick actions and health overview.
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaDashboardPage is the standalone add-on landing view for quick event operations.
 * It uses persisted trivia data and does not depend on CRM models.
 */
export default function TriviaDashboardPage() {
  const { state } = useTriviaModuleState();

  const stats = useMemo(() => {
    const totalEvents = state.events.length;
    const liveEvents = state.events.filter((event) => event.status === "live").length;
    const totalTeams = state.events.reduce((count, event) => count + event.teams.length, 0);
    const totalQuestions = state.events.reduce(
      (count, event) => count + event.rounds.reduce((roundCount, round) => roundCount + round.questions.length, 0),
      0
    );

    return { totalEvents, liveEvents, totalTeams, totalQuestions };
  }, [state.events]);

  return (
    <section className="space-y-4">
      <header className="border border-slate-700 bg-slate-900/70 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Standalone Oyama Add-on</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Trivia Command Dashboard</h1>
        <p className="mt-1 text-sm text-slate-300">
          Production working mode: create events, run host controls, and launch projector-safe display.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <article className="border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Total Events</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.totalEvents}</p>
        </article>
        <article className="border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Live Events</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.liveEvents}</p>
        </article>
        <article className="border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Registered Teams</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{stats.totalTeams}</p>
        </article>
        <article className="border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Questions Built</p>
          <p className="mt-1 text-2xl font-bold text-fuchsia-300">{stats.totalQuestions}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/apps/trivia/events/new" className="border border-emerald-400/40 bg-emerald-500/15 p-4 transition-colors hover:bg-emerald-500/25">
          <h2 className="text-lg font-semibold text-white">Create Trivia Event</h2>
          <p className="mt-1 text-sm text-emerald-100">Set host, venue, rounds, and teams for your next game night.</p>
        </Link>
        <Link href="/apps/trivia/events" className="border border-cyan-400/40 bg-cyan-500/15 p-4 transition-colors hover:bg-cyan-500/25">
          <h2 className="text-lg font-semibold text-cyan-100">Manage Existing Events</h2>
          <p className="mt-1 text-sm text-cyan-100">Open builder, host panel, scoring, answer keys, and display routes.</p>
        </Link>
      </div>
    </section>
  );
}
