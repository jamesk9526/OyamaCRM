import { describe, expect, it } from "vitest";
import { applyRemoteTriviaHostAction } from "@/server/src/services/trivia-host-control";

const event = { rounds: [
  { id: "normal", roundType: "normal", questions: [{ timeLimitSec: 15 }, { timeLimitSec: 0 }] },
  { id: "final", roundType: "final_wager", questions: [{ timeLimitSec: 45 }] },
  { id: "empty", roundType: "normal", questions: [] },
] };
const live = { activeRoundId: "normal", activeQuestionIndex: 0, stage: "question", timerDefaultSec: 15, timerRemainingSec: 10, timerRunning: true, winnerTeamId: "old-winner", answerRevealed: false, leaderboardVisible: false };
const run = (action: string, payload = {}, state: Record<string, unknown> = live) => applyRemoteTriviaHostAction(event, state, action, payload, "2026-10-16T18:00:00.000Z");

describe("temporary Trivia host commands", () => {
  it("pauses on an answer reveal and keeps answer/leaderboard flags consistent", () => {
    const answer = run("set_stage", { stage: "answer" });
    expect(answer).toMatchObject({ ok: true, live: { stage: "answer", answerRevealed: true, leaderboardVisible: false, timerRunning: false } });
    const board = run("set_stage", { stage: "leaderboard" });
    expect(board).toMatchObject({ ok: true, live: { answerRevealed: false, leaderboardVisible: true, timerRunning: false } });
    const blank = run("set_stage", { stage: "blank" });
    expect(blank).toMatchObject({ ok: true, live: { answerRevealed: false, leaderboardVisible: false, timerRunning: false } });
    expect(live.timerRunning).toBe(true);
  });
  it("keeps legacy timed questions and round changes untimed", () => {
    expect(run("set_round", { roundId: "final" })).toMatchObject({ ok: true, live: { activeRoundId: "final", timerDefaultSec: 0, timerRemainingSec: 0, timerRunning: false, timerEndsAt: null } });
    expect(run("next_question")).toMatchObject({ ok: true, live: { timerDefaultSec: 0, timerRemainingSec: 0, timerRunning: false } });
    expect(run("timer_start").ok).toBe(false);
    expect(run("timer_reset", { seconds: 30 }).ok).toBe(false);
  });
  it("validates round, projector stage, action, and missing question", () => {
    expect(run("set_round", { roundId: "missing" }).ok).toBe(false);
    expect(run("set_stage", { stage: "invalid" }).ok).toBe(false);
    expect(run("invalid").ok).toBe(false);
    expect(run("set_stage", { stage: "answer" }, { ...live, activeRoundId: "empty" }).ok).toBe(false);
  });
  it("records the check-in stage timestamp", () => {
    expect(run("set_stage", { stage: "check_in_open" })).toMatchObject({ ok: true, live: { checkInOpenedAt: "2026-10-16T18:00:00.000Z", timerRunning: false } });
  });
  it("clears old running deadlines and maps the retired timer screen to the question", () => {
    expect(run("timer_pause", {}, { ...live, timerEndsAt: "2026-10-16T18:00:06.400Z" })).toMatchObject({ ok: true, live: { timerRemainingSec: 0, timerDefaultSec: 0, timerRunning: false, timerEndsAt: null } });
    expect(run("set_stage", { stage: "timer_only" })).toMatchObject({ ok: true, live: { stage: "question", timerRunning: false } });
  });
  it("validates direct question selection and resets its timer", () => {
    expect(run("set_question", { questionIndex: 1 })).toMatchObject({ ok: true, live: { activeQuestionIndex: 1, timerRemainingSec: 0, timerRunning: false, timerEndsAt: null } });
    expect(run("set_question", { questionIndex: 0.5 }).ok).toBe(false);
  });
});
