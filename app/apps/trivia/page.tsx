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
  const { state, createSampleEvent } = useTriviaModuleState();

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
      <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Standalone Oyama Add-on</p>
        <h1 className="text-3xl font-semibold text-white mt-2">Trivia Command Dashboard</h1>
        <p className="text-sm text-slate-300 mt-1">
          Production working mode: create events, run host controls, and launch projector-safe display.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Total Events</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalEvents}</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Live Events</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.liveEvents}</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Registered Teams</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{stats.totalTeams}</p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Questions Built</p>
          <p className="text-2xl font-bold text-fuchsia-300 mt-1">{stats.totalQuestions}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/apps/trivia/events/new" className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-4 hover:bg-emerald-500/25 transition-colors">
          <h2 className="text-lg font-semibold text-emerald-100">Create Trivia Event</h2>
          <p className="text-sm text-emerald-200/90 mt-1">Set host, venue, rounds, and teams for your next game night.</p>
        </Link>
        <Link href="/apps/trivia/events" className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 p-4 hover:bg-cyan-500/25 transition-colors">
          <h2 className="text-lg font-semibold text-cyan-100">Manage Existing Events</h2>
          <p className="text-sm text-cyan-200/90 mt-1">Open builder, host panel, scoring, answer keys, and display routes.</p>
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick Start Templates</h2>
            <p className="text-sm text-slate-300 mt-1">Create a sample event with normal, picture, audio, final wager, and tiebreaker rounds.</p>
          </div>
          <button
            type="button"
            onClick={() => createSampleEvent()}
            className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-2 text-xs font-semibold text-white"
          >
            Create Sample Event
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-white">Live Operations Checklist</h2>
        <p className="text-sm text-slate-300">Open any event builder for the full 17-step runbook and complete flow sequence.</p>
      </section>
    </section>
  );
}
