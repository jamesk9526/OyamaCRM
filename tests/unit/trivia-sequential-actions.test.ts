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

