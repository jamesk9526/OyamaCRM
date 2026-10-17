import { describe, expect, it, vi } from "vitest";

// Keep one render's callbacks to reproduce actions batched before React rerenders.
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
}));
vi.mock("@/app/apps/trivia/lib/trivia-state-provider", () => ({ readTriviaSyncMode: () => "local" }));
vi.mock("@/app/apps/trivia/lib/trivia-store", async (original) => ({
  ...await original<object>(),
  readTriviaState: () => ({ events: [], liveByEventId: {}, scoreHistoryByEventId: {} }),
  writeTriviaState: vi.fn(),
}));

import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import type { TriviaModuleState } from "@/app/apps/trivia/lib/trivia-types";

describe("Trivia actions before the next render", () => {
  it("renumbers a table without changing its team, players, or score and rejects duplicates", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    const team = event.teams[0];
    expect(api.updateTeam(event.id, team.id, { tableNumber: "9999" })).toEqual({ ok: true });
    const saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events[0].teams.find((item) => item.id === team.id)).toMatchObject({
      id: team.id, name: team.name, players: team.players, score: team.score, tableNumber: "9999",
    });
    const before = api.exportStatePackage();
    expect(api.updateTeam(event.id, event.teams[1].id, { tableNumber: "9999" }).ok).toBe(false);
    for (const tableNumber of ["", "0", "-1", "1.5", "10000"]) {
      expect(api.updateTeam(event.id, team.id, { tableNumber }).ok).toBe(false);
    }
    expect(api.exportStatePackage()).toBe(before);
  });

  it("undoes the actual deducted points when a penalty reaches the zero floor", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    const team = event.teams[0];
    api.applyScoreAction(event.id, { teamId: team.id, delta: -team.score + 3, actionType: "manual", reason: "Set score to three" });
    api.applyScoreAction(event.id, { teamId: team.id, delta: -10, actionType: "penalty", reason: "Penalty" });
    let saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events[0].teams[0].score).toBe(0);
    expect(saved.scoreHistoryByEventId[event.id].at(-1)?.delta).toBe(-3);
    api.undoLastScoreAction(event.id);
    saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events[0].teams[0].score).toBe(3);
  });

  it("rejects finite adjustments whose sum overflows instead of corrupting the score", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    const teamId = event.teams[0].id;
    api.applyScoreAction(event.id, { teamId, delta: Number.MAX_VALUE, actionType: "manual", reason: "Large score" });
    const before = api.exportStatePackage();
    api.applyScoreAction(event.id, { teamId, delta: Number.MAX_VALUE, actionType: "manual", reason: "Overflow" });
    expect(api.exportStatePackage()).toBe(before);
  });

  it("preserves both scoring actions and can undo only the last action", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    const teamId = event.teams[0].id;
    const score = event.teams[0].score;
    api.applyScoreAction(event.id, { teamId, delta: 10, actionType: "manual", reason: "First answer" });
    api.applyScoreAction(event.id, { teamId, delta: 5, actionType: "manual", reason: "Second answer" });
    let saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events[0].teams[0].score).toBe(score + 15);
    expect(saved.scoreHistoryByEventId[event.id]).toHaveLength(2);
    api.undoLastScoreAction(event.id);
    saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events[0].teams[0].score).toBe(score + 10);
  });

  it("preserves a timer change when the host changes display stage immediately", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    api.setTimerRemaining(event.id, 12);
    api.setDisplayStage(event.id, "question", "Show question");
    const saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.liveByEventId[event.id].timerRemainingSec).toBe(12);
    expect(saved.liveByEventId[event.id].stage).toBe("question");
  });

  it("ignores missing rounds and invalid question indexes without losing the current question", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    const before = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    api.setActiveRound(event.id, "missing-round");
    api.setQuestionIndex(event.id, Number.NaN);
    const saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.liveByEventId[event.id]).toEqual(before.liveByEventId[event.id]);
  });

  it("does not restart an expired or untimed question timer", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    api.setTimerRemaining(event.id, 0);
    api.setTimerRunning(event.id, true);
    let saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.liveByEventId[event.id].timerRunning).toBe(false);
    api.resetTimer(event.id, 0);
    api.setTimerRemaining(event.id, 5);
    api.setTimerRunning(event.id, true);
    saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.liveByEventId[event.id].timerRunning).toBe(false);
  });

  it("rejects non-finite scores and disallowed partial credit", () => {
    const api = useTriviaModuleState();
    const event = api.createSampleEvent();
    api.updateEventSettings(event.id, { ...event.scoringRules, ...event.displaySettings, allowPartialCredit: false });
    const before = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    for (const delta of [Number.NaN, Number.POSITIVE_INFINITY]) {
      api.applyScoreAction(event.id, { teamId: event.teams[0].id, delta, actionType: "manual", reason: "Invalid" });
    }
    api.applyScoreAction(event.id, { teamId: event.teams[0].id, delta: 5, actionType: "partial", reason: "Partial" });
    const saved = JSON.parse(api.exportStatePackage()) as TriviaModuleState;
    expect(saved.events).toEqual(before.events);
    expect(saved.scoreHistoryByEventId).toEqual(before.scoreHistoryByEventId);
  });
});

