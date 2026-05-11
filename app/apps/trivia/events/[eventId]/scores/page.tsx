// Dedicated scorekeeping route for trivia hosts during live games.
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import TriviaEventHeader from "@/app/components/trivia/TriviaEventHeader";
import ScorekeepingPanel from "@/app/components/trivia/ScorekeepingPanel";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { getActiveQuestion } from "@/app/apps/trivia/lib/trivia-selectors";

/**
 * TriviaScoresPage provides a focused score adjustment workspace.
 */
export default function TriviaScoresPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state, applyScoreAction, undoLastScoreAction } = useTriviaModuleState();

  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]);
  const live = event ? state.liveByEventId[event.id] : null;
  const activeQuestion = event && live ? getActiveQuestion(event, live) : null;

  if (!event || !live) {
    return (
      <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        Event not found. Open an event from the trivia events list.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <TriviaEventHeader event={event} />
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
