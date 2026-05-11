// ScorekeepingPanel provides quick score adjustments for all teams in an event.

"use client";

import { useMemo, useState } from "react";
import type { TriviaScoreAction, TriviaScoreActionType, TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";
import { getSortedTeams } from "@/app/apps/trivia/lib/trivia-selectors";

interface ScorekeepingPanelProps {
  /** Team list for scoreboard operations. */
  teams: TriviaTeam[];
  /** Score history list for audit and undo operations. */
  scoreHistory: TriviaScoreAction[];
  /** Event-level scoring defaults used by quick-action helpers. */
  defaultQuestionPoints: number;
  /** Indicates whether partial credit is permitted by event rules. */
  allowPartialCredit: boolean;
  /** Current round context, if available from host view. */
  activeRoundId: string | null;
  /** Current question context, if available from host view. */
  activeQuestionId: string | null;
  /** Score update callback from page-level state manager. */
  onApplyScore: (payload: { teamId: string; delta: number; actionType: TriviaScoreActionType; reason: string; roundId?: string | null; questionId?: string | null }) => void;
  /** Undo callback for most recent score action. */
  onUndoLast: () => void;
}

const ACTION_TYPE_LABELS: Array<{ value: TriviaScoreActionType; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "partial", label: "Partial Credit" },
  { value: "bonus", label: "Bonus" },
  { value: "penalty", label: "Penalty" },
  { value: "wager", label: "Wager" },
  { value: "manual", label: "Manual" },
];

/**
 * ScorekeepingPanel keeps scoring fast while preserving a full host audit trail.
 * It supports quick-select team controls, manual adjustments, and undo.
 */
export default function ScorekeepingPanel({
  teams,
  scoreHistory,
  defaultQuestionPoints,
  allowPartialCredit,
  activeRoundId,
  activeQuestionId,
  onApplyScore,
  onUndoLast,
}: ScorekeepingPanelProps) {
  const sorted = getSortedTeams(teams);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [actionType, setActionType] = useState<TriviaScoreActionType>("standard");
  const [delta, setDelta] = useState(defaultQuestionPoints);
  const [reason, setReason] = useState("Manual adjustment");

  const selectedTeam = useMemo(
    () => sorted.find((team) => team.id === selectedTeamId) ?? sorted[0] ?? null,
    [sorted, selectedTeamId],
  );

  const filteredTeams = sorted.filter((team) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return team.name.toLowerCase().includes(query) || team.players.join(" ").toLowerCase().includes(query);
  });

  function submitScore(teamId: string, amount: number, type: TriviaScoreActionType, actionReason: string) {
    onApplyScore({
      teamId,
      delta: amount,
      actionType: type,
      reason: actionReason,
      roundId: activeRoundId,
      questionId: activeQuestionId,
    });
  }

  function handleApplyFromForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam) return;
    if (!allowPartialCredit && actionType === "partial") return;
    submitScore(selectedTeam.id, delta, actionType, reason.trim() || "Manual adjustment");
    setReason("Manual adjustment");
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold text-white">Scorekeeping</h2>
      <p className="text-sm text-slate-300 mt-1">Apply standard, partial, bonus, penalty, wager, and manual scores with an audit trail and undo.</p>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Team Quick Select</h3>
            <button
              type="button"
              onClick={onUndoLast}
              disabled={scoreHistory.length === 0}
              className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
            >
              Undo Last Action
            </button>
          </div>

          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search teams"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
          />

          <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
            {filteredTeams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedTeam?.id === team.id
                    ? "border-emerald-400/70 bg-emerald-500/20"
                    : "border-slate-700 bg-slate-900/80 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{team.name}</p>
                    <p className="text-xs text-slate-400">Players: {team.players.join(", ") || "No players listed"}</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-300">{team.score}</p>
                </div>
              </button>
            ))}
            {filteredTeams.length === 0 ? <p className="text-xs text-slate-400">No teams match the current search.</p> : null}
          </div>

          {selectedTeam ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => submitScore(selectedTeam.id, defaultQuestionPoints, "standard", `Standard points for ${selectedTeam.name}`)}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 py-1.5 text-xs text-white"
              >
                +{defaultQuestionPoints} Standard
              </button>
              <button
                type="button"
                disabled={!allowPartialCredit}
                onClick={() => submitScore(selectedTeam.id, Math.max(1, Math.floor(defaultQuestionPoints / 2)), "partial", `Partial credit for ${selectedTeam.name}`)}
                className="rounded-lg bg-cyan-700 hover:bg-cyan-600 py-1.5 text-xs text-white disabled:opacity-40"
              >
                +{Math.max(1, Math.floor(defaultQuestionPoints / 2))} Partial
              </button>
              <button
                type="button"
                onClick={() => submitScore(selectedTeam.id, 5, "bonus", `Bonus for ${selectedTeam.name}`)}
                className="rounded-lg bg-violet-700 hover:bg-violet-600 py-1.5 text-xs text-white"
              >
                +5 Bonus
              </button>
              <button
                type="button"
                onClick={() => submitScore(selectedTeam.id, -5, "penalty", `Penalty for ${selectedTeam.name}`)}
                className="rounded-lg bg-rose-700 hover:bg-rose-600 py-1.5 text-xs text-white"
              >
                -5 Penalty
              </button>
            </div>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 space-y-3">
          <h3 className="text-sm font-semibold text-white">Manual Score Action</h3>

          <form onSubmit={handleApplyFromForm} className="space-y-2">
            <select
              value={selectedTeam?.id ?? ""}
              onChange={(event) => setSelectedTeamId(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">Select team</option>
              {sorted.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value as TriviaScoreActionType)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {ACTION_TYPE_LABELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value) || 0)}
                type="number"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="Point delta"
              />
            </div>

            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            />

            <button
              type="submit"
              disabled={!selectedTeam}
              className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Apply Score Action
            </button>
          </form>

          <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Scoring Action History</p>
            <div className="mt-2 space-y-1 max-h-[170px] overflow-auto pr-1">
              {[...scoreHistory].reverse().slice(0, 12).map((entry) => (
                <p key={entry.id} className="text-xs text-slate-200">
                  {new Date(entry.createdAt).toLocaleTimeString()} - {entry.actionType} {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} ({entry.reason})
                </p>
              ))}
              {scoreHistory.length === 0 ? <p className="text-xs text-slate-400">No score actions yet.</p> : null}
            </div>
          </div>
        </article>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Add and activate teams in the builder before using scorekeeping.
        </div>
      ) : null}
    </section>
  );
}
