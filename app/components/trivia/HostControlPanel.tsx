"use client";

import { useEffect, useState } from "react";
import type { TriviaConnectionStatus, TriviaDisplayStage, TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound, getSortedTeams } from "@/app/apps/trivia/lib/trivia-selectors";
import { getTriviaHostFlow } from "@/app/apps/trivia/lib/trivia-host-flow";
import TriviaHostAudiencePreview from "./TriviaHostAudiencePreview";

interface HostControlPanelProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onSetRound: (roundId: string) => void;
  onSetStage: (stage: TriviaDisplayStage) => void;
  onShowWinner: () => void;
  onSetTimerRunning: (running: boolean) => void;
  onResetTimer: (seconds?: number) => void;
  /** Records a display launch request; it is not a projector acknowledgement. */
  onProjectorOpened: () => void;
  onCreateCheckpoint?: () => Promise<void>;
  connectionStatus?: TriviaConnectionStatus;
  serverSyncEnabled?: boolean;
  saving?: boolean;
  saveError?: string;
  onRetrySync?: () => void;
  clockOffsetMs?: number;
}

const DISPLAY_LABELS: Record<TriviaDisplayStage, string> = {
  welcome: "Welcome screen", check_in_open: "Check-in open", check_in_closed: "Check-in closed",
  round_intro: "Round intro", question: "Question", timer_only: "Timer only", answer: "Answer",
  explanation: "Explanation", leaderboard: "Leaderboard", break: "Break", final_question: "Final question",
  tiebreaker: "Tiebreaker", winner: "Winner screen", blank: "Blank screen",
};
const SECONDARY_STAGES: TriviaDisplayStage[] = ["welcome", "round_intro", "question", "timer_only", "answer", "explanation", "leaderboard", "break", "final_question", "tiebreaker", "check_in_open", "check_in_closed", "blank"];
const GUARDED_STAGES = new Set<TriviaDisplayStage>(["answer", "explanation", "leaderboard", "final_question", "tiebreaker"]);
const QUESTION_STAGES = new Set<TriviaDisplayStage>(["question", "timer_only", "answer", "explanation", "final_question", "tiebreaker"]);

