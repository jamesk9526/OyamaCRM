// React hook for fully functional trivia module state and actions.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TriviaCheckInStatus,
  TriviaConnectionStatus,
  TriviaDisplayStage,
  TriviaEventAuditEvent,
  TriviaEvent,
  TriviaEventSnapshot,
  TriviaEventStatus,
  TriviaModuleState,
  TriviaQuestion,
  TriviaQuestionType,
  TriviaRound,
  TriviaRoundType,
  TriviaScoreAction,
  TriviaScoreActionType,
  TriviaTeam,
} from "@/app/apps/trivia/lib/trivia-types";
import {
  createTriviaId,
  ensureLiveStateCoverage,
  readTriviaState,
  replaceEvent,
  subscribeTriviaState,
  writeTriviaState,
} from "@/app/apps/trivia/lib/trivia-store";
import { createDefaultDisplaySettings, createDefaultLiveState, createDefaultScoringRules } from "@/app/apps/trivia/lib/trivia-demo-data";
import { createSampleTriviaEvent } from "@/app/apps/trivia/lib/trivia-sample-data";
import {
  createServerTriviaSnapshot,
  listServerTriviaAudit,
  listServerTriviaSnapshots,
  loadServerTriviaState,
  recoverServerTriviaSnapshot,
  readTriviaSyncMode,
  saveServerTriviaState,
  type TriviaSyncMode,
  writeTriviaSyncMode,
} from "@/app/apps/trivia/lib/trivia-state-provider";

interface CreateTriviaEventInput {
  name: string;
  venue: string;
  hostName: string;
  startAt: string;
}

interface AddTeamInput {
  name: string;
  players: string[];
  color?: string;
  icon?: string;
}

interface AddRoundInput {
  title: string;
  description: string;
  roundType: TriviaRoundType;
}

