"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, FileClock, FileOutput, Gamepad2, MonitorPlay, PencilRuler, Play, Radio, RefreshCw, ShieldCheck, Trophy, TriangleAlert, Users } from "lucide-react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { findTriviaEventForRoute, getActiveQuestion, getActiveRound } from "@/app/apps/trivia/lib/trivia-selectors";

function statusLabel(value: string): string { return value.replaceAll("_", " "); }

export default function EventTriviaPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state, syncMode, connectionStatus, lastSyncedAt, setSyncMode, refreshFromServer } = useTriviaModuleState();
  useEffect(() => { if (syncMode !== "server") setSyncMode("server"); }, [setSyncMode, syncMode]);
  const event = useMemo(() => findTriviaEventForRoute(state.events, eventId), [eventId, state.events]);

  if (!event) return <div className="mx-auto max-w-5xl p-5 sm:p-8"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Loading this event’s trivia workspace…</div></div>;

  const live = state.liveByEventId[event.id];
  const questions = event.rounds.flatMap((round) => round.questions);
  const incomplete = questions.filter((question) => !question.prompt.trim() || !question.scoringAnswer.trim()).length;
  const missingMedia = questions.filter((question) => ["image", "audio", "video"].includes(question.questionType) && !question.mediaUrl.trim()).length;
  const checkedIn = event.teams.filter((team) => team.checkInStatus === "checked_in").length;
  const activeRound = live ? getActiveRound(event, live) : null;
  const activeQuestion = live ? getActiveQuestion(event, live) : null;
  const scoreActions = state.scoreHistoryByEventId[event.id]?.length ?? 0;
  const checks = [
    { label: "Rounds planned", detail: `${event.rounds.length} configured`, ready: event.rounds.length > 0, href: `/events/${eventId}/trivia/builder` },
    { label: "Questions complete", detail: incomplete ? `${incomplete} need an answer` : `${questions.length} ready`, ready: questions.length > 0 && incomplete === 0, href: `/events/${eventId}/trivia/builder` },
    { label: "Question media", detail: missingMedia ? `${missingMedia} file${missingMedia === 1 ? "" : "s"} missing` : "Media ready", ready: missingMedia === 0, href: `/events/${eventId}/trivia/builder` },
    { label: "Team roster", detail: `${event.teams.length} team${event.teams.length === 1 ? "" : "s"}`, ready: event.teams.length > 0, href: `/events/${eventId}/tables` },
    { label: "Host assigned", detail: event.hostName || "Choose a host", ready: Boolean(event.hostName.trim()), href: `/events/${eventId}/settings` },
    { label: "Projector test", detail: live?.displayOpenedAt ? "Opened successfully" : "Not tested", ready: Boolean(live?.displayOpenedAt), href: `/events/${eventId}/trivia/projector`, external: true },
  ];
  const readyCount = checks.filter((check) => check.ready).length;
  const readinessPercent = Math.round((readyCount / checks.length) * 100);
  const sharedStateReady = syncMode === "server" && connectionStatus === "connected";
  const base = `/events/${eventId}/trivia`;
  const stations = [
    { group: "Prepare", title: "Game builder", text: "Rounds, questions, answers, timers, and media", href: `${base}/builder`, icon: PencilRuler },
    { group: "Doors", title: "Team check-in", text: "Expected teams, walk-ins, members, and tables", href: `${base}/check-in`, icon: ClipboardCheck },
    { group: "Live", title: "Host console", text: "Question flow, timer, reveals, and emergency hold", href: `${base}/host`, icon: Radio, primary: true },
    { group: "Live", title: "Scorekeeper", text: "Fast points, partial credit, corrections, and undo", href: `${base}/scores`, icon: BarChart3 },
    { group: "Review", title: "Judge answers", text: "Accepted answers and disputed-response decisions", href: `${base}/judge`, icon: ShieldCheck },
    { group: "Display", title: "Projector", text: "Audience-safe question and answer presentation", href: `${base}/projector`, icon: MonitorPlay, external: true },
    { group: "Display", title: "Scoreboard", text: "Rankings, score history, and leaderboard control", href: `${base}/scoreboard`, icon: Trophy },
    { group: "Safety", title: "Recovery", text: "Snapshots, sync status, audit trail, and restore", href: `${base}/recovery`, icon: FileClock },
  ];

  return (
    <div className="event-trivia-command-center mx-auto max-w-[1320px] space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="event-trivia-hero overflow-hidden rounded-3xl border border-indigo-200 bg-white">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-700"><Gamepad2 className="h-4 w-4" />Trivia night command center <span className="rounded-full bg-white/70 px-2.5 py-1 capitalize text-slate-600">{statusLabel(event.status)}</span></div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Prepare it once. Run it calmly.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">One launch point for the producer, check-in desk, host, scorekeeper, judge, and projector. Registration, guests, and tables stay attached to this Event.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href={`${base}/host`} prefetch={false} className="event-trivia-primary-action"><Play className="h-4 w-4" />Open host console</Link><Link href={`${base}/projector`} prefetch={false} target="_blank" rel="noopener noreferrer" className="event-trivia-secondary-action"><MonitorPlay className="h-4 w-4" />Test projector</Link><button type="button" onClick={() => void refreshFromServer()} className="event-trivia-secondary-action"><RefreshCw className="h-4 w-4" />Refresh live state</button></div>
          </div>
          <aside className="rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur" aria-label="Trivia readiness summary">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Night readiness</p><p className="mt-1 text-3xl font-bold text-slate-950">{readinessPercent}%</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${sharedStateReady ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{sharedStateReady ? "Live sync ready" : "Sync needs attention"}</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500" style={{ width: `${readinessPercent}%` }} /></div>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center"><div><dt className="text-[11px] text-slate-500">Teams</dt><dd className="mt-1 text-lg font-bold">{event.teams.length}</dd></div><div><dt className="text-[11px] text-slate-500">Checked in</dt><dd className="mt-1 text-lg font-bold">{checkedIn}</dd></div><div><dt className="text-[11px] text-slate-500">Questions</dt><dd className="mt-1 text-lg font-bold">{questions.length}</dd></div></dl>
          </aside>
        </div>
      </section>

      {!sharedStateReady ? <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Do not begin the live game yet</p><p className="mt-0.5 text-xs text-rose-700">Host, projector, and scoring screens must share server state. Current connection: {connectionStatus}.</p></div></div><button type="button" onClick={() => setSyncMode("server")} className="min-h-9 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white">Use server sync</button></section> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.75fr)]">
        <section className="event-trivia-panel rounded-2xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">Event-night stations</p><h3 className="mt-1 text-xl font-bold">Open the workspace for each role</h3></div><Link href={`${base}/printables`} prefetch={false} className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 hover:text-indigo-900"><FileOutput className="h-4 w-4" />Print host packet</Link></header>
          <div className="grid gap-px overflow-hidden rounded-b-2xl bg-slate-200 sm:grid-cols-2">{stations.map((station) => { const Icon = station.icon; return <Link key={station.title} href={station.href} prefetch={false} target={station.external ? "_blank" : undefined} rel={station.external ? "noopener noreferrer" : undefined} className={`event-trivia-station group bg-white p-5 ${station.primary ? "is-primary" : ""}`}><span className="flex items-start gap-4"><span className="event-trivia-station-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{station.group}</span><strong className="mt-1 block text-sm text-slate-950">{station.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{station.text}</span></span><ArrowRight className="mt-3 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-700" /></span></Link>; })}</div>
        </section>

        <div className="space-y-5">
          <section className="event-trivia-panel rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">Preflight</p><h3 className="mt-1 text-lg font-bold">Before doors open</h3></div><span className="text-xs font-bold text-slate-500">{readyCount}/{checks.length} ready</span></div><ul className="mt-4 space-y-2">{checks.map((check) => <li key={check.label}><Link href={check.href} prefetch={false} target={check.external ? "_blank" : undefined} rel={check.external ? "noopener noreferrer" : undefined} className="flex items-center gap-3 rounded-xl border border-transparent p-2.5 hover:border-slate-200 hover:bg-slate-50">{check.ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />}<span className="min-w-0 flex-1"><strong className="block text-sm">{check.label}</strong><span className="block truncate text-xs text-slate-500">{check.detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-slate-300" /></Link></li>)}</ul></section>

          <section className="event-trivia-panel rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">Live snapshot</p><h3 className="mt-1 text-lg font-bold">What is happening now</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Display</dt><dd className="font-bold capitalize">{live ? statusLabel(live.stage) : "Not started"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Round</dt><dd className="max-w-[60%] truncate font-bold">{activeRound?.title ?? "Not selected"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Question</dt><dd className="font-bold">{activeQuestion && live ? `${live.activeQuestionIndex + 1} of ${activeRound?.questions.length ?? 0}` : "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Score changes</dt><dd className="font-bold">{scoreActions}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Last sync</dt><dd className="font-bold">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not yet"}</dd></div></dl></section>
        </div>
      </div>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 text-indigo-700" /><div><p className="text-sm font-bold text-indigo-950">Teams and guests stay in Event Studio</p><p className="mt-1 text-xs text-indigo-800">Use one roster for registration, tables, check-in, Trivia scoring, and follow-up.</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/events/${eventId}/tables`} className="event-trivia-secondary-action">Manage tables</Link><Link href={`/events/${eventId}/registration`} className="event-trivia-secondary-action">Registration settings</Link></div></div></section>
    </div>
  );
}
