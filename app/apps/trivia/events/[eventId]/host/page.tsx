// Host route for real-time trivia event operations and projector control.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TriviaEventHeader from "@/app/components/trivia/TriviaEventHeader";
import HostControlPanel from "@/app/components/trivia/HostControlPanel";
import ScorekeepingPanel from "@/app/components/trivia/ScorekeepingPanel";
import TemporaryEventAccessPanel from "@/app/components/trivia/TemporaryEventAccessPanel";
import TriviaEventsLinkPanel from "@/app/components/trivia/TriviaEventsLinkPanel";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { findTriviaEventForRoute, getActiveQuestion, getSortedTeams } from "@/app/apps/trivia/lib/trivia-selectors";

/**
 * TriviaHostPage is the private control center for live host actions.
 */
export default function TriviaHostPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [goingLive, setGoingLive] = useState(false);
  const [hostError, setHostError] = useState("");
  const {
    state,
    setActiveRound,
    setQuestionIndex,
    setDisplayStage,
    setWinner,
    setTimerRunning,
    resetTimer,
    applyScoreAction,
    undoLastScoreAction,
    updateEventStatus,
    markProjectorOpened,
    syncMode,
    setSyncMode,
    connectionStatus,
    refreshFromServer,
    createEventSnapshot,
    liveSaving,
    syncError,
    retryLiveSync,
    liveClockOffsetMs,
  } = useTriviaModuleState({ liveEventId: eventId });

  const event = useMemo(() => findTriviaEventForRoute(state.events, eventId), [state.events, eventId]);
  const live = event ? state.liveByEventId[event.id] : null;

  if (!event || !live) {
    return (
      <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        {connectionStatus === "reconnecting" ? "Loading live game…" : connectionStatus === "offline" ? "The live game could not be loaded. Check your server connection and reload." : "Event not found. Open an event from the trivia events list."}
      </section>
    );
  }

  const activeRound = event.rounds.find((round) => round.id === live.activeRoundId);
  const activeQuestion = getActiveQuestion(event, live);
  const questionCount = activeRound?.questions.length ?? 0;

  async function markLive() {
    if (!event || goingLive) return;
    setGoingLive(true);
    setHostError("");
    try {
      await createEventSnapshot(event.id, "Before going live");
      updateEventStatus(event.id, "live");
    } catch (error) {
      setHostError(error instanceof Error ? error.message : "Could not save the safety checkpoint. Try again before going live.");
    } finally {
      setGoingLive(false);
    }
  }

  return (
    <section className="space-y-4">
      <TriviaEventHeader
        event={event}
        actions={(
          <>
            <button disabled={goingLive || syncMode !== "server" || connectionStatus !== "connected" || event.status === "live"} onClick={() => void markLive()} className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-500 disabled:opacity-45">
              {goingLive ? "Saving checkpoint…" : event.status === "live" ? "Event is live" : "Mark Live"}
            </button>
            <Link href={`/events/${event.id}/trivia/scores`} className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-3 py-2 text-xs text-white">
              Score Panel
            </Link>
          </>
        )}
      />
      {hostError ? <p role="alert" className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{hostError}</p> : null}

      <HostControlPanel
        event={event}
        live={live}
        onSetRound={(roundId) => setActiveRound(event.id, roundId)}
        onPreviousQuestion={() => setQuestionIndex(event.id, Math.max(0, live.activeQuestionIndex - 1))}
        onNextQuestion={() => setQuestionIndex(event.id, Math.min(Math.max(questionCount - 1, 0), live.activeQuestionIndex + 1))}
        onSetStage={(stage) => setDisplayStage(event.id, stage, `Display ${stage}`)}
        onShowWinner={() => {
          const sorted = getSortedTeams(event.teams);
          if (!sorted[0] || sorted[1]?.score === sorted[0].score) return;
          setWinner(event.id, sorted[0]?.id ?? null);
        }}
        onSetTimerRunning={(running) => setTimerRunning(event.id, running)}
        onResetTimer={() => resetTimer(event.id)}
        onProjectorOpened={() => markProjectorOpened(event.id)}
        onCreateCheckpoint={() => createEventSnapshot(event.id, `Host checkpoint · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`).then(() => undefined)}
        connectionStatus={connectionStatus}
        serverSyncEnabled={syncMode === "server"}
        saving={liveSaving}
        saveError={syncError || undefined}
        onRetrySync={() => void retryLiveSync(event.id)}
        clockOffsetMs={liveClockOffsetMs}
      />

      <details className="border border-slate-700 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Event setup, connection, and staff access</summary>
        <div className="mt-4 space-y-4">
          <TriviaEventsLinkPanel event={event} onRefresh={refreshFromServer} compact />

      <section className={syncMode === "server" ? "border border-emerald-400/40 bg-emerald-500/10 px-4 py-3" : "border border-amber-400/50 bg-amber-500/10 px-4 py-3"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-white">Event-night connection</p><p className="mt-1 text-xs text-slate-200">{syncMode === "server" ? `Server sync is ${connectionStatus}. Host, projector, check-in, and temporary remotes share this event state.` : "This device is in local mode. Turn on server sync before opening a projector or remote controller on another device."}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => setSyncMode("server")} className={syncMode === "server" ? "bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" : "border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-100"}>Use server sync</button>{syncMode === "server" ? <button type="button" onClick={() => void refreshFromServer()} className="border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-100">Refresh now</button> : null}</div>
        </div>
      </section>

      <TemporaryEventAccessPanel eventId={event.id} />
        </div>
      </details>

      <details className="border border-slate-700 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Quick score entry</summary>
        <div className="mt-4">
      <ScorekeepingPanel
        teams={event.teams}
        scoreHistory={state.scoreHistoryByEventId[event.id] ?? []}
        defaultQuestionPoints={activeQuestion?.points ?? event.scoringRules.defaultQuestionPoints}
        allowPartialCredit={event.scoringRules.allowPartialCredit}
        activeRoundId={live.activeRoundId || null}
        activeQuestionId={activeQuestion?.id ?? null}
        onApplyScore={(payload) => applyScoreAction(event.id, payload)}
        onUndoLast={() => undoLastScoreAction(event.id)}
      />
        </div>
      </details>
    </section>
  );
}