interface AddQuestionInput {
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

interface UpdateEventSettingsInput {
  defaultQuestionPoints: number;
  allowPartialCredit: boolean;
  allowNegativeScores: boolean;
  finalWagerEnabled: boolean;
  tieBreakerMode: "single_question" | "sudden_death";
  highContrast: boolean;
  showTeamColors: boolean;
  showTimerOnQuestion: boolean;
}

interface ApplyScoreActionInput {
  teamId: string;
  delta: number;
  actionType: TriviaScoreActionType;
  reason: string;
  roundId?: string | null;
  questionId?: string | null;
}

interface UpdateTeamInput {
  name?: string;
  players?: string[];
  playerCount?: number;
  active?: boolean;
  color?: string;
  icon?: string;
  checkInStatus?: TriviaCheckInStatus;
  checkedInAt?: string | null;
  tableNumber?: string;
  captainName?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

const TEAM_COLORS = ["#34d399", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185"];
const TEAM_ICONS = ["star", "bolt", "brain", "crown", "rocket", "shield"];

function normalizeTeamOrder(teams: TriviaTeam[]): TriviaTeam[] {
  return [...teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((team, index) => ({ ...team, sortOrder: index }));
}

/**
 * useTriviaModuleState offers fully working CRUD and live-control actions for the standalone trivia app.
 * Data persists in browser local storage under a dedicated trivia namespace.
 */
export function useTriviaModuleState() {
  const [state, setState] = useState<TriviaModuleState>(() => readTriviaState());
  const [syncMode, setSyncModeState] = useState<TriviaSyncMode>(() => readTriviaSyncMode());
  const [connectionStatus, setConnectionStatus] = useState<TriviaConnectionStatus>(() => (readTriviaSyncMode() === "server" ? "reconnecting" : "connected"));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [snapshotsByEventId, setSnapshotsByEventId] = useState<Record<string, TriviaEventSnapshot[]>>({});
  const [auditByEventId, setAuditByEventId] = useState<Record<string, TriviaEventAuditEvent[]>>({});
  const stateRef = useRef(state);
  const serverSyncQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const unsubscribe = subscribeTriviaState(() => {
      const next = readTriviaState();
      stateRef.current = next;
      setState(next);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    if (syncMode !== "server") {
      setConnectionStatus("connected");
      setSyncError(null);
      return () => {
        active = false;
      };
    }

    const pullServerState = async (replaceLocal: boolean) => {
      setConnectionStatus("reconnecting");
      try {
        const payload = await loadServerTriviaState();
        if (!active) return;
        const normalized = ensureLiveStateCoverage(payload.state);

        if (replaceLocal || JSON.stringify(normalized) !== JSON.stringify(stateRef.current)) {
          stateRef.current = normalized;
          setState(normalized);
          writeTriviaState(normalized);
        }

        setLastSyncedAt(payload.updatedAt ?? new Date().toISOString());
        setConnectionStatus("connected");
        setSyncError(null);
      } catch (error) {
        if (!active) return;
        setConnectionStatus("offline");
        setSyncError(error instanceof Error ? error.message : "Unable to sync trivia state from server.");
      }
    };

    void pullServerState(true);

    const intervalId = window.setInterval(() => {
      void pullServerState(false);
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [syncMode]);

  function enqueueServerSync(nextState: TriviaModuleState) {
    serverSyncQueueRef.current = serverSyncQueueRef.current.then(async () => {
      setConnectionStatus("reconnecting");
      try {
        const payload = await saveServerTriviaState(nextState);
        setConnectionStatus("connected");
        setLastSyncedAt(payload.updatedAt ?? new Date().toISOString());
        setSyncError(null);
      } catch (error) {
        setConnectionStatus("offline");
        setSyncError(error instanceof Error ? error.message : "Unable to push trivia state to server.");
      }
    });
  }

  function commit(next: TriviaModuleState, options?: { skipServerSync?: boolean }) {
    const normalized = ensureLiveStateCoverage(next);
    stateRef.current = normalized;
    setState(normalized);
    writeTriviaState(normalized);

    if (syncMode === "server" && !options?.skipServerSync) {
      enqueueServerSync(normalized);
    }
  }

  function setSyncMode(mode: TriviaSyncMode) {
    setSyncModeState(mode);
    writeTriviaSyncMode(mode);
    if (mode === "local") {
      setConnectionStatus("connected");
      setSyncError(null);
    } else {
      setConnectionStatus("reconnecting");
    }
  }

  async function refreshFromServer(): Promise<void> {
    if (syncMode !== "server") return;
    setConnectionStatus("reconnecting");
    try {
      const payload = await loadServerTriviaState();
      const normalized = ensureLiveStateCoverage(payload.state);
      commit(normalized, { skipServerSync: true });
      setLastSyncedAt(payload.updatedAt ?? new Date().toISOString());
      setConnectionStatus("connected");
      setSyncError(null);
    } catch (error) {
      setConnectionStatus("offline");
      setSyncError(error instanceof Error ? error.message : "Unable to refresh trivia state from server.");
    }
  }

  function replaceStateWithEvent(nextEvent: TriviaEvent) {
    const nextState = replaceEvent(state, nextEvent);
    commit(nextState);
  }

  function createEvent(input: CreateTriviaEventInput): TriviaEvent {
    const nowIso = new Date().toISOString();
    const eventId = createTriviaId("trivia-event");

    const nextEvent: TriviaEvent = {
      id: eventId,
      name: input.name,
      venue: input.venue,
      hostName: input.hostName,
      startAt: input.startAt,
      status: "draft",
      rounds: [],
      teams: [],
      scoringRules: createDefaultScoringRules(),
      displaySettings: createDefaultDisplaySettings(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextState: TriviaModuleState = {
      events: [nextEvent, ...state.events],
      liveByEventId: {
        ...state.liveByEventId,
        [eventId]: createDefaultLiveState(nextEvent),
      },
      scoreHistoryByEventId: {
        ...state.scoreHistoryByEventId,
        [eventId]: [],
      },
    };

    commit(nextState);
    return nextEvent;
  }

  function createSampleEvent(): TriviaEvent {
    const eventId = createTriviaId("trivia-event");
    const sampleEvent = createSampleTriviaEvent(eventId);

    const nextState: TriviaModuleState = {
      events: [sampleEvent, ...state.events],
      liveByEventId: {
        ...state.liveByEventId,
        [eventId]: createDefaultLiveState(sampleEvent),
      },
      scoreHistoryByEventId: {
        ...state.scoreHistoryByEventId,
        [eventId]: [],
      },
    };

    commit(nextState);
    return sampleEvent;
  }

  function updateEventStatus(eventId: string, status: TriviaEventStatus) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    if (!event) return;

    const nextEvent: TriviaEvent = {
      ...event,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (!live) {
      replaceStateWithEvent(nextEvent);
      return;
    }

    const nextState = replaceEvent(state, nextEvent);
    nextState.liveByEventId[eventId] = {
      ...live,
      checkInOpenedAt: status === "check_in_open" ? live.checkInOpenedAt ?? new Date().toISOString() : live.checkInOpenedAt ?? null,
      checkInClosedAt: status === "live" || status === "paused" || status === "completed"
        ? live.checkInClosedAt ?? new Date().toISOString()
        : live.checkInClosedAt ?? null,
      lastHostAction: `Event status updated: ${status}`,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function updateEventSettings(eventId: string, input: UpdateEventSettingsInput) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    const nextEvent: TriviaEvent = {
      ...event,
      scoringRules: {
        defaultQuestionPoints: Math.max(1, input.defaultQuestionPoints),
        allowPartialCredit: input.allowPartialCredit,
        allowNegativeScores: input.allowNegativeScores,
        finalWagerEnabled: input.finalWagerEnabled,
        tieBreakerMode: input.tieBreakerMode,
      },
      displaySettings: {
        ...event.displaySettings,
        highContrast: input.highContrast,
        showTeamColors: input.showTeamColors,
        showTimerOnQuestion: input.showTimerOnQuestion,
      },
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
  }

  function addTeam(eventId: string, input: AddTeamInput) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    const nextOrder = event.teams.length;

    const nextTeam: TriviaTeam = {
      id: createTriviaId("team"),
      name: input.name,
      players: input.players,
      playerCount: input.players.length,
      score: 0,
      bonusPoints: 0,
      active: true,
      color: input.color ?? TEAM_COLORS[nextOrder % TEAM_COLORS.length],
      icon: input.icon ?? TEAM_ICONS[nextOrder % TEAM_ICONS.length],
      sortOrder: nextOrder,
      checkInStatus: "expected",
      checkedInAt: null,
      tableNumber: "",
      captainName: "",
      contactName: "",
      contactPhone: "",
      notes: "",
    };

    const nextEvent: TriviaEvent = {
      ...event,
      teams: normalizeTeamOrder([...event.teams, nextTeam]),
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
  }

  function updateTeam(eventId: string, teamId: string, input: UpdateTeamInput) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    const teams = event.teams.map((team) => {
      if (team.id !== teamId) return team;

      const nextCheckInStatus = input.checkInStatus ?? team.checkInStatus;
      const nextActive = typeof input.active === "boolean"
        ? input.active
        : nextCheckInStatus === "inactive" || nextCheckInStatus === "dropped"
          ? false
          : team.active;

      return {
        ...team,
        name: input.name ?? team.name,
        players: input.players ?? team.players,
        playerCount: input.playerCount ?? team.playerCount ?? (input.players ?? team.players).length,
        active: nextActive,
        color: input.color ?? team.color,
        icon: input.icon ?? team.icon,
        checkInStatus: nextCheckInStatus,
        checkedInAt: input.checkedInAt !== undefined
          ? input.checkedInAt
          : (nextCheckInStatus === "checked_in" || nextCheckInStatus === "late")
            ? team.checkedInAt ?? new Date().toISOString()
            : team.checkedInAt ?? null,
        tableNumber: input.tableNumber ?? team.tableNumber,
        captainName: input.captainName ?? team.captainName,
        contactName: input.contactName ?? team.contactName,
        contactPhone: input.contactPhone ?? team.contactPhone,
        notes: input.notes ?? team.notes,
      };
    });

    const nextEvent: TriviaEvent = {
      ...event,
      teams: normalizeTeamOrder(teams),
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
  }

  function reorderTeam(eventId: string, teamId: string, direction: -1 | 1) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    const ordered = normalizeTeamOrder(event.teams);
    const index = ordered.findIndex((team) => team.id === teamId);
    if (index < 0) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;

    const clone = [...ordered];
    const swap = clone[index];
    clone[index] = clone[nextIndex];
    clone[nextIndex] = swap;

    const nextEvent: TriviaEvent = {
      ...event,
      teams: normalizeTeamOrder(clone),
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
  }

  function removeTeam(eventId: string, teamId: string) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    if (!event || !live) return;

    const nextEvent: TriviaEvent = {
      ...event,
      teams: normalizeTeamOrder(event.teams.filter((team) => team.id !== teamId)),
      updatedAt: new Date().toISOString(),
    };

    const nextState = replaceEvent(state, nextEvent);
    nextState.liveByEventId[eventId] = {
      ...live,
      winnerTeamId: live.winnerTeamId === teamId ? null : live.winnerTeamId,
      updatedAt: new Date().toISOString(),
      lastHostAction: "Team removed",
    };

    const history = nextState.scoreHistoryByEventId[eventId] ?? [];
    nextState.scoreHistoryByEventId[eventId] = history.filter((entry) => entry.teamId !== teamId);
    commit(nextState);
  }

  function addRound(eventId: string, input: AddRoundInput): TriviaRound | null {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return null;

    const round: TriviaRound = {
      id: createTriviaId("round"),
      title: input.title,
      description: input.description,
      roundType: input.roundType,
      questions: [],
    };

    const nextEvent: TriviaEvent = {
      ...event,
      rounds: [...event.rounds, round],
      updatedAt: new Date().toISOString(),
    };

    const nextState = replaceEvent(state, nextEvent);
    const live = nextState.liveByEventId[eventId] ?? createDefaultLiveState(nextEvent);

    if (!live.activeRoundId) {
      nextState.liveByEventId[eventId] = {
        ...live,
        activeRoundId: round.id,
        activeQuestionIndex: 0,
        stage: "round_intro",
        lastHostAction: `Round created: ${round.title}`,
        updatedAt: new Date().toISOString(),
      };
    }

    commit(nextState);
    return round;
  }

  function addQuestion(eventId: string, roundId: string, input: AddQuestionInput) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    const rounds = event.rounds.map((round) => {
      if (round.id !== roundId) return round;

      const question: TriviaQuestion = {
        id: createTriviaId("question"),
        prompt: input.prompt,
        options: input.options,
        questionType: input.questionType,
        scoringAnswer: input.scoringAnswer,
        audienceAnswer: input.audienceAnswer,
        acceptedAnswers: input.acceptedAnswers,
        explanation: input.explanation,
        revealText: input.revealText,
        mediaUrl: input.mediaUrl,
        points: input.points,
        timeLimitSec: input.timeLimitSec,
        hostNotes: input.hostNotes,
      };

      return {
        ...round,
        questions: [...round.questions, question],
      };
    });

    const nextEvent: TriviaEvent = {
      ...event,
      rounds,
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
  }

  function applyScoreAction(eventId: string, input: ApplyScoreActionInput) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    if (!event || !live) return;

    let scoreAction: TriviaScoreAction | null = null;

    const teams = event.teams.map((team) => {
      if (team.id !== input.teamId) return team;
      const previousScore = team.score;
      const rawNextScore = team.score + input.delta;
      const nextScore = event.scoringRules.allowNegativeScores ? rawNextScore : Math.max(0, rawNextScore);

      scoreAction = {
        id: createTriviaId("score-action"),
        eventId,
        teamId: team.id,
        roundId: input.roundId ?? live.activeRoundId ?? null,
        questionId: input.questionId ?? null,
        actionType: input.actionType,
        delta: nextScore - previousScore,
        reason: input.reason,
        previousScore,
        newScore: nextScore,
        createdAt: new Date().toISOString(),
      };

      return {
        ...team,
        score: nextScore,
      };
    });

    if (!scoreAction) return;

    const nextEvent: TriviaEvent = {
      ...event,
      teams,
      updatedAt: new Date().toISOString(),
    };

    const nextState = replaceEvent(state, nextEvent);
    nextState.liveByEventId[eventId] = {
      ...live,
      updatedAt: new Date().toISOString(),
      lastHostAction: input.reason,
      lastScoreActionAt: scoreAction.createdAt,
      lastScoreActionSummary: `${scoreAction.actionType} ${scoreAction.delta >= 0 ? `+${scoreAction.delta}` : scoreAction.delta} (${scoreAction.reason})`,
    };
    nextState.scoreHistoryByEventId[eventId] = [...(state.scoreHistoryByEventId[eventId] ?? []), scoreAction];

    commit(nextState);
  }

  function undoScoreActionById(eventId: string, actionId: string) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    const history = state.scoreHistoryByEventId[eventId] ?? [];
    if (!event || !live || history.length === 0) return;

    const target = history.find((entry) => entry.id === actionId);
    if (!target) return;

    const teams = event.teams.map((team) => {
      if (team.id !== target.teamId) return team;
      const adjusted = team.score - target.delta;
      return {
        ...team,
        score: event.scoringRules.allowNegativeScores ? adjusted : Math.max(0, adjusted),
      };
    });

    const nextEvent: TriviaEvent = {
      ...event,
      teams,
      updatedAt: new Date().toISOString(),
    };

    const nextState = replaceEvent(state, nextEvent);
    nextState.scoreHistoryByEventId[eventId] = history.filter((entry) => entry.id !== actionId);
    const latest = nextState.scoreHistoryByEventId[eventId][nextState.scoreHistoryByEventId[eventId].length - 1] ?? null;
    nextState.liveByEventId[eventId] = {
      ...live,
      lastHostAction: "Undid scoring action",
      lastScoreActionAt: latest?.createdAt ?? null,
      lastScoreActionSummary: latest
        ? `${latest.actionType} ${latest.delta >= 0 ? `+${latest.delta}` : latest.delta} (${latest.reason})`
        : "No score actions yet",
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function undoLastScoreAction(eventId: string) {
    const history = state.scoreHistoryByEventId[eventId] ?? [];
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    undoScoreActionById(eventId, lastAction.id);
  }

  function setActiveRound(eventId: string, roundId: string) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    if (!event || !live) return;

    const round = event.rounds.find((item) => item.id === roundId);
    const question = round?.questions[0];

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      activeRoundId: roundId,
      activeQuestionIndex: 0,
      stage: "round_intro",
      timerDefaultSec: question?.timeLimitSec ?? 30,
      timerRemainingSec: question?.timeLimitSec ?? 30,
      timerRunning: false,
      answerRevealed: false,
      lastHostAction: `Round set to ${round?.title ?? "Round"}`,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setQuestionIndex(eventId: string, nextIndex: number) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    if (!event || !live) return;

    const activeRound = event.rounds.find((round) => round.id === live.activeRoundId);
    if (!activeRound || activeRound.questions.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(nextIndex, activeRound.questions.length - 1));
    const question = activeRound.questions[boundedIndex];
    const stage: TriviaDisplayStage =
      activeRound.roundType === "final_wager"
        ? "final_question"
        : activeRound.roundType === "tiebreaker"
          ? "tiebreaker"
          : "question";

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      activeQuestionIndex: boundedIndex,
      stage,
      timerDefaultSec: question.timeLimitSec,
      timerRemainingSec: question.timeLimitSec,
      timerRunning: false,
      answerRevealed: false,
      winnerTeamId: null,
      lastHostAction: `Question ${boundedIndex + 1}`,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setDisplayStage(eventId: string, stage: TriviaDisplayStage, actionLabel: string) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      stage,
      leaderboardVisible: stage === "leaderboard",
      answerRevealed: stage === "answer" || stage === "explanation",
      timerRunning: stage === "question" || stage === "timer_only" || stage === "final_question" || stage === "tiebreaker"
        ? live.timerRunning
        : false,
      checkInOpenedAt: stage === "check_in_open" ? live.checkInOpenedAt ?? new Date().toISOString() : live.checkInOpenedAt ?? null,
      checkInClosedAt: stage === "check_in_closed" ? live.checkInClosedAt ?? new Date().toISOString() : live.checkInClosedAt ?? null,
      lastHostAction: actionLabel,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setWinner(eventId: string, teamId: string | null) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      stage: "winner",
      winnerTeamId: teamId,
      timerRunning: false,
      lastHostAction: "Winner screen",
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setTimerRunning(eventId: string, running: boolean) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      timerRunning: running,
      lastHostAction: running ? "Timer started" : "Timer paused",
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setTimerRemaining(eventId: string, remainingSec: number) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const bounded = Math.max(0, remainingSec);

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      timerRemainingSec: bounded,
      timerRunning: bounded > 0 ? live.timerRunning : false,
      lastHostAction: bounded === 0 ? "Timer completed" : live.lastHostAction,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function resetTimer(eventId: string, nextDefaultSec?: number) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const defaultSec = nextDefaultSec ?? live.timerDefaultSec;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      timerDefaultSec: defaultSec,
      timerRemainingSec: defaultSec,
      timerRunning: false,
      lastHostAction: "Timer reset",
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function markProjectorOpened(eventId: string) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      displayOpenedAt: live.displayOpenedAt ?? new Date().toISOString(),
      projectorConnectionStatus: "connected",
      updatedAt: new Date().toISOString(),
      lastHostAction: "Projector display opened",
    };

    commit(nextState);
  }

  function setProjectorConnectionStatus(eventId: string, status: TriviaConnectionStatus) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      projectorConnectionStatus: status,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function setScorekeeperConnectionStatus(eventId: string, status: TriviaConnectionStatus) {
    const live = state.liveByEventId[eventId];
    if (!live) return;

    const nextState = { ...state, liveByEventId: { ...state.liveByEventId } };
    nextState.liveByEventId[eventId] = {
      ...live,
      scorekeeperConnectionStatus: status,
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
  }

  function deleteEvent(eventId: string) {
    const nextEvents = state.events.filter((event) => event.id !== eventId);
    const nextLiveByEventId = { ...state.liveByEventId };
    const nextScoreHistoryByEventId = { ...state.scoreHistoryByEventId };
    delete nextLiveByEventId[eventId];
    delete nextScoreHistoryByEventId[eventId];

    commit({ events: nextEvents, liveByEventId: nextLiveByEventId, scoreHistoryByEventId: nextScoreHistoryByEventId });
  }

  function importEventsFromJson(inputJson: string): { ok: boolean; message: string } {
    try {
      const parsed = JSON.parse(inputJson) as unknown;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "events" in parsed) {
        const maybeState = parsed as TriviaModuleState;
        if (!Array.isArray(maybeState.events) || typeof maybeState.liveByEventId !== "object") {
          return { ok: false, message: "Import failed: invalid full-state package." };
        }

        commit(maybeState);
        return { ok: true, message: `Imported full state with ${maybeState.events.length} event(s).` };
      }

      if (!Array.isArray(parsed)) {
        return { ok: false, message: "Import failed: JSON must be an event array or full state package." };
      }

      const cleaned = parsed
        .filter((event) => event && typeof event.id === "string" && typeof event.name === "string")
        .map((event) => ({
          ...event,
          rounds: Array.isArray(event.rounds) ? event.rounds : [],
          teams: Array.isArray(event.teams) ? event.teams : [],
          scoringRules: event.scoringRules ?? createDefaultScoringRules(),
          displaySettings: event.displaySettings ?? createDefaultDisplaySettings(),
          updatedAt: new Date().toISOString(),
        }));

      const liveByEventId = { ...state.liveByEventId };
      const scoreHistoryByEventId = { ...state.scoreHistoryByEventId };
      cleaned.forEach((event) => {
        if (!liveByEventId[event.id]) {
          liveByEventId[event.id] = createDefaultLiveState(event);
        }

        if (!scoreHistoryByEventId[event.id]) {
          scoreHistoryByEventId[event.id] = [];
        }
      });

      commit({
        events: cleaned,
        liveByEventId,
        scoreHistoryByEventId,
      });

      return { ok: true, message: `Imported ${cleaned.length} event(s).` };
    } catch {
      return { ok: false, message: "Import failed: invalid JSON format." };
    }
  }

  function exportStatePackage(): string {
    return JSON.stringify(state, null, 2);
  }

  async function createEventSnapshot(eventId: string, label = "Manual snapshot"): Promise<TriviaEventSnapshot> {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    const scoreHistory = state.scoreHistoryByEventId[eventId] ?? [];
    if (!event || !live) {
      throw new Error("Unable to create snapshot: event not found.");
    }

    if (syncMode === "server") {
      const snapshot = await createServerTriviaSnapshot(eventId, label);
      setSnapshotsByEventId((previous) => ({
        ...previous,
        [eventId]: [snapshot, ...(previous[eventId] ?? [])],
      }));
      return snapshot;
    }

    const localSnapshot: TriviaEventSnapshot = {
      id: createTriviaId("snapshot"),
      eventId,
      label,
      capturedAt: new Date().toISOString(),
      event: JSON.parse(JSON.stringify(event)) as TriviaEvent,
      live: JSON.parse(JSON.stringify(live)),
      scoreHistory: JSON.parse(JSON.stringify(scoreHistory)),
    };

    setSnapshotsByEventId((previous) => ({
      ...previous,
      [eventId]: [localSnapshot, ...(previous[eventId] ?? [])].slice(0, 50),
    }));
    return localSnapshot;
  }

  async function loadEventSnapshots(eventId: string): Promise<TriviaEventSnapshot[]> {
    if (syncMode === "server") {
      const snapshots = await listServerTriviaSnapshots(eventId);
      setSnapshotsByEventId((previous) => ({ ...previous, [eventId]: snapshots }));
      return snapshots;
    }

    return snapshotsByEventId[eventId] ?? [];
  }

  async function recoverEventSnapshot(eventId: string, snapshotId: string): Promise<void> {
    if (syncMode === "server") {
      const payload = await recoverServerTriviaSnapshot(eventId, snapshotId);
      commit(payload.state, { skipServerSync: true });
      setLastSyncedAt(new Date().toISOString());
      setConnectionStatus("connected");
      return;
    }

    const localSnapshot = (snapshotsByEventId[eventId] ?? []).find((snapshot) => snapshot.id === snapshotId);
    if (!localSnapshot) {
      throw new Error("Snapshot not found.");
    }

    const nextEvents = state.events.map((event) => (event.id === eventId ? localSnapshot.event : event));
    const nextLiveByEventId = {
      ...state.liveByEventId,
      [eventId]: localSnapshot.live,
    };
    const nextScoreHistoryByEventId = {
      ...state.scoreHistoryByEventId,
      [eventId]: localSnapshot.scoreHistory,
    };

    commit({
      events: nextEvents,
      liveByEventId: nextLiveByEventId,
      scoreHistoryByEventId: nextScoreHistoryByEventId,
    });
  }

  async function loadEventAudit(eventId: string): Promise<TriviaEventAuditEvent[]> {
    if (syncMode === "server") {
      const auditEntries = await listServerTriviaAudit(eventId);
      setAuditByEventId((previous) => ({ ...previous, [eventId]: auditEntries }));
      return auditEntries;
    }

    const localHistory = state.scoreHistoryByEventId[eventId] ?? [];
    const localAudit = [...localHistory].reverse().map((entry) => ({
      id: entry.id,
      eventId,
      type: "score" as const,
      message: `${entry.actionType} ${entry.delta >= 0 ? `+${entry.delta}` : entry.delta} (${entry.reason})`,
      createdAt: entry.createdAt,
      metadata: {
        teamId: entry.teamId,
        previousScore: entry.previousScore,
        newScore: entry.newScore,
      },
    }));

    const localSnapshotAudit = (snapshotsByEventId[eventId] ?? []).map((snapshot) => ({
      id: `snapshot-audit-${snapshot.id}`,
      eventId,
      type: "snapshot" as const,
      message: `Snapshot captured: ${snapshot.label}`,
      createdAt: snapshot.capturedAt,
      metadata: { snapshotId: snapshot.id },
    }));

    const merged = [...localAudit, ...localSnapshotAudit]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setAuditByEventId((previous) => ({ ...previous, [eventId]: merged }));
    return merged;
  }

  const api = useMemo(() => {
    return {
      state,
      syncMode,
      connectionStatus,
      lastSyncedAt,
      syncError,
      snapshotsByEventId,
      auditByEventId,
      setSyncMode,
      refreshFromServer,
      createEvent,
      createSampleEvent,
      updateEventStatus,
      updateEventSettings,
      addTeam,
      updateTeam,
      reorderTeam,
      removeTeam,
      addRound,
      addQuestion,
      applyScoreAction,
      undoScoreActionById,
      undoLastScoreAction,
      setActiveRound,
      setQuestionIndex,
      setDisplayStage,
      setWinner,
      setTimerRunning,
      setTimerRemaining,
      resetTimer,
      markProjectorOpened,
      setProjectorConnectionStatus,
      setScorekeeperConnectionStatus,
      deleteEvent,
      createEventSnapshot,
      loadEventSnapshots,
      recoverEventSnapshot,
      loadEventAudit,
      exportStatePackage,
      importEventsFromJson,
    };
  }, [
    state,
    syncMode,
    connectionStatus,
    lastSyncedAt,
    syncError,
    snapshotsByEventId,
    auditByEventId,
  ]);

  return api;
}
