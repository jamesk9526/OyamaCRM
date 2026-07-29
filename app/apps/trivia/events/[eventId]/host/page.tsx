// Host route for real-time trivia event operations and projector control.
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TriviaEventHeader from "@/app/components/trivia/TriviaEventHeader";
import HostControlPanel from "@/app/components/trivia/HostControlPanel";
import ScorekeepingPanel from "@/app/components/trivia/ScorekeepingPanel";
import TemporaryEventAccessPanel from "@/app/components/trivia/TemporaryEventAccessPanel";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { getActiveQuestion } from "@/app/apps/trivia/lib/trivia-selectors";

/**
 * TriviaHostPage is the private control center for live host actions.
 */
export default function TriviaHostPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    state,
    setActiveRound,
    setQuestionIndex,
    setDisplayStage,
    setWinner,
    setTimerRunning,
    setTimerRemaining,
    resetTimer,
    applyScoreAction,
    undoLastScoreAction,
    updateEventStatus,
    markProjectorOpened,
    syncMode,
    setSyncMode,
    connectionStatus,
    refreshFromServer,
  } = useTriviaModuleState();

  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]);
  const live = event ? state.liveByEventId[event.id] : null;

  if (!event || !live) {
    return (
      <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        Event not found. Open an event from the trivia events list.
      </section>
    );
  }

  const activeRound = event.rounds.find((round) => round.id === live.activeRoundId);
  const activeQuestion = getActiveQuestion(event, live);
  const questionCount = activeRound?.questions.length ?? 0;

  return (
    <section className="space-y-4">
      <TriviaEventHeader
        event={event}
        actions={(
          <>
            <button onClick={() => updateEventStatus(event.id, "live")} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-black">
              Mark Live
            </button>
            <Link href={`/apps/trivia/events/${event.id}/scores`} className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-3 py-2 text-xs text-white">
              Score Panel
            </Link>
          </>
        )}
      />

      <HostControlPanel
        event={event}
        live={live}
        onSetRound={(roundId) => setActiveRound(event.id, roundId)}
        onPreviousQuestion={() => setQuestionIndex(event.id, Math.max(0, live.activeQuestionIndex - 1))}
        onNextQuestion={() => setQuestionIndex(event.id, Math.min(Math.max(questionCount - 1, 0), live.activeQuestionIndex + 1))}
        onSetStage={(stage) => setDisplayStage(event.id, stage, `Display ${stage}`)}
        onShowWinner={() => {
          const sorted = [...event.teams].sort((a, b) => b.score - a.score);
          setWinner(event.id, sorted[0]?.id ?? null);
        }}
        onSetTimerRunning={(running) => setTimerRunning(event.id, running)}
        onResetTimer={() => resetTimer(event.id)}
        onTickTimer={(remaining) => setTimerRemaining(event.id, remaining)}
        onProjectorOpened={() => markProjectorOpened(event.id)}
      />

      <section className={syncMode === "server" ? "border border-emerald-400/40 bg-emerald-500/10 px-4 py-3" : "border border-amber-400/50 bg-amber-500/10 px-4 py-3"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-white">Event-night connection</p><p className="mt-1 text-xs text-slate-200">{syncMode === "server" ? `Server sync is ${connectionStatus}. Host, projector, check-in, and temporary remotes share this event state.` : "This device is in local mode. Turn on server sync before opening a projector or remote controller on another device."}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => setSyncMode("server")} className={syncMode === "server" ? "bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" : "border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-100"}>Use server sync</button>{syncMode === "server" ? <button type="button" onClick={() => void refreshFromServer()} className="border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-100">Refresh now</button> : null}</div>
        </div>
      </section>

      <TemporaryEventAccessPanel eventId={event.id} />

      <ScorekeepingPanel
        teams={event.teams}
        scoreHistory={state.scoreHistoryByEventId[event.id] ?? []}
        defaultQuestionPoints={event.scoringRules.defaultQuestionPoints}
        allowPartialCredit={event.scoringRules.allowPartialCredit}
        activeRoundId={live.activeRoundId || null}
        activeQuestionId={activeQuestion?.id ?? null}
        onApplyScore={(payload) => applyScoreAction(event.id, payload)}
        onUndoLast={() => undoLastScoreAction(event.id)}
      />
    </section>
  );
}
