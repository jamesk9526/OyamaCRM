"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TriviaEvent, TriviaLiveState, TriviaScoreAction } from "@/app/apps/trivia/lib/trivia-types";
import { getSortedTeams } from "@/app/apps/trivia/lib/trivia-selectors";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaScoreboardWorkspaceProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
  onUndoLast: () => void;
  onUndoAction: (actionId: string) => void;
}

/** Host-private scoreboard workspace with audit/undo controls and display launch links. */
export default function TriviaScoreboardWorkspace({ event, live, scoreHistory, onUndoLast, onUndoAction }: TriviaScoreboardWorkspaceProps) {
  const sortedTeams = useMemo(() => getSortedTeams(event.teams), [event.teams]);

  const movementByTeamId = useMemo(() => {
    const lastAction = scoreHistory[scoreHistory.length - 1] ?? null;
    if (!lastAction) return new Map<string, number>();

    const previousScores = new Map(event.teams.map((team) => [team.id, team.score]));
    previousScores.set(lastAction.teamId, lastAction.previousScore);

    const previousOrder = [...event.teams]
      .filter((team) => team.active)
      .sort((a, b) => {
        const scoreA = previousScores.get(a.id) ?? a.score;
        const scoreB = previousScores.get(b.id) ?? b.score;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });

    const previousRank = new Map(previousOrder.map((team, index) => [team.id, index + 1]));
    const currentRank = new Map(sortedTeams.map((team, index) => [team.id, index + 1]));

    return new Map(sortedTeams.map((team) => {
      const previous = previousRank.get(team.id) ?? currentRank.get(team.id) ?? 0;
      const current = currentRank.get(team.id) ?? previous;
      return [team.id, previous - current];
    }));
  }, [event.teams, scoreHistory, sortedTeams]);

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/apps/trivia/display/${event.id}`} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
          Open Projector Display
        </Link>
        <Link href={`/apps/trivia/display/${event.id}/leaderboard`} target="_blank" rel="noopener noreferrer" className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500">
          Open Public Leaderboard
        </Link>
        <button
          type="button"
          onClick={onUndoLast}
          disabled={scoreHistory.length === 0}
          className="rounded-md border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40"
        >
          Undo Last Score Change
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <h2 className="text-sm font-semibold text-white">Host Private Scoreboard</h2>
        <div className="mt-2 space-y-2">
          {sortedTeams.map((team, index) => {
            const movement = movementByTeamId.get(team.id) ?? 0;
            return (
              <div key={team.id} className="rounded-lg border border-slate-700 bg-slate-950/80 p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Rank #{index + 1}</p>
                  <p className="text-base font-semibold text-white mt-0.5">{team.name}</p>
                  <p className="text-xs text-slate-300">
                    {movement > 0 ? `Up ${movement}` : movement < 0 ? `Down ${Math.abs(movement)}` : "No movement"}
                  </p>
                </div>
                <p className="text-2xl font-bold text-emerald-200">{team.score.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <h2 className="text-sm font-semibold text-white">Score Audit History</h2>
        <div className="mt-2 space-y-1 max-h-[260px] overflow-auto pr-1">
          {[...scoreHistory].reverse().map((entry) => (
            <div key={entry.id} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-100">
                  {entry.actionType} {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} ({entry.reason})
                </p>
                <p className="text-[11px] text-slate-400">{new Date(entry.createdAt).toLocaleTimeString()} • team {entry.teamId}</p>
              </div>
              <button
                type="button"
                onClick={() => onUndoAction(entry.id)}
                className="rounded border border-amber-500/60 bg-amber-500/20 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/30"
              >
                Undo
              </button>
            </div>
          ))}
          {scoreHistory.length === 0 ? <p className="text-xs text-slate-400">No score actions yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
