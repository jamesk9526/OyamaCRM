// HostControlPanel provides live event controls for timer, stage, question flow, and display pop-out.
"use client";

import { useEffect, useState } from "react";
import type { TriviaConnectionStatus, TriviaDisplayStage, TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
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
  /** Captures a recovery point before or during live operation. */
  onCreateCheckpoint?: () => Promise<void>;
  /** Shared server connection state shown prominently to the host. */
  connectionStatus?: TriviaConnectionStatus;
  /** Whether all event-night surfaces share the server state. */
  serverSyncEnabled?: boolean;
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

const GUARDED_STAGES = new Set<TriviaDisplayStage>(["answer", "leaderboard", "final_question", "tiebreaker"]);

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
  onCreateCheckpoint,
  connectionStatus = "connected",
  serverSyncEnabled = true,
}: HostControlPanelProps) {
  const activeRound = getActiveRound(event, live);
  const activeQuestion = getActiveQuestion(event, live);
  const [confirmationKey, setConfirmationKey] = useState<string | null>(null);
  const [pendingRoundId, setPendingRoundId] = useState(live.activeRoundId);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setPendingRoundId(live.activeRoundId);
  }, [live.activeRoundId]);

  useEffect(() => {
    if (!confirmationKey) return;
    const timeoutId = window.setTimeout(() => setConfirmationKey(null), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [confirmationKey]);

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

  function runGuarded(key: string, action: () => void) {
    if (confirmationKey !== key) {
      setConfirmationKey(key);
      setStatusMessage("Tap the highlighted control again within five seconds to confirm.");
      return;
    }
    setConfirmationKey(null);
    setStatusMessage("");
    action();
  }

  async function createCheckpoint() {
    if (!onCreateCheckpoint) return;
    setCheckpointBusy(true);
    try {
      await onCreateCheckpoint();
      setStatusMessage("Safety checkpoint saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The safety checkpoint could not be saved.");
    } finally {
      setCheckpointBusy(false);
    }
  }

  const questionCount = activeRound?.questions.length ?? 0;
  const nextQuestion = activeRound?.questions[live.activeQuestionIndex + 1] ?? null;
  const timerEnabled = (activeQuestion?.timeLimitSec ?? live.timerDefaultSec) > 0;
  const sharedStateSafe = serverSyncEnabled && connectionStatus === "connected";
  const actionClass = "min-h-14 touch-manipulation border px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <section className="space-y-3">
      <div className="sticky top-0 z-30 border border-slate-700 bg-[#081321]/95 p-3 shadow-xl backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Live host console</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white">{activeRound?.title || "No active round"} · Q{questionCount ? live.activeQuestionIndex + 1 : 0}/{questionCount}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-300">{activeQuestion?.prompt || "Select a round and add questions to begin."}</p>
          </div>
          <div className={`border px-3 py-2 text-xs font-semibold ${sharedStateSafe ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-rose-400/40 bg-rose-500/15 text-rose-100"}`}>
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${sharedStateSafe ? "bg-emerald-400" : "bg-rose-400"}`} />
            {sharedStateSafe ? "Shared state connected" : serverSyncEnabled ? "Connection needs attention" : "Local-only mode"}
          </div>
        </div>
        {statusMessage ? <p className="mt-3 border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100" aria-live="polite">{statusMessage}</p> : null}
      </div>

      {!sharedStateSafe ? (
        <div className="border-l-4 border-rose-400 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
          Do not advance the live game until server sync is connected. Projectors and phone remotes may otherwise show different states.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <article className="space-y-3 border border-slate-700 bg-slate-900/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Game flow</h3>
            <span className="text-xs text-slate-400">Guarded actions require a second tap</span>
          </div>
          <select
            value={pendingRoundId}
            onChange={(eventInput) => {
              setPendingRoundId(eventInput.target.value);
              setConfirmationKey("change-round");
              setStatusMessage("Review the selected round, then tap Confirm round change.");
            }}
            className="min-h-12 w-full border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100"
          >
            {event.rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.title}
              </option>
            ))}
          </select>
          {pendingRoundId !== live.activeRoundId ? (
            <button type="button" onClick={() => runGuarded("change-round", () => onSetRound(pendingRoundId))} className={`${actionClass} w-full border-amber-400/50 bg-amber-500/15 text-amber-100`}>
              {confirmationKey === "change-round" ? "Confirm round change" : "Change round"}
            </button>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button disabled={!sharedStateSafe || live.activeQuestionIndex <= 0} onClick={() => runGuarded("previous-question", onPreviousQuestion)} className={`${actionClass} border-slate-600 bg-slate-800 text-white hover:bg-slate-700`}>
              {confirmationKey === "previous-question" ? "Confirm previous" : "← Previous"}
            </button>
            <button disabled={!sharedStateSafe || questionCount === 0 || live.activeQuestionIndex >= questionCount - 1} onClick={() => runGuarded("next-question", onNextQuestion)} className={`${actionClass} border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400`}>
              {confirmationKey === "next-question" ? "Confirm next" : "Next question →"}
            </button>
          </div>

          <div className="border border-slate-700 bg-slate-950/70 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Up next</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-300">{nextQuestion?.prompt || "End of this round"}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAGE_BUTTONS.filter((button) => timerEnabled || button.stage !== "timer_only").map((button) => (
              <button
                key={button.stage}
                disabled={!sharedStateSafe}
                onClick={() => GUARDED_STAGES.has(button.stage)
                  ? runGuarded(`stage-${button.stage}`, () => onSetStage(button.stage))
                  : onSetStage(button.stage)}
                className={`${actionClass} ${button.tone} ${live.stage === button.stage ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : "border-transparent"}`}
              >
                {confirmationKey === `stage-${button.stage}` ? `Confirm ${button.label}` : button.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button disabled={!sharedStateSafe || event.teams.length === 0} onClick={() => runGuarded("winner", onShowWinner)} className={`${actionClass} border-fuchsia-400/40 bg-fuchsia-700 text-white hover:bg-fuchsia-600`}>
              {confirmationKey === "winner" ? "Confirm winner screen" : "Final winner screen"}
            </button>
            <button onClick={() => { onSetTimerRunning(false); onSetStage("blank"); setStatusMessage("Emergency hold active. Projector blanked and timer paused."); }} className={`${actionClass} border-rose-400/60 bg-rose-600 text-white hover:bg-rose-500`}>
              Emergency hold
            </button>
          </div>
        </article>

        <article className="space-y-3 border border-slate-700 bg-slate-900/60 p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-white">Timer, display, and recovery</h3>

          <div className="space-y-1 border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Projector Status</p>
            <p className="text-sm text-white">Projector showing: {getStageLabel(live.stage)}</p>
            <p className="text-xs text-slate-200">
              {activeQuestion ? `Question ${live.activeQuestionIndex + 1} in ${activeRound?.title ?? "current round"}` : "No active question selected"}
            </p>
            <p className="text-xs text-slate-200">Answer {live.answerRevealed ? "revealed" : "hidden"}</p>
            <p className="text-xs text-slate-200">Timer {timerEnabled ? (live.timerRunning ? "running" : "paused") : "disabled for this question"}</p>
            <p className="text-xs text-slate-200">Leaderboard {live.stage === "leaderboard" ? "visible" : "hidden"}</p>
            <p className="text-xs text-slate-200">Break screen {live.stage === "break" ? "active" : "inactive"}</p>
            <p className="text-xs text-slate-300">Display window {live.displayOpenedAt ? "opened" : "not launched"}</p>
          </div>

          {timerEnabled ? <div className={`border p-4 text-center ${live.timerRemainingSec <= 5 && live.timerRunning ? "animate-pulse border-rose-400 bg-rose-500/15" : "border-slate-700 bg-slate-950"}`}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Timer remaining</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-emerald-300">{live.timerRemainingSec}s</p>
          </div> : <div className="border border-cyan-400/35 bg-cyan-500/10 p-4 text-center"><p className="text-sm font-semibold text-cyan-100">Untimed question</p><p className="mt-1 text-xs text-slate-300">Advance when the room is ready.</p></div>}

          {timerEnabled ? <><div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSetTimerRunning(true)}
              disabled={!sharedStateSafe || live.timerRemainingSec <= 0}
              className={`${actionClass} border-emerald-400/40 bg-emerald-700 text-white hover:bg-emerald-600`}
            >
              Start Timer
            </button>
            <button onClick={() => onSetTimerRunning(false)} className={`${actionClass} border-slate-600 bg-slate-800 text-white hover:bg-slate-700`}>
              Pause Timer
            </button>
          </div>

          <button onClick={() => runGuarded("reset-timer", onResetTimer)} className={`${actionClass} w-full border-slate-600 bg-slate-700 text-white hover:bg-slate-600`}>
            {confirmationKey === "reset-timer" ? "Confirm timer reset" : "Reset timer"}
          </button></> : null}

          <button
            onClick={openProjectorDisplay}
            className={`${actionClass} w-full border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400`}
          >
            Open projector display
          </button>

          {onCreateCheckpoint ? <button disabled={checkpointBusy || !sharedStateSafe} onClick={() => void createCheckpoint()} className={`${actionClass} w-full border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25`}>{checkpointBusy ? "Saving checkpoint…" : "Save safety checkpoint"}</button> : null}
          <p className="text-xs text-slate-400">Host action: {live.lastHostAction}</p>
        </article>
      </div>
    </section>
  );
}
