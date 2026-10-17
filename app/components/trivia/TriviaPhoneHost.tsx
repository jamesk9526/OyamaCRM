"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Check, CircleHelp, Coffee, Eye, EyeOff, Flag, List, Monitor, ShieldAlert, Trophy, X, type LucideIcon } from "lucide-react";
import type { TriviaEvent, TriviaLiveState, TriviaDisplayStage } from "@/app/apps/trivia/lib/trivia-types";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";

type Props = {
  event: TriviaEvent & { live: TriviaLiveState };
  disabled: boolean;
  pendingAction: string | null;
  action: (name: string, payload?: Record<string, unknown>) => Promise<boolean>;
  guardedAction: (name: string, payload?: Record<string, unknown>) => void;
};
const tile = "flex w-full min-h-16 min-w-0 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 shadow-[0_3px_0_#080610,inset_0_1px_0_#ffffff15] transition-[transform,background-color] motion-reduce:transition-none enabled:active:translate-y-0.5 text-center text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-40";

export default function TriviaPhoneHost({ event, disabled, pendingAction, action, guardedAction }: Props) {
  const live = event.live;
  const round = event.rounds.find((item) => item.id === live.activeRoundId);
  const roundIndex = event.rounds.findIndex((item) => item.id === live.activeRoundId);
  const previousRound = event.rounds[roundIndex - 1];
  const nextRound = roundIndex >= 0 ? event.rounds[roundIndex + 1] : undefined;
  const question = round?.questions[live.activeQuestionIndex];
  const [selector, setSelector] = useState<"round" | "question" | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, selector !== null, () => setSelector(null));

  function control(label: string, Icon: LucideIcon, name: string, payload: Record<string, unknown> = {}, options: { guard?: boolean; active?: boolean; unavailable?: boolean; className?: string } = {}) {
    const confirming = pendingAction === `${name}:${JSON.stringify(payload)}`;
    return <button type="button" disabled={disabled || options.unavailable} aria-pressed={options.active} onClick={() => options.guard ? guardedAction(name, payload) : void action(name, payload)} className={`${tile} ${options.className ?? ""} ${confirming ? "border-amber-300 bg-amber-400/20 text-amber-100" : options.active ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-[#8067b7] bg-[#211833] text-white hover:bg-[#302247]"}`}><Icon size={20} className="shrink-0" aria-hidden="true" /><span>{confirming ? `Confirm ${label.toLowerCase()}` : label}</span></button>;
  }
  const stages: Array<[TriviaDisplayStage, string, LucideIcon]> = [
    ["check_in_open", "Check-in open", Check], ["check_in_closed", "Check-in closed", X],
    ["welcome", "Welcome", Monitor], ["round_intro", "Round intro", Flag], [round?.roundType === "final_wager" ? "final_question" : round?.roundType === "tiebreaker" ? "tiebreaker" : "question", "Question", CircleHelp],
    ["answer", "Reveal answer", Eye], ["explanation", "Explanation", List], ["leaderboard", "Leaderboard", Trophy],
    ["break", "Break", Coffee], ["blank", "Blank screen", EyeOff],
  ];
  return <>
    <section className="space-y-4">
      <div className="rounded-2xl border border-cyan-200/20 bg-[#090f19] p-4 shadow-[inset_0_2px_8px_#00000080]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Projector · {live.stage.replaceAll("_", " ")}</p>
        <p className="mt-2 text-xs text-slate-300">Round {roundIndex + 1} / {event.rounds.length} · Question {question ? live.activeQuestionIndex + 1 : 0} / {round?.questions.length ?? 0}</p>
        <p className="mt-1 break-words font-semibold">{round?.title || "Choose round"}</p>
        <p className="mt-2 max-h-32 overflow-y-auto break-words text-sm leading-relaxed text-slate-200">{question?.prompt || "Choose a round with questions to begin."}</p>
      </div>
      <div role="group" aria-label="Question and round navigation" className="mx-auto grid aspect-square w-full max-w-[340px] grid-cols-3 grid-rows-3 gap-1 rounded-full border border-[#63517e] bg-[#0d0a16] p-3 shadow-[inset_0_2px_10px_#00000090,0_5px_0_#080610]">
        <div className="col-start-2 flex">{control("Previous round", ChevronUp, "set_round", { roundId: previousRound?.id ?? "" }, { guard: true, unavailable: !previousRound, className: "!py-1 !gap-1 rounded-t-[3rem] text-xs" })}</div>
        <div className="col-start-1 row-start-2 flex">{control("Previous", ArrowLeft, "previous_question", {}, { guard: true, unavailable: !question || live.activeQuestionIndex === 0, className: "!py-1 !gap-1 rounded-l-[3rem] text-xs" })}</div>
        <div className="col-start-2 row-start-2 flex">{control("Reveal answer", Eye, "set_stage", { stage: "answer" }, { guard: true, active: live.stage === "answer", unavailable: !question, className: "!py-1 !gap-1 rounded-full border-cyan-300 bg-cyan-950 text-xs" })}</div>
        <div className="col-start-3 row-start-2 flex">{control("Next question", ArrowRight, "next_question", {}, { guard: true, unavailable: !question || live.activeQuestionIndex >= (round?.questions.length ?? 0) - 1, className: "!py-1 !gap-1 rounded-r-[3rem] text-xs" })}</div>
        <div className="col-start-2 row-start-3 flex">{control("Next round", ChevronDown, "set_round", { roundId: nextRound?.id ?? "" }, { guard: true, unavailable: !nextRound, className: "!py-1 !gap-1 rounded-b-[3rem] text-xs" })}</div>
      </div>
      <p className="text-center text-xs text-[#d9cffa]" role="status">{pendingAction ? "Tap the highlighted key again to confirm." : "Tap twice to change questions, rounds, or reveal."}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSelector("round")} className={`${tile} border-[#8067b7] bg-[#211833]`}><Flag size={20} aria-hidden="true" /><span>Change round</span></button>
        <button type="button" onClick={() => setSelector("question")} disabled={!round?.questions.length} className={`${tile} border-[#8067b7] bg-[#211833]`}><List size={20} aria-hidden="true" /><span>Jump to question</span></button>
      </div>
    </section>
    <section aria-label="Projector controls" className="grid grid-cols-3 gap-2">{stages.filter(([stage]) => !["answer", "check_in_open", "check_in_closed", "welcome", "round_intro"].includes(stage)).map(([stage, label, Icon]) => <div key={stage}>{control(label, Icon, "set_stage", { stage }, { active: live.stage === stage, guard: ["explanation", "leaderboard"].includes(stage), unavailable: ["question", "final_question", "tiebreaker", "explanation"].includes(stage) && !question })}</div>)}</section>
    <details className="rounded-2xl border border-[#4b3975] bg-[#161126] p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">More projector controls</summary><div className="mt-2 grid grid-cols-2 gap-2">{stages.filter(([stage]) => ["check_in_open", "check_in_closed", "welcome", "round_intro"].includes(stage)).map(([stage, label, Icon]) => <div key={stage}>{control(label, Icon, "set_stage", { stage }, { active: live.stage === stage })}</div>)}</div></details>
    <details className="rounded-xl border border-[#4b3975] p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Private answer & host notes</summary><p className="whitespace-pre-wrap break-words">{question?.scoringAnswer || "No answer entered."}</p>{question?.hostNotes ? <p className="mt-2 whitespace-pre-wrap break-words text-[#d9cffa]">{question.hostNotes}</p> : null}</details>
    <details className="rounded-2xl border border-[#4b3975] bg-[#161126] p-3"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Announce winner</summary><p className="mb-3 text-sm text-[#d9cffa]">Review scores and resolve ties before announcing. Tap a team twice to confirm.</p><div className="space-y-2">{event.teams.filter(team => team.active).sort((a,b) => b.score - a.score).map(team => <div key={team.id}>{control(`${team.name} · ${team.score} points`, Trophy, "set_winner", { teamId: team.id }, { guard: true, active: live.stage === "winner" && live.winnerTeamId === team.id })}</div>)}</div>{!event.teams.some(team => team.active) ? <p>No active teams.</p> : null}</details>
    <button type="button" disabled={disabled} onClick={() => void action("set_stage", { stage: "blank" })} className={`${tile} w-full border-rose-400 bg-rose-600 text-white`}><ShieldAlert aria-hidden="true" />Emergency hold · blank projector</button>
    {selector ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setSelector(null)}><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="remote-selector-title" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-[#8067b7] bg-[#161126] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white"><div className="flex items-center justify-between gap-3"><h2 id="remote-selector-title" className="text-xl font-semibold">Choose {selector}</h2><button type="button" aria-label="Close selector" onClick={() => setSelector(null)} className="flex min-h-12 min-w-12 items-center justify-center rounded-full border border-[#8067b7]"><X aria-hidden="true" /></button></div><p className="my-3 text-sm text-[#d9cffa]">Tap twice to confirm. Selection changes the projector. Changing rounds selects its first question.</p><div className="space-y-2">{selector === "round" ? event.rounds.map((item, index) => <div key={item.id}>{control(`${index + 1}. ${item.title} · ${item.questions.length} questions`, item.id === round?.id ? Check : Flag, "set_round", { roundId: item.id }, { guard: true, active: item.id === round?.id })}</div>) : round?.questions.map((item, index) => <div key={item.id}>{control(`${index + 1}. ${item.prompt}`, index === live.activeQuestionIndex ? Check : CircleHelp, "set_question", { questionIndex: index }, { guard: true, active: index === live.activeQuestionIndex })}</div>)}</div>{!event.rounds.length ? <p>No rounds created yet.</p> : null}<p role="status" className="mt-3 text-sm text-amber-200">{pendingAction ? "Tap the highlighted selection again within five seconds to confirm." : ""}</p></div></div> : null}
  </>;
}
