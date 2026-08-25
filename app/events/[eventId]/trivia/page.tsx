"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Gamepad2, MonitorPlay, Play, TriangleAlert } from "lucide-react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

export default function EventTriviaPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state, syncMode, setSyncMode } = useTriviaModuleState();
  useEffect(() => { if (syncMode !== "server") setSyncMode("server"); }, [setSyncMode, syncMode]);
  const event = useMemo(() => state.events.find((item) => item.id === eventId || item.linkedEventsEventId === eventId) ?? null, [eventId, state.events]);
  if (!event) return <div className="mx-auto max-w-4xl p-5 sm:p-8"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Loading this event’s trivia setup…</div></div>;
  const questions = event.rounds.reduce((count, round) => count + round.questions.length, 0);
  const incomplete = event.rounds.reduce((count, round) => count + round.questions.filter((question) => !question.prompt.trim() || !question.scoringAnswer.trim()).length, 0);
  const checks = [{ label: `${event.rounds.length} rounds`, ready: event.rounds.length > 0 }, { label: `${questions} questions`, ready: questions > 0 }, { label: `${event.teams.length} teams from event tables`, ready: event.teams.length > 0 }, { label: incomplete ? `${incomplete} incomplete questions` : "Questions complete", ready: incomplete === 0 && questions > 0 }];
  return <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8"><header><div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><Gamepad2 className="h-4 w-4" />Trivia night</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Build and run the game</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Questions, scoring, host controls, and projector state live here. Guests, tables, payments, and check-in remain owned by this Event.</p></header>
    <section className="grid gap-8 border-t border-slate-200 pt-7 md:grid-cols-[1fr_auto]"><div><h3 className="font-semibold">Game readiness</h3><ul className="mt-4 space-y-3">{checks.map((check) => <li key={check.label} className="flex items-center gap-2 text-sm">{check.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <TriangleAlert className="h-5 w-5 text-amber-600" />}<span>{check.label}</span></li>)}</ul></div><Link href={`/events/${eventId}/trivia/builder`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">Open trivia builder</Link></section>
    <section className="border-t border-slate-200 pt-7"><h3 className="font-semibold">Event night</h3><p className="mt-1 text-sm text-slate-500">Keep the live console sparse and open the audience display in a separate window.</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/events/${eventId}/trivia/host`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"><Play className="h-4 w-4" />Launch host console</Link><Link href={`/events/${eventId}/trivia/projector`} target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold hover:bg-slate-50"><MonitorPlay className="h-4 w-4" />Open projector</Link></div></section>
  </div>;
}
