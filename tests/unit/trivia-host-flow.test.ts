import { describe, expect, it } from "vitest";
import { getTriviaHostFlow } from "@/app/apps/trivia/lib/trivia-host-flow";
import { createSampleTriviaEvent } from "@/app/apps/trivia/lib/trivia-sample-data";
import { createDefaultLiveState } from "@/app/apps/trivia/lib/trivia-demo-data";

describe("guided trivia host flow", () => {
  it("starts by showing the selected question without starting the clock", () => {
    const event = createSampleTriviaEvent("host-flow");
    const flow = getTriviaHostFlow(event, createDefaultLiveState(event), 30);
    expect(flow).toMatchObject({ state: "Ready", action: "show_question", label: "Show question" });
  });

  it("offers reveal for legacy timed questions without starting a timer", () => {
    const event = createSampleTriviaEvent("host-flow");
    const live = { ...createDefaultLiveState(event), stage: "question" as const };
    expect(getTriviaHostFlow(event, live, 30).action).toBe("reveal");
    expect(getTriviaHostFlow(event, { ...live, timerRunning: true }, 12)).toMatchObject({ state: "Question ready", action: "reveal" });
    expect(getTriviaHostFlow(event, { ...live, timerRunning: true }, 0)).toMatchObject({ state: "Question ready", action: "reveal" });
  });

  it("offers manual reveal regardless of legacy clock values", () => {
    const event = createSampleTriviaEvent("host-flow");
    const live = { ...createDefaultLiveState(event), stage: "question" as const };
    expect(getTriviaHostFlow(event, { ...live, timerDefaultSec: 30 }, 12)).toMatchObject({ state: "Question ready", label: "Reveal answer" });
    event.rounds[0].questions[0].timeLimitSec = 0;
    expect(getTriviaHostFlow(event, { ...live, timerDefaultSec: 0 }, 0)).toMatchObject({ state: "Question ready", action: "reveal" });
  });

  it("keeps legacy questions manually controlled", () => {
    const event = createSampleTriviaEvent("host-flow");
    const live = { ...createDefaultLiveState(event), stage: "question" as const, timerDefaultSec: 0, timerRemainingSec: 0 };
    expect(event.rounds[0].questions[0].timeLimitSec).toBeGreaterThan(0);
    expect(getTriviaHostFlow(event, live, 0)).toMatchObject({ state: "Question ready", action: "reveal" });
  });

  it("advances one question after reveal, then the next round, and ends at leaderboard", () => {
    const event = createSampleTriviaEvent("host-flow");
    const live = { ...createDefaultLiveState(event), stage: "answer" as const, answerRevealed: true };
    event.rounds[0].questions.push({ ...event.rounds[0].questions[0], id: "second" });
    expect(getTriviaHostFlow(event, live, 0).action).toBe("next_question");
    live.activeQuestionIndex = event.rounds[0].questions.length - 1;
    const nextRound = getTriviaHostFlow(event, live, 0);
    expect(nextRound.action).toBe(event.rounds.length > 1 ? "next_round" : "leaderboard");
    live.activeRoundId = event.rounds.at(-1)!.id;
    live.activeQuestionIndex = event.rounds.at(-1)!.questions.length - 1;
    expect(getTriviaHostFlow(event, live, 0)).toMatchObject({ state: "Round complete", action: "leaderboard" });
  });

  it("does not carry an answer-revealed flag into a break or blank display", () => {
    const event = createSampleTriviaEvent("host-flow");
    const live = { ...createDefaultLiveState(event), stage: "blank" as const, answerRevealed: true };
    expect(getTriviaHostFlow(event, live, 0)).toMatchObject({ state: "Ready", action: "show_question" });
  });

  it("has an explicit unavailable state for an empty round", () => {
    const event = createSampleTriviaEvent("host-flow");
    event.rounds[0].questions = [];
    expect(getTriviaHostFlow(event, createDefaultLiveState(event), 0).action).toBeNull();
  });

  it("keeps the final review and winner display from offering to restart the last question", () => {
    const event = createSampleTriviaEvent("host-flow");
    const lastRound = event.rounds.at(-1)!;
    const live = { ...createDefaultLiveState(event), activeRoundId: lastRound.id, activeQuestionIndex: lastRound.questions.length - 1, stage: "leaderboard" as const };
    expect(getTriviaHostFlow(event, live, 0)).toMatchObject({ state: "Final score review", action: null });
    expect(getTriviaHostFlow(event, { ...live, stage: "winner" }, 0)).toMatchObject({ state: "Winner selected", action: null });
  });
});
