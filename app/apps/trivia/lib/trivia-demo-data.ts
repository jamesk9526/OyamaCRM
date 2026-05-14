// Default-state helpers for the standalone Oyama Trivia add-on module.

import type {
  TriviaDisplaySettings,
  TriviaEvent,
  TriviaLiveState,
  TriviaModuleState,
  TriviaScoringRules,
} from "@/app/apps/trivia/lib/trivia-types";

/** Returns baseline scoring rules for new trivia events. */
export function createDefaultScoringRules(): TriviaScoringRules {
  return {
    defaultQuestionPoints: 10,
    allowPartialCredit: true,
    allowNegativeScores: false,
    finalWagerEnabled: true,
    tieBreakerMode: "single_question",
  };
}

/** Returns baseline display settings for new trivia events. */
export function createDefaultDisplaySettings(): TriviaDisplaySettings {
  return {
    highContrast: true,
    showTeamColors: true,
    showTimerOnQuestion: true,
    defaultStage: "welcome",
  };
}

/** Builds a default live-state object for a trivia event. */
export function createDefaultLiveState(event: TriviaEvent): TriviaLiveState {
  const firstRound = event.rounds[0];
  const firstQuestion = firstRound?.questions[0];
  const defaultStage = event.displaySettings?.defaultStage ?? "welcome";

  return {
    activeRoundId: firstRound?.id ?? "",
    activeQuestionIndex: 0,
    stage: defaultStage,
    timerDefaultSec: firstQuestion?.timeLimitSec ?? 30,
    timerRemainingSec: firstQuestion?.timeLimitSec ?? 30,
    timerRunning: false,
    leaderboardVisible: false,
    answerRevealed: false,
    displayOpenedAt: null,
    winnerTeamId: null,
    lastHostAction: "Ready",
    lastScoreActionAt: null,
    lastScoreActionSummary: "No score actions yet",
    projectorConnectionStatus: "offline",
    scorekeeperConnectionStatus: "offline",
    checkInOpenedAt: null,
    checkInClosedAt: null,
    lastSyncedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Returns an empty, production-ready starting state for the trivia module. */
export function createDefaultTriviaState(): TriviaModuleState {
  return {
    events: [],
    liveByEventId: {},
    scoreHistoryByEventId: {},
  };
}
