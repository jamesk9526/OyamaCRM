// Pure selector helpers for deriving active trivia event/round/question/leaderboard state.

import type { TriviaEvent, TriviaLiveState, TriviaQuestion, TriviaRound, TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";

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
