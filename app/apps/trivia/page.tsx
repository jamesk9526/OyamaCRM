// Trivia dashboard for resuming the next useful planning or live operation.
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BarChart3, Gamepad2, Play, Plus, Settings2, Users } from "lucide-react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

export default function TriviaDashboardPage() {
  const { state } = useTriviaModuleState();
  const stats = useMemo(() => ({
    totalEvents: state.events.length,
    liveEvents: state.events.filter((event) => event.status === "live").length,
    totalTeams: state.events.reduce((count, event) => count + event.teams.length, 0),
    totalQuestions: state.events.reduce((count, event) => count + event.rounds.reduce((sum, round) => sum + round.questions.length, 0), 0),
  }), [state.events]);
  const recentEvents = state.events.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-[#d1d1d1] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold text-[#5c2d91]">OYAMA TRIVIA</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Trivia home</h1><p className="mt-1 max-w-2xl text-sm text-[#616161]">Build the game, open registration, and run the room from one event workspace.</p></div>
        <div className="flex gap-2"><Link href="/apps/trivia/events" className="event-studio-secondary-button"><Gamepad2 className="h-4 w-4" />All events</Link><Link href="/apps/trivia/events/new" className="trivia-primary-button"><Plus className="h-4 w-4" />New trivia event</Link></div>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden border border-[#d1d1d1] bg-[#d1d1d1] lg:grid-cols-4" aria-label="Trivia summary">
        {[["Events", stats.totalEvents], ["Live now", stats.liveEvents], ["Teams", stats.totalTeams], ["Questions", stats.totalQuestions]].map(([label, value]) => <article key={label} className="bg-white p-4"><p className="text-xs font-medium text-[#616161]">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></article>)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]">
        <section className="border border-[#d1d1d1] bg-white">
          <header className="flex items-center justify-between border-b border-[#e1dfdd] px-4 py-3"><div><h2 className="text-sm font-semibold">Resume an event</h2><p className="mt-0.5 text-xs text-[#616161]">Your most recent trivia workspaces</p></div><Link href="/apps/trivia/events" className="text-sm font-semibold text-[#5c2d91] hover:underline">View all</Link></header>
          {recentEvents.length ? <div className="divide-y divide-[#e1dfdd]">{recentEvents.map((event) => { const questions = event.rounds.reduce((sum, round) => sum + round.questions.length, 0); const route = event.status === "live" || event.status === "check_in_open" ? "host" : "overview"; return <Link key={event.id} href={`/apps/trivia/events/${event.id}/${route}`} className="flex items-center gap-3 p-4 hover:bg-[#fafafa]"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm ${event.status === "live" ? "bg-[#dff6dd] text-[#0b6a0b]" : "bg-[#f5f0f8] text-[#5c2d91]"}`}>{event.status === "live" ? <Play className="h-4 w-4" /> : <Gamepad2 className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{event.name}</strong><span className="mt-0.5 block truncate text-xs text-[#616161]">{event.teams.length} teams · {event.rounds.length} rounds · {questions} questions</span></span><span className="hidden text-xs capitalize text-[#616161] sm:block">{event.status.replaceAll("_", " ")}</span><ArrowRight className="h-4 w-4 shrink-0 text-[#616161]" /></Link>; })}</div> : <div className="p-8 text-center"><Gamepad2 className="mx-auto h-8 w-8 text-[#8a8886]" /><h3 className="mt-3 text-sm font-semibold">No trivia events yet</h3><p className="mt-1 text-sm text-[#616161]">Create one event and its EventSTUDIO registration page together.</p></div>}
        </section>

        <aside className="border border-[#d1d1d1] bg-white">
          <header className="border-b border-[#e1dfdd] px-4 py-3"><h2 className="text-sm font-semibold">Simple workflow</h2><p className="mt-0.5 text-xs text-[#616161]">Move left to right; live tools stay hidden until you need them.</p></header>
          <ol className="divide-y divide-[#edebe9]">
            {[{ icon: Settings2, title: "Build", text: "Add rounds, questions, answers, and media." }, { icon: Users, title: "Register", text: "Publish the linked page and bring in teams." }, { icon: Play, title: "Run", text: "Control the projector and game stages." }, { icon: BarChart3, title: "Score", text: "Review answers, update scores, and close out." }].map((step, index) => <li key={step.title} className="flex gap-3 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f5f0f8] text-xs font-semibold text-[#5c2d91]">{index + 1}</span><div><p className="text-sm font-semibold">{step.title}</p><p className="mt-0.5 text-xs leading-5 text-[#616161]">{step.text}</p></div></li>)}
          </ol>
        </aside>
      </div>
    </div>
  );
}
