// Type definitions for the standalone Oyama Trivia add-on module.

/** Event lifecycle values for trivia game setup and live execution. */
export type TriviaEventStatus = "draft" | "check_in_open" | "live" | "paused" | "completed" | "archived";

/** Team check-in state used by front-desk and host workflows. */
export type TriviaCheckInStatus = "expected" | "checked_in" | "late" | "dropped" | "inactive";

/** Connectivity indicator used by live operations surfaces. */
export type TriviaConnectionStatus = "connected" | "reconnecting" | "offline";

/** Audience-facing stage values used by the projector display. */
export type TriviaDisplayStage =
  | "welcome"
  | "check_in_open"
  | "check_in_closed"
  | "round_intro"
  | "question"
  | "timer_only"
  | "answer"
  | "explanation"
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

/** Public registration pricing choices supported by a trivia event. */
export type TriviaRegistrationPaymentMode = "free" | "per_seat" | "per_table" | "mixed";

/** Payment handoff methods. Provider checkout is configured as an external hosted URL. */
export type TriviaRegistrationPaymentProvider = "offline" | "stripe" | "paypal";

export type TriviaTeamPaymentStatus = "not_required" | "pending" | "partial" | "paid" | "waived";

/** Controls whether a linked Oyama Events roster refreshes during normal server polling. */
export type TriviaEventsSyncMode = "automatic" | "manual";

/** Public event page, capacity, registration, and payment configuration. */
export interface TriviaRegistrationSettings {
  enabled: boolean;
  signupOpen: boolean;
  publicSlug: string;
  headline: string;
  description: string;
  accentColor: string;
  contactEmail: string;
  maximumTables: number;
  maximumSeatsPerTable: number;
  collectMemberNames: boolean;
  paymentMode: TriviaRegistrationPaymentMode;
  seatPrice: number;
  tablePrice: number;
  currency: string;
  paymentProvider: TriviaRegistrationPaymentProvider;
  paymentUrl: string;
  paymentInstructions: string;
  confirmationMessage: string;
}

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

/** Editable audience copy for the opening projector screen. */
export interface TriviaWelcomeScreen {
  eyebrow: string;
  headline: string;
  subtitle: string;
  showHost: boolean;
  showVenue: boolean;
}

/** Reusable game-wide setup rules applied before content authoring. */
export interface TriviaGameTemplate {
  id: string;
  name: string;
  description: string;
  roundCount: number;
  questionsPerRound: number;
  defaultQuestionPoints: number;
  defaultTimeLimitSec: number;
  allowPartialCredit: boolean;
  finalWagerEnabled: boolean;
  highContrast: boolean;
  showTimerOnQuestion: boolean;
}

/**
 * Trivia team model for scoreboard and ranking.
 * Player names are optional because some teams may register only with a team label.
 */
export interface TriviaTeam {
  id: string;
  name: string;
  players: string[];
  /** Optional explicit player count for fast check-in workflows. */
  playerCount?: number;
  score: number;
  bonusPoints: number;
  active: boolean;
  color: string;
  icon: string;
  sortOrder: number;
  checkInStatus?: TriviaCheckInStatus;
  checkedInAt?: string | null;
  tableNumber?: string;
  captainName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  tableHostName?: string;
  registrationSource?: "staff" | "public";
  registrationCode?: string;
  paymentChoice?: "seat" | "table";
  paymentStatus?: TriviaTeamPaymentStatus;
  paymentProvider?: TriviaRegistrationPaymentProvider;
  amountDue?: number;
  payerName?: string;
  payerEmail?: string;
  notes?: string;
  /** Durable EventSTUDIO table record backing this trivia team. */
  eventsTableId?: string;
  /** EventSTUDIO guest records represented by the player list. */
  eventsGuestIds?: string[];
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
  /** Pre-unification identifier accepted only for legacy route migration. */
  legacyTriviaId?: string;
  name: string;
  venue: string;
  hostName: string;
  startAt: string;
  status: TriviaEventStatus;
  rounds: TriviaRound[];
  teams: TriviaTeam[];
  scoringRules: TriviaScoringRules;
  displaySettings: TriviaDisplaySettings;
  welcomeScreen?: TriviaWelcomeScreen;
  registrationSettings?: TriviaRegistrationSettings;
  gameTemplate?: TriviaGameTemplate;
  /** Optional EventSTUDIO event used as the authoritative table and RSVP source. */
  linkedEventsEventId?: string;
  linkedEventsEventName?: string;
  eventsSyncMode?: TriviaEventsSyncMode;
  eventsLastSyncedAt?: string | null;
  /** Public EventSTUDIO RSVP route created with the linked event. */
  eventsPublicPagePath?: string;
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
  lastScoreActionAt?: string | null;
  lastScoreActionSummary?: string;
  projectorConnectionStatus?: TriviaConnectionStatus;
  scorekeeperConnectionStatus?: TriviaConnectionStatus;
  checkInOpenedAt?: string | null;
  checkInClosedAt?: string | null;
  lastSyncedAt?: string | null;
  updatedAt: string;
}

/** Immutable snapshot used for event recovery and rollback. */
export interface TriviaEventSnapshot {
  id: string;
  eventId: string;
  label: string;
  capturedAt: string;
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
}

/** Timeline event for auditing score/check-in/recovery actions. */
export interface TriviaEventAuditEvent {
  id: string;
  eventId: string;
  type: "score" | "check_in" | "snapshot" | "recover" | "status" | "sync" | "manual";
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** Persisted module-level container for all trivia data in local storage. */
export interface TriviaModuleState {
  events: TriviaEvent[];
  liveByEventId: Record<string, TriviaLiveState>;
  scoreHistoryByEventId: Record<string, TriviaScoreAction[]>;
}
