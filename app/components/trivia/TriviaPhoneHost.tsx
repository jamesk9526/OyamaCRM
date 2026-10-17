"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Coffee, Eye, EyeOff, Flag, List, Monitor, ShieldAlert, Trophy, X, type LucideIcon } from "lucide-react";
import type { TriviaEvent, TriviaLiveState, TriviaDisplayStage } from "@/app/apps/trivia/lib/trivia-types";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";

type Props = {
  event: TriviaEvent & { live: TriviaLiveState };
  disabled: boolean;
  pendingAction: string | null;
  action: (name: string, payload?: Record<string, unknown>) => Promise<boolean>;
  guardedAction: (name: string, payload?: Record<string, unknown>) => void;
};
const tile = "flex w-full min-h-20 min-w-0 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-40";

export default function TriviaPhoneHost({ event, disabled, pendingAction, action, guardedAction }: Props) {
  const live = event.live;
  const round = event.rounds.find((item) => item.id === live.activeRoundId);
  const question = round?.questions[live.activeQuestionIndex];
  const [selector, setSelector] = useState<"round" | "question" | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, selector !== null, () => setSelector(null));

  function control(label: string, Icon: LucideIcon, name: string, payload: Record<string, unknown> = {}, options: { guard?: boolean; active?: boolean; unavailable?: boolean } = {}) {
    const confirming = pendingAction === `${name}:${JSON.stringify(payload)}`;
    return <button type="button" disabled={disabled || options.unavailable} aria-pressed={options.active} onClick={() => options.guard ? guardedAction(name, payload) : void action(name, payload)} className={`${tile} ${confirming ? "border-amber-300 bg-amber-400/20 text-amber-100" : options.active ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-[#8067b7] bg-[#211833] text-white hover:bg-[#302247]"}`}><Icon size={25} aria-hidden="true" /><span>{confirming ? `Confirm ${label.toLowerCase()}` : label}</span></button>;
  }
  const stages: Array<[TriviaDisplayStage, string, LucideIcon]> = [
    ["check_in_open", "Check-in open", Check], ["check_in_closed", "Check-in closed", X],
    ["welcome", "Welcome", Monitor], ["round_intro", "Round intro", Flag], [round?.roundType === "final_wager" ? "final_question" : round?.roundType === "tiebreaker" ? "tiebreaker" : "question", "Question", CircleHelp],
    ["answer", "Reveal answer", Eye], ["explanation", "Explanation", List], ["leaderboard", "Leaderboard", Trophy],
    ["break", "Break", Coffee], ["blank", "Blank screen", EyeOff],
  ];
  return <>
    <section className="space-y-3 rounded-2xl border border-[#4b3975] bg-[#161126] p-3">
      <p className="text-xs uppercase tracking-wide text-cyan-200">Projector · {live.stage.replaceAll("_", " ")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSelector("round")} className={`${tile} border-[#8067b7] bg-[#211833]`}><Flag aria-hidden="true" /><span className="break-words">{round?.title || "Choose round"}</span><span className="text-xs text-cyan-200">Change round</span></button>
        <button type="button" onClick={() => setSelector("question")} disabled={!round?.questions.length} className={`${tile} border-[#8067b7] bg-[#211833]`}><List aria-hidden="true" /><span>Question {question ? live.activeQuestionIndex + 1 : 0} / {round?.questions.length ?? 0}</span><span className="text-xs text-cyan-200">Jump to question</span></button>
      </div>
      <p className="break-words rounded-xl bg-[#211833] p-3 text-base leading-relaxed">{question?.prompt || "Choose a round with questions to begin."}</p>
      <div className="grid grid-cols-2 gap-2">
        {control("Previous", ArrowLeft, "previous_question", {}, { guard: true, unavailable: !question || live.activeQuestionIndex === 0 })}
        {control("Next question", ArrowRight, "next_question", {}, { guard: true, unavailable: !question || live.activeQuestionIndex >= (round?.questions.length ?? 0) - 1 })}
      </div>
      <details className="rounded-xl border border-[#4b3975] p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Private answer & host notes</summary><p className="whitespace-pre-wrap break-words">{question?.scoringAnswer || "No answer entered."}</p>{question?.hostNotes ? <p className="mt-2 whitespace-pre-wrap break-words text-[#d9cffa]">{question.hostNotes}</p> : null}</details>
    </section>
    <section aria-label="Projector controls" className="grid grid-cols-2 gap-2">{stages.map(([stage, label, Icon]) => <div key={stage}>{control(label, Icon, "set_stage", { stage }, { active: live.stage === stage, guard: ["answer", "explanation", "leaderboard"].includes(stage), unavailable: ["question", "final_question", "tiebreaker", "answer", "explanation"].includes(stage) && !question })}</div>)}</section>
    <details className="rounded-2xl border border-[#4b3975] bg-[#161126] p-3"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Announce winner</summary><p className="mb-3 text-sm text-[#d9cffa]">Review scores and resolve ties before announcing. Tap a team twice to confirm.</p><div className="space-y-2">{event.teams.filter(team => team.active).sort((a,b) => b.score - a.score).map(team => <div key={team.id}>{control(`${team.name} · ${team.score} points`, Trophy, "set_winner", { teamId: team.id }, { guard: true, active: live.stage === "winner" && live.winnerTeamId === team.id })}</div>)}</div>{!event.teams.some(team => team.active) ? <p>No active teams.</p> : null}</details>
    <button type="button" disabled={disabled} onClick={() => void action("set_stage", { stage: "blank" })} className={`${tile} w-full border-rose-400 bg-rose-600 text-white`}><ShieldAlert aria-hidden="true" />Emergency hold · blank projector</button>
    {selector ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setSelector(null)}><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="remote-selector-title" tabIndex={-1} onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-[#8067b7] bg-[#161126] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white"><div className="flex items-center justify-between gap-3"><h2 id="remote-selector-title" className="text-xl font-semibold">Choose {selector}</h2><button type="button" aria-label="Close selector" onClick={() => setSelector(null)} className="flex min-h-12 min-w-12 items-center justify-center rounded-full border border-[#8067b7]"><X aria-hidden="true" /></button></div><p className="my-3 text-sm text-[#d9cffa]">Tap twice to confirm. Selection changes the projector. Changing rounds selects its first question.</p><div className="space-y-2">{selector === "round" ? event.rounds.map((item, index) => <div key={item.id}>{control(`${index + 1}. ${item.title} · ${item.questions.length} questions`, item.id === round?.id ? Check : Flag, "set_round", { roundId: item.id }, { guard: true, active: item.id === round?.id })}</div>) : round?.questions.map((item, index) => <div key={item.id}>{control(`${index + 1}. ${item.prompt}`, index === live.activeQuestionIndex ? Check : CircleHelp, "set_question", { questionIndex: index }, { guard: true, active: index === live.activeQuestionIndex })}</div>)}</div>{!event.rounds.length ? <p>No rounds created yet.</p> : null}<p role="status" className="mt-3 text-sm text-amber-200">{pendingAction ? "Tap the highlighted selection again within five seconds to confirm." : ""}</p></div></div> : null}
  </>;
}
