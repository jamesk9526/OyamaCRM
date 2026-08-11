// Main Night-of Operations dashboard for a single trivia event.

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, ClipboardCheck, FileOutput, MonitorPlay, Radio, Settings2, ShieldCheck, Trophy, Users } from "lucide-react";
import type { TriviaEvent, TriviaLiveState, TriviaScoreAction } from "@/app/apps/trivia/lib/trivia-types";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";
import TriviaEventsLinkPanel from "@/app/components/trivia/TriviaEventsLinkPanel";

interface TriviaOverviewWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
  onRefreshFromServer?: () => Promise<void>;
}

/** Presents mission-control quick actions and event-night situational metrics. */
export default function TriviaOverviewWorkspace({ event, live, scoreHistory, onRefreshFromServer }: TriviaOverviewWorkspaceProps) {
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
      <TriviaEventsLinkPanel event={event} onRefresh={onRefreshFromServer} />

      <section className="trivia-dark-card border border-[#d1c7e8] bg-white"><header className="border-b border-[#d1c7e8] bg-[#f6f2ff] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b3f9b]">Event readiness</p><h2 className="mt-1 text-lg font-semibold text-slate-900">What to finish before doors open</h2></header><div className="grid gap-px bg-[#d1c7e8] sm:grid-cols-2 xl:grid-cols-3">{readiness.map((item) => <div key={item.label} className="bg-white px-4 py-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{item.label}</p><span className={item.ready ? "border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800" : "border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800"}>{item.ready ? "Ready" : "Review"}</span></div><p className="mt-1 text-xs text-slate-600">{item.detail}</p></div>)}</div></section>

      <section className="border border-[#d1d1d1] bg-white">
        <header className="border-b border-[#e1dfdd] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5c2d91]">Workspace</p><h2 className="mt-1 text-lg font-semibold">Choose the next task</h2><p className="mt-1 text-xs text-[#616161]">Planning tools come first; live controls stay together for event night.</p></header>
        <div className="grid gap-px bg-[#e1dfdd] md:grid-cols-2">
          {[
            { group: "Prepare", title: "Game builder", text: "Rounds, questions, answers, and media.", href: `${base}/builder`, icon: Settings2 },
            { group: "Prepare", title: "Registration", text: "Public signup, team pricing, and roster sync.", href: `${base}/registration`, icon: Users },
            { group: "Run", title: "Check-in", text: "Expected teams, walk-ins, table assignments.", href: `${base}/check-in`, icon: ClipboardCheck },
            { group: "Run", title: "Host controls", text: "Stages, timer, projector, and emergency blank.", href: `${base}/host`, icon: Radio },
            { group: "Run", title: "Scorekeeper", text: "Fast scoring, corrections, and undo history.", href: `${base}/scores`, icon: BarChart3 },
            { group: "Run", title: "Judge answers", text: "Accepted answers and partial-credit review.", href: `${base}/judge`, icon: ShieldCheck },
            { group: "Display", title: "Scoreboard", text: "Private ranking and leaderboard controls.", href: `${base}/scoreboard`, icon: Trophy },
            { group: "Display", title: "Projector", text: "Open the audience-safe presentation screen.", href: `/apps/trivia/display/${event.id}`, icon: MonitorPlay, external: true },
            { group: "Close", title: "Answer key", text: "Host notes, accepted alternatives, reveal copy.", href: `${base}/answer-key`, icon: BookOpenCheck },
            { group: "Close", title: "Print & backups", text: "Host packet, roster, score sheets, and exports.", href: `${base}/printables`, icon: FileOutput },
          ].map((action) => { const Icon = action.icon; return <Link key={action.title} href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noopener noreferrer" : undefined} className="group flex min-w-0 items-center gap-3 bg-white p-4 hover:bg-[#fafafa]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[#f5f0f8] text-[#5c2d91]"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#616161]">{action.group}</span><strong className="mt-0.5 block text-sm">{action.title}</strong><span className="mt-0.5 block truncate text-xs text-[#616161]">{action.text}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#8a8886] group-hover:text-[#5c2d91]" /></Link>; })}
        </div>
      </section>

      <div className="trivia-dark-card border border-[#d1c7e8] bg-white p-4">
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