/** One recommended next action, with less common operations kept in disclosures. */
export default function HostControlPanel({
  event, live, onNextQuestion, onPreviousQuestion, onSetRound, onSetStage, onShowWinner,
  onProjectorOpened, onCreateCheckpoint,
  connectionStatus = "connected", serverSyncEnabled = true, saving = false, saveError, onRetrySync,
}: HostControlPanelProps) {
  const activeRound = getActiveRound(event, live);
  const activeQuestion = getActiveQuestion(event, live);
  const flow = getTriviaHostFlow(event, live);
  const [confirmationKey, setConfirmationKey] = useState<string | null>(null);
  const [pendingRoundId, setPendingRoundId] = useState(live.activeRoundId);
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => { setPendingRoundId(live.activeRoundId); }, [live.activeRoundId]);
  useEffect(() => {
    setConfirmationKey(null);
    setStatusMessage("");
  }, [event.id, live.activeRoundId, live.activeQuestionIndex, live.stage]);
  useEffect(() => {
    if (!confirmationKey) return;
    const timeoutId = window.setTimeout(() => setConfirmationKey(null), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [confirmationKey]);

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
  function runPrimary() {
    switch (flow.action) {
      case "show_question": onSetStage(activeRound?.roundType === "final_wager" ? "final_question" : activeRound?.roundType === "tiebreaker" ? "tiebreaker" : "question"); break;
      case "reveal": runGuarded("stage-answer", () => onSetStage("answer")); break;
      case "next_question": onNextQuestion(); break;
      case "next_round": if (flow.nextRoundId) onSetRound(flow.nextRoundId); break;
      case "leaderboard": onSetStage("leaderboard"); break;
    }
  }
  async function createCheckpoint() {
    if (!onCreateCheckpoint || checkpointBusy) return;
    setCheckpointBusy(true);
    try {
      await onCreateCheckpoint();
      setStatusMessage("Safety checkpoint saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "The safety checkpoint could not be saved.");
    } finally { setCheckpointBusy(false); }
  }

  const questionCount = activeRound?.questions.length ?? 0;
  const followingRound = event.rounds[event.rounds.findIndex((round) => round.id === activeRound?.id) + 1];
  const nextQuestionRound = activeRound?.questions[live.activeQuestionIndex + 1] ? activeRound : followingRound;
  const nextQuestionIndex = nextQuestionRound === activeRound ? live.activeQuestionIndex + 1 : 0;
  const nextQuestion = nextQuestionRound?.questions[nextQuestionIndex];
  const nextQuestionRoundNumber = nextQuestionRound ? event.rounds.findIndex((round) => round.id === nextQuestionRound.id) + 1 : 0;
  const questionOnDisplay = ["question", "final_question", "tiebreaker", "answer", "explanation"].includes(live.stage)
    || live.stage === "timer_only";
  const rankedTeams = getSortedTeams(event.teams);
  const leadingTeam = rankedTeams[0];
  const tiedLeaders = leadingTeam ? rankedTeams.filter((team) => team.score === leadingTeam.score) : [];
  const winnerReady = tiedLeaders.length === 1;
  const sharedStateSafe = serverSyncEnabled && connectionStatus === "connected";
  const controlsDisabled = !sharedStateSafe || saving;
  const actionClass = "min-h-12 touch-manipulation border px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";
  const secondaryClass = `${actionClass} border-slate-600 bg-slate-800 text-white hover:bg-slate-700`;
  const questionNavClass = "min-h-9 touch-manipulation border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <section className="space-y-3" aria-label="Live host controls">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border border-slate-700 bg-slate-900 p-3">
        <div className="min-w-0 text-sm text-white"><strong>Event status: {event.status.replaceAll("_", " ")}</strong><p className="mt-1 text-xs text-slate-300">Event status does not change the audience display.</p></div>
        <p role="status" className={`text-sm font-semibold ${sharedStateSafe && !saveError ? "text-emerald-200" : "text-amber-200"}`}>
          {!serverSyncEnabled ? "Local-only mode" : !sharedStateSafe ? `Server ${connectionStatus}` : saving ? "Saving game change…" : saveError ? "Game change not saved" : "Shared state connected · changes saved"}
        </p>
        <button
          type="button"
          onClick={() => {
            onSetStage("blank");
            setStatusMessage("Emergency hold requested. Verify the projector is blank.");
          }}
          className={`${actionClass} border-rose-400/60 bg-rose-600 text-white hover:bg-rose-500`}
          title="Blank the audience display"
        >Emergency hold</button>
      </div>
      {!sharedStateSafe ? <p className="border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">Reconnect server sync before advancing. Other screens may show an older game state.</p> : null}
      {saveError ? <div role="alert" className="border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100"><p>{saveError}</p>{onRetrySync ? <button type="button" disabled={saving} onClick={onRetrySync} className={`${secondaryClass} mt-2`}>Retry game sync</button> : null}</div> : null}
      {statusMessage ? <p className="border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" aria-live="polite">{statusMessage}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.4fr)]">
        <article className="min-w-0 space-y-4 border border-slate-700 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">{flow.state}</h2><span className="text-xs text-slate-300">{activeRound?.title || "No round"} · Question {questionCount ? live.activeQuestionIndex + 1 : 0} of {questionCount}</span></div>
          <div role="group" aria-label="Question navigation" className="flex items-center justify-between gap-2">
            <button type="button" disabled={controlsDisabled || !activeQuestion || live.activeQuestionIndex <= 0} onClick={() => runGuarded("previous-question", onPreviousQuestion)} className={questionNavClass}>
              {confirmationKey === "previous-question" ? "Confirm previous" : "Previous question"}
            </button>
            <span className="text-xs tabular-nums text-slate-400">{questionCount ? `${live.activeQuestionIndex + 1} / ${questionCount}` : "0 / 0"}</span>
            <button type="button" disabled={controlsDisabled || !activeQuestion || live.activeQuestionIndex >= questionCount - 1} onClick={() => live.stage === "answer" || live.stage === "explanation" ? onNextQuestion() : runGuarded("skip-question", onNextQuestion)} className={questionNavClass}>
              {confirmationKey === "skip-question" ? "Confirm next" : "Next question"}
            </button>
          </div>
          <TriviaHostAudiencePreview event={event} live={live} />
          {!questionOnDisplay ? (
            <section aria-label="Selected question" className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected question · not on display</h3>
              <p className="text-xs text-slate-400">Round {activeRound ? event.rounds.findIndex((round) => round.id === activeRound.id) + 1 : 0} of {event.rounds.length} · {activeRound?.title || "No round"} · Question {questionCount ? live.activeQuestionIndex + 1 : 0} of {questionCount}</p>
              <p className="whitespace-pre-wrap break-words text-base font-semibold text-white">{activeQuestion?.prompt || "Select a round and add questions to begin."}</p>
            </section>
          ) : null}
          <div><button type="button" disabled={controlsDisabled || !flow.action} onClick={runPrimary} className={`${actionClass} min-h-14 w-full border-cyan-300 bg-cyan-500 text-base text-slate-950 hover:bg-cyan-400`}>{confirmationKey === "stage-answer" && flow.action === "reveal" ? "Confirm reveal answer" : flow.label}</button><p className="mt-2 text-sm text-slate-300">{flow.hint}</p></div>
          <section aria-label="Next question preview" className="space-y-1 border border-slate-700 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next question · not on display</h3>
            {nextQuestion ? (
              <>
                <p className="text-xs text-slate-400">Round {nextQuestionRoundNumber} of {event.rounds.length} · {nextQuestionRound?.title} · Question {nextQuestionIndex + 1} of {nextQuestionRound?.questions.length}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{nextQuestion.prompt}</p>
              </>
            ) : <p className="text-sm text-slate-300">{followingRound ? `Next round: ${followingRound.title}. No questions added yet.` : "End of the game · review scores next."}</p>}
          </section>
          {activeQuestion ? <details className="border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold text-cyan-100">Host reference · answer and notes</summary><p className="mt-2 text-xs text-slate-400">Private reference. Opening this does not reveal the answer.</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">Scoring answer: {activeQuestion.scoringAnswer || "No scoring answer entered"}</p>{activeQuestion.acceptedAnswers.length ? <p className="mt-2 text-sm text-slate-200">Also accept: {activeQuestion.acceptedAnswers.join("; ")}</p> : null}{activeQuestion.hostNotes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{activeQuestion.hostNotes}</p> : null}<p className="mt-2 text-xs text-slate-300">{activeQuestion.points} points</p></details> : null}
        </article>

        <aside className="space-y-3 border border-slate-700 bg-slate-900/60 p-4" aria-label="Projector">
          <button type="button" disabled={controlsDisabled} onClick={() => { window.open(`/apps/trivia/display/${event.id}`, "_blank", "noopener,noreferrer,width=1680,height=950"); onProjectorOpened(); }} className={`${secondaryClass} w-full`}>Open projector display</button>
          <p className="text-xs text-slate-400">{live.displayOpenedAt ? "Display launch requested. Check the display window." : "Open the display on the projector before starting."}</p>
        </aside>
      </div>

      <details className="border border-slate-700 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">More display controls</summary>
        <p className="mt-2 text-xs text-slate-300">Choose an alternate audience screen. Reveals and final screens require confirmation.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {SECONDARY_STAGES.filter((stage) => stage !== "timer_only").map((stage) => (
            <button
              type="button" key={stage}
              disabled={controlsDisabled || (QUESTION_STAGES.has(stage) && !activeQuestion) || (stage === "round_intro" && !activeRound)}
              aria-pressed={live.stage === stage}
              onClick={() => GUARDED_STAGES.has(stage) ? runGuarded(`stage-${stage}`, () => onSetStage(stage)) : onSetStage(stage)}
              className={`${secondaryClass} ${live.stage === stage ? "ring-2 ring-cyan-300" : ""}`}
            >
              {confirmationKey === `stage-${stage}` ? `Confirm ${DISPLAY_LABELS[stage]}` : DISPLAY_LABELS[stage]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button type="button" disabled={controlsDisabled || !winnerReady} onClick={() => runGuarded("winner", onShowWinner)} className={secondaryClass}>
            {confirmationKey === "winner" ? "Confirm winner screen" : "Final winner screen"}
          </button>
          <p className="mt-2 text-xs text-slate-300">
            {winnerReady ? `Winner preview: ${leadingTeam.name} · ${leadingTeam.score} points` : tiedLeaders.length > 1 ? `First place is tied: ${tiedLeaders.map((team) => team.name).join(", ")}. Resolve the tie before announcing a winner.` : "Activate a team before announcing a winner."}
          </p>
        </div>
      </details>

      <details className="border border-slate-700 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Round navigation and recovery</summary>
        <p className="mt-2 text-xs text-slate-300">Round changes select the first question. Confirm before changing rounds.</p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm text-slate-200">
            Jump to round
            <select
              aria-label="Active round" disabled={controlsDisabled || !event.rounds.length}
              value={pendingRoundId}
              onChange={(input) => { setPendingRoundId(input.target.value); setConfirmationKey(null); }}
              className="mt-2 min-h-12 w-full border border-slate-600 bg-slate-950 px-3 text-sm text-white"
            >
              {event.rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}
            </select>
          </label>
          {pendingRoundId !== live.activeRoundId ? (
            <button type="button" disabled={controlsDisabled} onClick={() => runGuarded("change-round", () => onSetRound(pendingRoundId))} className={secondaryClass}>
              {confirmationKey === "change-round" ? "Confirm round change" : "Change round"}
            </button>
          ) : null}
          {onCreateCheckpoint ? (
            <button type="button" disabled={checkpointBusy || controlsDisabled} onClick={() => void createCheckpoint()} className={secondaryClass}>
              {checkpointBusy ? "Saving checkpoint…" : "Save safety checkpoint"}
            </button>
          ) : null}
          <p className="text-xs text-slate-400">Last host action: {live.lastHostAction}</p>
        </div>
      </details>
    </section>
  );
}
