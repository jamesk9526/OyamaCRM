import { describe, expect, it } from "vitest";
import { remainingTriviaSeconds } from "@/app/apps/trivia/lib/trivia-timer";

const started = Date.parse("2026-10-16T18:00:00.000Z");
const live = { timerRunning: true, timerRemainingSec: 30, timerEndsAt: new Date(started + 30_000).toISOString(), updatedAt: new Date(started).toISOString() };
describe("deadline countdown", () => {
  it("continues accurately without a host tick or timer write", () => {
    expect(remainingTriviaSeconds(live, started + 12_300)).toBe(18);
    expect(remainingTriviaSeconds(live, started + 45_000)).toBe(0);
    expect(live.timerRemainingSec).toBe(30);
  });
  it("preserves paused remaining time regardless of an old deadline", () => {
    expect(remainingTriviaSeconds({ ...live, timerRunning: false, timerRemainingSec: 12 }, started + 90_000)).toBe(12);
  });
  it("supports old saved running timers without a deadline", () => {
    expect(remainingTriviaSeconds({ ...live, timerEndsAt: null }, started + 5_000)).toBe(25);
  });
  it("handles untimed, invalid, and elapsed values without negative or NaN output", () => {
    expect(remainingTriviaSeconds({ ...live, timerRemainingSec: 0, timerEndsAt: null }, started)).toBe(0);
    expect(remainingTriviaSeconds({ ...live, timerRemainingSec: Number.NaN, timerEndsAt: null, updatedAt: "invalid" }, started)).toBe(0);
  });
});
