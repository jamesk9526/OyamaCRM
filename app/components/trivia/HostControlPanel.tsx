// HostControlPanel provides live event controls for timer, stage, question flow, and display pop-out.
"use client";

import { useEffect } from "react";
import type { TriviaDisplayStage, TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound } from "@/app/apps/trivia/lib/trivia-selectors";

interface HostControlPanelProps {
  /** Active event record used by host controls. */
  event: TriviaEvent;
  /** Live runtime state for selected event. */
  live: TriviaLiveState;
  /** Move to next question in active round. */
  onNextQuestion: () => void;
  /** Move to previous question in active round. */
  onPreviousQuestion: () => void;
  /** Set active round from round selector. */
  onSetRound: (roundId: string) => void;
  /** Set audience display stage. */
  onSetStage: (stage: TriviaDisplayStage) => void;
  /** Show winner view on projector. */
  onShowWinner: () => void;
  /** Adjust timer running state. */
  onSetTimerRunning: (running: boolean) => void;
  /** Reset timer to current question default. */
  onResetTimer: () => void;
  /** Apply countdown tick for running timer. */
  onTickTimer: (remaining: number) => void;
  /** Marks display launch state for host status visibility. */
  onProjectorOpened: () => void;
}

const STAGE_BUTTONS: Array<{ stage: TriviaDisplayStage; label: string; tone: string }> = [
  { stage: "welcome", label: "Welcome", tone: "bg-slate-800 hover:bg-slate-700 text-white" },
  { stage: "round_intro", label: "Round Intro", tone: "bg-sky-700 hover:bg-sky-600 text-white" },
  { stage: "question", label: "Question", tone: "bg-emerald-700 hover:bg-emerald-600 text-white" },
  { stage: "timer_only", label: "Timer Only", tone: "bg-cyan-700 hover:bg-cyan-600 text-white" },
  { stage: "answer", label: "Reveal Answer", tone: "bg-indigo-700 hover:bg-indigo-600 text-white" },
  { stage: "leaderboard", label: "Leaderboard", tone: "bg-violet-700 hover:bg-violet-600 text-white" },
  { stage: "break", label: "Break", tone: "bg-amber-700 hover:bg-amber-600 text-white" },
  { stage: "final_question", label: "Final Question", tone: "bg-fuchsia-700 hover:bg-fuchsia-600 text-white" },
  { stage: "tiebreaker", label: "Tiebreaker", tone: "bg-rose-700 hover:bg-rose-600 text-white" },
  { stage: "blank", label: "Blank Screen", tone: "bg-slate-700 hover:bg-slate-600 text-white" },
];

function getStageLabel(stage: TriviaDisplayStage): string {
  switch (stage) {
    case "welcome":
      return "Welcome screen";
    case "round_intro":
      return "Round intro";
    case "question":
      return "Question content";
    case "timer_only":
      return "Timer-only display";
    case "answer":
      return "Answer reveal";
    case "leaderboard":
      return "Leaderboard";
    case "break":
      return "Break/intermission";
    case "final_question":
      return "Final question";
    case "tiebreaker":
      return "Tiebreaker";
    case "winner":
      return "Winner screen";
    case "blank":
      return "Blank screen";
    default:
      return "Display stage";
  }
}

/**
 * HostControlPanel focuses the trivia host on a single set of high-priority controls.
 * It is built for quick, low-friction interactions in live event environments.
 */
export default function HostControlPanel({
  event,
  live,
  onNextQuestion,
  onPreviousQuestion,
  onSetRound,
  onSetStage,
  onShowWinner,
  onSetTimerRunning,
  onResetTimer,
  onTickTimer,
  onProjectorOpened,
}: HostControlPanelProps) {
  const activeRound = getActiveRound(event, live);
  const activeQuestion = getActiveQuestion(event, live);

  // Timer tick loop keeps host and display windows synchronized while countdown runs.
  useEffect(() => {
    if (!live.timerRunning) return;

    const intervalId = window.setInterval(() => {
      const nextValue = Math.max(0, live.timerRemainingSec - 1);
      onTickTimer(nextValue);
      if (nextValue === 0) {
        onSetTimerRunning(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [live.timerRunning, live.timerRemainingSec, onSetTimerRunning, onTickTimer]);

  function openProjectorDisplay() {
    window.open(`/apps/trivia/display/${event.id}`, "_blank", "noopener,noreferrer,width=1680,height=950");
    onProjectorOpened();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">Live Host Controls</p>
        <h2 className="text-lg font-semibold text-white mt-1">{activeRound?.title || "No active round"}</h2>
        <p className="text-sm text-slate-300 mt-1">{activeQuestion?.prompt || "Select a round and add questions to begin."}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Round and Question Flow</h3>
          <select
            value={live.activeRoundId}
            onChange={(eventInput) => onSetRound(eventInput.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 text-sm text-slate-100 px-3 py-2"
          >
            {event.rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.title}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPreviousQuestion} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm text-white">
              Previous Question
            </button>
            <button onClick={onNextQuestion} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm text-black font-semibold">
              Next Question
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STAGE_BUTTONS.map((button) => (
              <button
                key={button.stage}
                onClick={() => onSetStage(button.stage)}
                className={`rounded-lg px-3 py-2 text-sm ${button.tone}`}
              >
                {button.label}
              </button>
            ))}
          </div>

          <button onClick={onShowWinner} className="w-full rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 px-3 py-2 text-sm text-white">
            Final Winner Screen
          </button>

          <button onClick={() => onSetTimerRunning(false)} className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm text-white">
            Emergency Pause Timer
          </button>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Timer and Display Tools</h3>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Projector Status</p>
            <p className="text-sm text-white">Projector showing: {getStageLabel(live.stage)}</p>
            <p className="text-xs text-slate-200">
              {activeQuestion ? `Question ${live.activeQuestionIndex + 1} in ${activeRound?.title ?? "current round"}` : "No active question selected"}
            </p>
            <p className="text-xs text-slate-200">Answer {live.answerRevealed ? "revealed" : "hidden"}</p>
            <p className="text-xs text-slate-200">Timer {live.timerRunning ? "running" : "paused"}</p>
            <p className="text-xs text-slate-200">Leaderboard {live.stage === "leaderboard" ? "visible" : "hidden"}</p>
            <p className="text-xs text-slate-200">Break screen {live.stage === "break" ? "active" : "inactive"}</p>
            <p className="text-xs text-slate-300">Display window {live.displayOpenedAt ? "opened" : "not launched"}</p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Timer Remaining</p>
            <p className="text-4xl font-bold text-emerald-300 mt-1">{live.timerRemainingSec}s</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSetTimerRunning(true)}
              disabled={live.timerRemainingSec <= 0}
              className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-2 text-sm text-white"
            >
              Start Timer
            </button>
            <button onClick={() => onSetTimerRunning(false)} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm text-white">
              Pause Timer
            </button>
          </div>

          <button onClick={onResetTimer} className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm text-white">
            Reset Timer
          </button>

          <button
            onClick={openProjectorDisplay}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black"
          >
            Pop Out Projector Display
          </button>

          <p className="text-xs text-slate-400">Host action: {live.lastHostAction}</p>
        </article>
      </div>
    </section>
  );
}
