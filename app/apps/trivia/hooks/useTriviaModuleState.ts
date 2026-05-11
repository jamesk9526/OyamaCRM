// React hook for fully functional trivia module state and actions.
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  TriviaDisplayStage,
  TriviaEvent,
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
  active?: boolean;
  color?: string;
  icon?: string;
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

  useEffect(() => {
    const unsubscribe = subscribeTriviaState(() => {
      setState(readTriviaState());
    });

    return unsubscribe;
  }, []);

  function commit(next: TriviaModuleState) {
    const normalized = ensureLiveStateCoverage(next);
    setState(normalized);
    writeTriviaState(normalized);
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
    if (!event) return;

    const nextEvent: TriviaEvent = {
      ...event,
      status,
      updatedAt: new Date().toISOString(),
    };

    replaceStateWithEvent(nextEvent);
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
      score: 0,
      bonusPoints: 0,
      active: true,
      color: input.color ?? TEAM_COLORS[nextOrder % TEAM_COLORS.length],
      icon: input.icon ?? TEAM_ICONS[nextOrder % TEAM_ICONS.length],
      sortOrder: nextOrder,
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
      return {
        ...team,
        name: input.name ?? team.name,
        players: input.players ?? team.players,
        active: typeof input.active === "boolean" ? input.active : team.active,
        color: input.color ?? team.color,
        icon: input.icon ?? team.icon,
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
    };
    nextState.scoreHistoryByEventId[eventId] = [...(state.scoreHistoryByEventId[eventId] ?? []), scoreAction];

    commit(nextState);
  }

  function undoLastScoreAction(eventId: string) {
    const event = state.events.find((item) => item.id === eventId);
    const live = state.liveByEventId[eventId];
    const history = state.scoreHistoryByEventId[eventId] ?? [];
    if (!event || !live || history.length === 0) return;

    const lastAction = history[history.length - 1];
    const teams = event.teams.map((team) => {
      if (team.id !== lastAction.teamId) return team;
      return {
        ...team,
        score: lastAction.previousScore,
      };
    });

    const nextEvent: TriviaEvent = {
      ...event,
      teams,
      updatedAt: new Date().toISOString(),
    };

    const nextState = replaceEvent(state, nextEvent);
    nextState.scoreHistoryByEventId[eventId] = history.slice(0, -1);
    nextState.liveByEventId[eventId] = {
      ...live,
      lastHostAction: "Undid last scoring action",
      updatedAt: new Date().toISOString(),
    };

    commit(nextState);
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
      answerRevealed: stage === "answer",
      timerRunning: stage === "question" || stage === "timer_only" || stage === "final_question" || stage === "tiebreaker"
        ? live.timerRunning
        : false,
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
      updatedAt: new Date().toISOString(),
      lastHostAction: "Projector display opened",
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
      const parsed = JSON.parse(inputJson) as TriviaEvent[];
      if (!Array.isArray(parsed)) {
        return { ok: false, message: "Import failed: JSON must be an array of events." };
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

  const api = useMemo(() => {
    return {
      state,
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
      undoLastScoreAction,
      setActiveRound,
      setQuestionIndex,
      setDisplayStage,
      setWinner,
      setTimerRunning,
      setTimerRemaining,
      resetTimer,
      markProjectorOpened,
      deleteEvent,
      importEventsFromJson,
    };
  }, [state]);

  return api;
}
