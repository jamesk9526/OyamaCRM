// Private answer-key route for host-only question and answer review.
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import TriviaEventHeader from "@/app/components/trivia/TriviaEventHeader";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaAnswerKeyPage renders private answer keys and host notes.
 * This route is intentionally not projector-safe.
 */
export default function TriviaAnswerKeyPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state } = useTriviaModuleState();

  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]);

  if (!event) {
    return (
      <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        Event not found. Open an event from the trivia events list.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <TriviaEventHeader
        event={event}
        actions={(
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs text-white"
          >
            Print Answer Key
          </button>
        )}
      />
      <div className="space-y-3">
        {event.rounds.map((round) => (
          <article key={round.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{round.title}</h2>
              <span className="rounded border border-cyan-500/60 bg-cyan-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
                {round.roundType}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">{round.description || "No description"}</p>
            <div className="mt-3 space-y-2">
              {round.questions.map((question, index) => (
                <div key={question.id} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 space-y-1">
                  <p className="text-sm text-white">Q{index + 1}. {question.prompt}</p>
                  <p className="text-xs text-slate-300">Type: {question.questionType} • Points: {question.points} • Time: {question.timeLimitSec}s</p>
                  <p className="text-xs text-emerald-200 mt-1">Scoring answer: {question.scoringAnswer || "Not set"}</p>
                  <p className="text-xs text-cyan-200 mt-1">Audience answer: {question.audienceAnswer || "Not set"}</p>
                  {question.acceptedAnswers.length ? (
                    <p className="text-xs text-cyan-100">Accepted alternates: {question.acceptedAnswers.join(", ")}</p>
                  ) : null}
                  {question.revealText ? <p className="text-xs text-fuchsia-200">Reveal text: {question.revealText}</p> : null}
                  {question.explanation ? <p className="text-xs text-violet-200">Explanation: {question.explanation}</p> : null}
                  {question.mediaUrl ? <p className="text-xs text-amber-200">Media: {question.mediaUrl}</p> : null}
                  <p className="text-xs text-cyan-200 mt-1">Host notes: {question.hostNotes || "No notes"}</p>
                </div>
              ))}
              {round.questions.length === 0 ? <p className="text-sm text-slate-400">No questions in this round.</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
