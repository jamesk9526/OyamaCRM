// Local storage and sync utilities for standalone Oyama Trivia module state.

import {
  createDefaultDisplaySettings,
  createDefaultLiveState,
  createDefaultScoringRules,
  createDefaultTriviaState,
} from "@/app/apps/trivia/lib/trivia-demo-data";
import type {
  TriviaEvent,
  TriviaLiveState,
  TriviaModuleState,
  TriviaQuestion,
  TriviaRound,
  TriviaScoreAction,
  TriviaTeam,
} from "@/app/apps/trivia/lib/trivia-types";

const EVENT_STATUSES = new Set(["draft", "check_in_open", "live", "paused", "completed", "archived"]);
const CHECK_IN_STATUSES = new Set(["expected", "checked_in", "late", "dropped", "inactive"]);

const TRIVIA_STORAGE_KEY = "oyama.trivia.module.state.v1";
const TRIVIA_BROADCAST_CHANNEL = "oyama-trivia-state";
const TRIVIA_EVENT_NAME = "oyama-trivia:state-updated";

/** Trivial ID helper for demo-mode entities created on the client. */
export function createTriviaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const TEAM_COLORS = ["#34d399", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185"];
const TEAM_ICONS = ["star", "bolt", "brain", "crown", "rocket", "shield"];
const DISPLAY_STAGES = new Set([
  "welcome",
  "check_in_open",
  "check_in_closed",
  "round_intro",
  "question",
  "timer_only",
  "answer",
  "explanation",
  "leaderboard",
  "break",
  "final_question",
  "tiebreaker",
  "winner",
  "blank",
]);

function normalizeQuestion(input: TriviaQuestion): TriviaQuestion {
  return {
    id: input.id,
    prompt: input.prompt || "",
    options: Array.isArray(input.options) ? input.options : [],
    questionType: input.questionType ?? "text",
    scoringAnswer: input.scoringAnswer ?? (input as unknown as { correctAnswer?: string }).correctAnswer ?? "",
    audienceAnswer: input.audienceAnswer ?? (input as unknown as { correctAnswer?: string }).correctAnswer ?? "",
    acceptedAnswers: Array.isArray(input.acceptedAnswers) ? input.acceptedAnswers : [],
    explanation: input.explanation ?? "",
    revealText: input.revealText ?? "",
    mediaUrl: input.mediaUrl ?? "",
    points: Number.isFinite(input.points) ? input.points : 10,
    timeLimitSec: Number.isFinite(input.timeLimitSec) ? input.timeLimitSec : 30,
    hostNotes: input.hostNotes ?? "",
  };
}

function normalizeRound(input: TriviaRound): TriviaRound {
  return {
    id: input.id,
    title: input.title || "Untitled Round",
    description: input.description || "",
    roundType: input.roundType ?? "normal",
    questions: Array.isArray(input.questions) ? input.questions.map(normalizeQuestion) : [],
  };
}

function normalizeTeam(input: TriviaTeam, index: number): TriviaTeam {
  const normalizedCheckInStatus = CHECK_IN_STATUSES.has(String(input.checkInStatus ?? ""))
    ? input.checkInStatus
    : input.active === false
      ? "inactive"
      : "expected";

  return {
    id: input.id,
    name: input.name || "Unnamed Team",
    players: Array.isArray(input.players) ? input.players : [],
    playerCount: Number.isFinite(input.playerCount) ? Math.max(0, Number(input.playerCount)) : undefined,
    score: Number.isFinite(input.score) ? input.score : 0,
    bonusPoints: Number.isFinite(input.bonusPoints) ? input.bonusPoints : 0,
    active: typeof input.active === "boolean" ? input.active : true,
    color: input.color || TEAM_COLORS[index % TEAM_COLORS.length],
    icon: input.icon || TEAM_ICONS[index % TEAM_ICONS.length],
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : index,
    checkInStatus: normalizedCheckInStatus,
    checkedInAt: input.checkedInAt ?? null,
    tableNumber: input.tableNumber ?? "",
    captainName: input.captainName ?? "",
    contactName: input.contactName ?? "",
    contactPhone: input.contactPhone ?? "",
    notes: input.notes ?? "",
  };
}

function normalizeEvent(input: TriviaEvent): TriviaEvent {
  return {
    ...input,
    name: input.name || "Untitled Event",
    venue: input.venue || "",
    hostName: input.hostName || "",
    status: EVENT_STATUSES.has(String(input.status ?? "")) ? input.status : "draft",
    rounds: Array.isArray(input.rounds) ? input.rounds.map(normalizeRound) : [],
    teams: Array.isArray(input.teams) ? input.teams.map((team, index) => normalizeTeam(team, index)) : [],
    scoringRules: input.scoringRules ?? createDefaultScoringRules(),
    displaySettings: input.displaySettings ?? createDefaultDisplaySettings(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function normalizeScoreHistoryEntry(input: TriviaScoreAction): TriviaScoreAction {
  return {
    id: input.id,
    eventId: input.eventId,
    teamId: input.teamId,
    roundId: input.roundId ?? null,
    questionId: input.questionId ?? null,
    actionType: input.actionType ?? "manual",
    delta: Number.isFinite(input.delta) ? input.delta : 0,
    reason: input.reason || "Manual score update",
    previousScore: Number.isFinite(input.previousScore) ? input.previousScore : 0,
    newScore: Number.isFinite(input.newScore) ? input.newScore : 0,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

/** Reads the trivia module state from local storage with safe fallback to demo seed data. */
export function readTriviaState(): TriviaModuleState {
  if (typeof window === "undefined") {
    return createDefaultTriviaState();
  }

  const raw = window.localStorage.getItem(TRIVIA_STORAGE_KEY);
  if (!raw) {
    const seeded = createDefaultTriviaState();
    window.localStorage.setItem(TRIVIA_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as TriviaModuleState;
    if (!parsed || !Array.isArray(parsed.events) || typeof parsed.liveByEventId !== "object") {
      const seeded = createDefaultTriviaState();
      window.localStorage.setItem(TRIVIA_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return ensureLiveStateCoverage(parsed);
  } catch {
    const seeded = createDefaultTriviaState();
    window.localStorage.setItem(TRIVIA_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

/** Writes trivia module state and emits sync events for other tabs and pop-out windows. */
export function writeTriviaState(next: TriviaModuleState): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(TRIVIA_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(TRIVIA_EVENT_NAME, { detail: { at: Date.now() } }));

  if (typeof window.BroadcastChannel !== "undefined") {
    const channel = new window.BroadcastChannel(TRIVIA_BROADCAST_CHANNEL);
    channel.postMessage({ type: "state-updated", at: Date.now() });
    channel.close();
  }
}

/** Subscribes to module state updates from current tab and other windows. */
export function subscribeTriviaState(onStateChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onWindowEvent = () => onStateChange();
  window.addEventListener(TRIVIA_EVENT_NAME, onWindowEvent);

  let channel: BroadcastChannel | null = null;
  if (typeof window.BroadcastChannel !== "undefined") {
    channel = new window.BroadcastChannel(TRIVIA_BROADCAST_CHANNEL);
    channel.onmessage = () => onStateChange();
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === TRIVIA_STORAGE_KEY) {
      onStateChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(TRIVIA_EVENT_NAME, onWindowEvent);
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
}

/** Ensures each event has a valid live-state record after loading persisted state. */
export function ensureLiveStateCoverage(state: TriviaModuleState): TriviaModuleState {
  const normalizedEvents = state.events.map(normalizeEvent);
  const liveByEventId: Record<string, TriviaLiveState> = { ...state.liveByEventId };
  const scoreHistoryByEventId: Record<string, TriviaScoreAction[]> = { ...(state.scoreHistoryByEventId ?? {}) };

  normalizedEvents.forEach((event) => {
    if (!liveByEventId[event.id]) {
      liveByEventId[event.id] = createDefaultLiveState(event);
    } else {
      const live = liveByEventId[event.id];
      liveByEventId[event.id] = {
        ...live,
        activeRoundId: live.activeRoundId || event.rounds[0]?.id || "",
        activeQuestionIndex: Number.isFinite(live.activeQuestionIndex) ? live.activeQuestionIndex : 0,
        timerDefaultSec: Number.isFinite(live.timerDefaultSec) ? live.timerDefaultSec : 30,
        timerRemainingSec: Number.isFinite(live.timerRemainingSec) ? live.timerRemainingSec : 30,
        timerRunning: Boolean(live.timerRunning),
        updatedAt: live.updatedAt || new Date().toISOString(),
        stage: DISPLAY_STAGES.has(String(live.stage)) ? live.stage : (event.displaySettings.defaultStage || "welcome"),
        leaderboardVisible: Boolean(live.leaderboardVisible),
        answerRevealed: Boolean(live.answerRevealed),
        displayOpenedAt: live.displayOpenedAt ?? null,
        winnerTeamId: live.winnerTeamId ?? null,
        lastHostAction: live.lastHostAction || "Ready",
        lastScoreActionAt: live.lastScoreActionAt ?? null,
        lastScoreActionSummary: live.lastScoreActionSummary || "No score actions yet",
        projectorConnectionStatus: live.projectorConnectionStatus ?? "offline",
        scorekeeperConnectionStatus: live.scorekeeperConnectionStatus ?? "offline",
        checkInOpenedAt: live.checkInOpenedAt ?? null,
        checkInClosedAt: live.checkInClosedAt ?? null,
        lastSyncedAt: live.lastSyncedAt ?? null,
      };
    }

    if (!Array.isArray(scoreHistoryByEventId[event.id])) {
      scoreHistoryByEventId[event.id] = [];
    } else {
      scoreHistoryByEventId[event.id] = scoreHistoryByEventId[event.id].map(normalizeScoreHistoryEntry);
    }
  });

  return {
    events: normalizedEvents,
    liveByEventId,
    scoreHistoryByEventId,
  };
}

/** Utility for replacing a single event while preserving all other state records. */
export function replaceEvent(state: TriviaModuleState, nextEvent: TriviaEvent): TriviaModuleState {
  return {
    ...state,
    events: state.events.map((event) => (event.id === nextEvent.id ? nextEvent : event)),
  };
}
