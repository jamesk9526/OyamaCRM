// Type definitions for the standalone Oyama Trivia add-on module.

/** Event lifecycle values for trivia game setup and live execution. */
export type TriviaEventStatus = "draft" | "live" | "completed";

/** Audience-facing stage values used by the projector display. */
export type TriviaDisplayStage =
  | "welcome"
  | "round_intro"
  | "question"
  | "timer_only"
  | "answer"
  | "leaderboard"
  | "break"
  | "final_question"
  | "tiebreaker"
  | "winner"
  | "blank";

/** Supported round styles used by trivia hosts during event setup. */
export type TriviaRoundType =
  | "normal"
  | "picture"
  | "audio"
  | "speed"
  | "final_wager"
  | "bonus"
  | "tiebreaker";

/** Supported question content modes for trivia events. */
export type TriviaQuestionType =
  | "text"
  | "multiple_choice"
  | "image"
  | "audio"
  | "video"
  | "host_prompt";

/** Scoring action types used in audit history and undo logic. */
export type TriviaScoreActionType = "standard" | "partial" | "bonus" | "penalty" | "wager" | "manual";

/** Per-event scoring rules that shape how hosts apply points. */
export interface TriviaScoringRules {
  defaultQuestionPoints: number;
  allowPartialCredit: boolean;
  allowNegativeScores: boolean;
  finalWagerEnabled: boolean;
  tieBreakerMode: "single_question" | "sudden_death";
}

/** Projector display settings for each event. */
export interface TriviaDisplaySettings {
  highContrast: boolean;
  showTeamColors: boolean;
  showTimerOnQuestion: boolean;
  defaultStage: TriviaDisplayStage;
}

/**
 * Trivia team model for scoreboard and ranking.
 * Player names are optional because some teams may register only with a team label.
 */
export interface TriviaTeam {
  id: string;
  name: string;
  players: string[];
  score: number;
  bonusPoints: number;
  active: boolean;
  color: string;
  icon: string;
  sortOrder: number;
}

/** Individual trivia question model within a round. */
export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];
  questionType: TriviaQuestionType;
  scoringAnswer: string;
  audienceAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  revealText: string;
  mediaUrl: string;
  points: number;
  timeLimitSec: number;
  hostNotes: string;
}

/** Grouping model for questions in a themed round. */
export interface TriviaRound {
  id: string;
  title: string;
  description: string;
  roundType: TriviaRoundType;
  questions: TriviaQuestion[];
}

/** Audit trail entry for score changes. */
export interface TriviaScoreAction {
  id: string;
  eventId: string;
  teamId: string;
  roundId: string | null;
  questionId: string | null;
  actionType: TriviaScoreActionType;
  delta: number;
  reason: string;
  previousScore: number;
  newScore: number;
  createdAt: string;
}

/** Trivia event root model. */
export interface TriviaEvent {
  id: string;
  name: string;
  venue: string;
  hostName: string;
  startAt: string;
  status: TriviaEventStatus;
  rounds: TriviaRound[];
  teams: TriviaTeam[];
  scoringRules: TriviaScoringRules;
  displaySettings: TriviaDisplaySettings;
  createdAt: string;
  updatedAt: string;
}

/** Live runtime state for host controls and projector rendering. */
export interface TriviaLiveState {
  activeRoundId: string;
  activeQuestionIndex: number;
  stage: TriviaDisplayStage;
  timerDefaultSec: number;
  timerRemainingSec: number;
  timerRunning: boolean;
  leaderboardVisible: boolean;
  answerRevealed: boolean;
  displayOpenedAt: string | null;
  winnerTeamId: string | null;
  lastHostAction: string;
  updatedAt: string;
}

/** Persisted module-level container for all trivia data in local storage. */
export interface TriviaModuleState {
  events: TriviaEvent[];
  liveByEventId: Record<string, TriviaLiveState>;
  scoreHistoryByEventId: Record<string, TriviaScoreAction[]>;
}
