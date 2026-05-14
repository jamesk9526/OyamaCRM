// Pure selector helpers for deriving active trivia event/round/question/leaderboard state.

import type { TriviaEvent, TriviaLiveState, TriviaQuestion, TriviaRound, TriviaScoreAction, TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";

export interface TriviaCheckInSummary {
  expected: number;
  checkedIn: number;
  late: number;
  inactive: number;
  dropped: number;
  activeTeams: number;
}

/** Returns the currently selected round for the live host state. */
export function getActiveRound(event: TriviaEvent, live: TriviaLiveState): TriviaRound | null {
  return event.rounds.find((round) => round.id === live.activeRoundId) ?? null;
}

/** Returns the currently selected question for the live host state. */
export function getActiveQuestion(event: TriviaEvent, live: TriviaLiveState): TriviaQuestion | null {
  const round = getActiveRound(event, live);
  if (!round) return null;
  return round.questions[live.activeQuestionIndex] ?? null;
}

/** Returns leaderboard-sorted team list for display and score panels. */
export function getSortedTeams(teams: TriviaTeam[]): TriviaTeam[] {
  return [...teams]
  .filter((team) => team.active)
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

/** Returns a friendly winner value from the event and live state. */
export function getWinnerTeam(event: TriviaEvent, live: TriviaLiveState): TriviaTeam | null {
  if (live.winnerTeamId) {
    return event.teams.find((team) => team.id === live.winnerTeamId) ?? null;
  }

  const sorted = getSortedTeams(event.teams);
  return sorted[0] ?? null;
}

/** Returns count totals for night-of check-in state cards. */
export function getCheckInSummary(teams: TriviaTeam[]): TriviaCheckInSummary {
  return teams.reduce<TriviaCheckInSummary>((summary, team) => {
    const status = team.checkInStatus ?? (team.active ? "expected" : "inactive");
    if (status === "checked_in") summary.checkedIn += 1;
    else if (status === "late") summary.late += 1;
    else if (status === "inactive") summary.inactive += 1;
    else if (status === "dropped") summary.dropped += 1;
    else summary.expected += 1;

    if (team.active) summary.activeTeams += 1;
    return summary;
  }, {
    expected: 0,
    checkedIn: 0,
    late: 0,
    inactive: 0,
    dropped: 0,
    activeTeams: 0,
  });
}

/** Returns the most recent score action entry for status bars and event summaries. */
export function getLastScoreAction(scoreHistory: TriviaScoreAction[]): TriviaScoreAction | null {
  if (scoreHistory.length === 0) return null;
  return scoreHistory[scoreHistory.length - 1] ?? null;
}
