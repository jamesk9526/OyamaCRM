"use client";

import { useMemo, useState } from "react";
import type { TriviaEvent, TriviaLiveState, TriviaScoreAction, TriviaScoreActionType } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion } from "@/app/apps/trivia/lib/trivia-selectors";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaJudgeWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
  onApplyScore: (payload: {
    teamId: string;
    delta: number;
    actionType: TriviaScoreActionType;
    reason: string;
    roundId?: string | null;
    questionId?: string | null;
  }) => void;
}

/** Private judge panel for answer review and controlled scoring decisions. */
export default function TriviaJudgeWorkspace({ event, live, scoreHistory, onApplyScore }: TriviaJudgeWorkspaceProps) {
  const activeQuestion = useMemo(() => getActiveQuestion(event, live), [event, live]);
  const [answerNotes, setAnswerNotes] = useState<Record<string, string>>({});
  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({});

  function applyTeamDecision(teamId: string, delta: number, actionType: TriviaScoreActionType, reason: string) {
    onApplyScore({
      teamId,
      delta,
      actionType,
      reason,
      roundId: live.activeRoundId || null,
      questionId: activeQuestion?.id ?? null,
    });
  }

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-violet-200">Judge Workspace</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{activeQuestion?.prompt || "No active question selected"}</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-violet-400/30 bg-slate-950/70 p-3 text-xs text-slate-200">
            <p className="text-[10px] uppercase tracking-wide text-violet-300">Scoring Answer</p>
            <p className="mt-1 text-sm text-white">{activeQuestion?.scoringAnswer || "Not set"}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-violet-300">Accepted Alternates</p>
            <p className="mt-1 text-xs text-slate-200">{activeQuestion?.acceptedAnswers?.join(", ") || "None"}</p>
          </div>
          <div className="rounded-lg border border-violet-400/30 bg-slate-950/70 p-3 text-xs text-slate-200">
            <p className="text-[10px] uppercase tracking-wide text-violet-300">Audience Reveal Answer</p>
            <p className="mt-1 text-sm text-white">{activeQuestion?.audienceAnswer || activeQuestion?.scoringAnswer || "Not set"}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-violet-300">Explanation</p>
            <p className="mt-1 text-xs text-slate-200">{activeQuestion?.explanation || "No explanation configured"}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-violet-300">Host Notes</p>
            <p className="mt-1 text-xs text-slate-200">{activeQuestion?.hostNotes || "No private notes"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {event.teams
          .filter((team) => team.active)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((team) => (
            <article key={team.id} className="rounded-xl border border-slate-700 bg-slate-900/65 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{team.name}</p>
                  <p className="text-xs text-slate-300">Current score {team.score.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => applyTeamDecision(team.id, activeQuestion?.points ?? event.scoringRules.defaultQuestionPoints, "standard", "Judge marked correct")}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Correct +{activeQuestion?.points ?? event.scoringRules.defaultQuestionPoints}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTeamDecision(team.id, Math.max(1, Math.floor((activeQuestion?.points ?? event.scoringRules.defaultQuestionPoints) / 2)), "partial", "Judge marked partial")}
                    className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                  >
                    Partial
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTeamDecision(team.id, 0, "manual", "Judge marked incorrect")}
                    className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-600"
                  >
                    Incorrect
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <textarea
                  value={answerNotes[team.id] ?? ""}
                  onChange={(eventInput) => setAnswerNotes((previous) => ({ ...previous, [team.id]: eventInput.target.value }))}
                  rows={2}
                  placeholder="Team answer submission / manual note"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
                <textarea
                  value={appealNotes[team.id] ?? ""}
                  onChange={(eventInput) => setAppealNotes((previous) => ({ ...previous, [team.id]: eventInput.target.value }))}
                  rows={2}
                  placeholder="Challenge or appeal notes"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
