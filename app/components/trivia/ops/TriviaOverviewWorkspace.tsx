// Main Night-of Operations dashboard for a single trivia event.

import Link from "next/link";
import type { TriviaEvent, TriviaLiveState, TriviaScoreAction } from "@/app/apps/trivia/lib/trivia-types";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaOverviewWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
}

/** Presents mission-control quick actions and event-night situational metrics. */
export default function TriviaOverviewWorkspace({ event, live, scoreHistory }: TriviaOverviewWorkspaceProps) {
  const base = `/apps/trivia/events/${event.id}`;
  const questions = event.rounds.flatMap((round) => round.questions);
  const missingAnswers = questions.filter((question) => !question.scoringAnswer.trim()).length;
  const mediaQuestions = questions.filter((question) => ["image", "audio", "video"].includes(question.questionType));
  const missingMedia = mediaQuestions.filter((question) => !question.mediaUrl.trim()).length;
  const readiness = [
    { label: "Rounds planned", detail: `${event.rounds.length} configured`, ready: event.rounds.length > 0 },
    { label: "Questions written", detail: `${questions.length} total`, ready: questions.length > 0 },
    { label: "Answer key", detail: missingAnswers ? `${missingAnswers} answer${missingAnswers === 1 ? "" : "s"} missing` : "Complete", ready: missingAnswers === 0 && questions.length > 0 },
    { label: "Media checks", detail: missingMedia ? `${missingMedia} media link${missingMedia === 1 ? "" : "s"} missing` : mediaQuestions.length ? "Media linked" : "No media questions", ready: missingMedia === 0 },
    { label: "Teams", detail: `${event.teams.length} configured`, ready: event.teams.length > 0 },
    { label: "Projector", detail: live.displayOpenedAt ? "Opened this session" : "Not tested yet", ready: Boolean(live.displayOpenedAt) },
  ];

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <section className="border border-[#d1c7e8] bg-white"><header className="border-b border-[#d1c7e8] bg-[#f6f2ff] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Event readiness</p><h2 className="mt-1 text-lg font-semibold text-slate-900">What to finish before doors open</h2></header><div className="grid gap-px bg-[#d1c7e8] sm:grid-cols-2 xl:grid-cols-3">{readiness.map((item) => <div key={item.label} className="bg-white px-4 py-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{item.label}</p><span className={item.ready ? "border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800" : "border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800"}>{item.ready ? "Ready" : "Review"}</span></div><p className="mt-1 text-xs text-slate-600">{item.detail}</p></div>)}</div></section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link href={`${base}/check-in`} className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15 p-4 hover:bg-fuchsia-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-fuchsia-200">Night Of</p>
          <h2 className="text-lg font-semibold text-white mt-1">Check-In Open</h2>
          <p className="mt-1 text-sm text-fuchsia-100/90">Front desk workflow for expected, late, and walk-in teams.</p>
        </Link>

        <Link href={`${base}/host`} className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-4 hover:bg-emerald-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-emerald-200">Night Of</p>
          <h2 className="text-lg font-semibold text-white mt-1">Host Panel</h2>
          <p className="mt-1 text-sm text-emerald-100/90">Run stage flow, timer, emergency blank, and projector controls.</p>
        </Link>

        <Link href={`${base}/scores`} className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 p-4 hover:bg-cyan-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-cyan-200">Night Of</p>
          <h2 className="text-lg font-semibold text-white mt-1">Scorekeeper</h2>
          <p className="mt-1 text-sm text-cyan-100/90">Fast scoring actions, per-team controls, and undo workflows.</p>
        </Link>

        <Link href={`${base}/judge`} className="rounded-xl border border-violet-500/40 bg-violet-500/15 p-4 hover:bg-violet-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-violet-200">Night Of</p>
          <h2 className="text-lg font-semibold text-white mt-1">Judge / Answer Review</h2>
          <p className="mt-1 text-sm text-violet-100/90">Review accepted answers and award correct/partial scoring safely.</p>
        </Link>

        <Link href={`${base}/scoreboard`} className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 hover:bg-amber-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">Night Of</p>
          <h2 className="text-lg font-semibold text-white mt-1">Live Scoreboards</h2>
          <p className="mt-1 text-sm text-amber-100/90">Host-private ranking plus projector-ready leaderboard launchers.</p>
        </Link>

        <Link href={`/apps/trivia/display/${event.id}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-500/40 bg-slate-700/20 p-4 hover:bg-slate-700/35 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-slate-300">Display</p>
          <h2 className="text-lg font-semibold text-white mt-1">Projector Display</h2>
          <p className="mt-1 text-sm text-slate-200/90">Audience-safe game screen with stage-driven rendering.</p>
        </Link>

        <Link href={`${base}/answer-key`} className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 p-4 hover:bg-indigo-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-indigo-200">Operations</p>
          <h2 className="text-lg font-semibold text-white mt-1">Answer Key</h2>
          <p className="mt-1 text-sm text-indigo-100/90">Private host notes, accepted alternates, and reveal copy.</p>
        </Link>

        <Link href={`${base}/recovery`} className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 hover:bg-rose-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-rose-200">Operations</p>
          <h2 className="text-lg font-semibold text-white mt-1">Recovery</h2>
          <p className="mt-1 text-sm text-rose-100/90">Snapshots, restore tools, emergency export, and audit timeline.</p>
        </Link>

        <Link href={`${base}/printables`} className="rounded-xl border border-sky-500/40 bg-sky-500/15 p-4 hover:bg-sky-500/25 transition-colors">
          <p className="text-[11px] uppercase tracking-wide text-sky-200">Operations</p>
          <h2 className="text-lg font-semibold text-white mt-1">Printables</h2>
          <p className="mt-1 text-sm text-sky-100/90">Host packet, answer key, check-in roster, and score sheets.</p>
        </Link>
      </div>

      <div className="border border-[#d1c7e8] bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Operational status</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          <li>{event.teams.length === 0 ? "No teams configured yet." : `${event.teams.length} teams configured.`}</li>
          <li>{event.rounds.length === 0 ? "No rounds configured yet." : `${event.rounds.length} rounds configured.`}</li>
          <li>{live.displayOpenedAt ? "Projector has been opened during this session." : "Projector has not been opened yet."}</li>
          <li>{live.lastHostAction ? `Last host action: ${live.lastHostAction}` : "No host actions yet."}</li>
        </ul>
      </div>
    </section>
  );
}
