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
  it("loads a new round's first-question timer and clears a previous winner", () => {
    expect(run("set_round", { roundId: "final" })).toMatchObject({ ok: true, live: { activeRoundId: "final", activeQuestionIndex: 0, stage: "round_intro", timerDefaultSec: 45, timerRemainingSec: 45, timerRunning: false, winnerTeamId: null } });
  });
  it("resets an untimed next question and refuses to start its timer", () => {
    const next = run("next_question");
    expect(next).toMatchObject({ ok: true, live: { timerDefaultSec: 0, timerRemainingSec: 0, timerRunning: false, winnerTeamId: null } });
    if (next.ok) expect(applyRemoteTriviaHostAction(event, next.live, "timer_start", {}, "now").ok).toBe(false);
    expect(run("timer_start", {}, { ...live, timerRemainingSec: 0 }).ok).toBe(false);
  });
  it("removes the active question timer and restores the configured timer on question change", () => {
    const untimed = run("timer_reset", { seconds: 0 }, { ...live, timerEndsAt: "2026-10-16T18:00:10.000Z" });
    expect(untimed).toMatchObject({ ok: true, live: { timerDefaultSec: 0, timerRemainingSec: 0, timerRunning: false, timerEndsAt: null } });
    if (untimed.ok) {
      expect(run("set_question", { questionIndex: 1 }, untimed.live)).toMatchObject({ ok: true, live: { timerDefaultSec: 0, timerRemainingSec: 0 } });
      expect(run("set_question", { questionIndex: 0 }, untimed.live)).toMatchObject({ ok: true, live: { timerDefaultSec: 15, timerRemainingSec: 15 } });
    }
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
  it("freezes the actual deadline remainder on pause and resumes from that remainder", () => {
    const paused = run("timer_pause", {}, { ...live, timerEndsAt: "2026-10-16T18:00:06.400Z" });
    expect(paused).toMatchObject({ ok: true, live: { timerRemainingSec: 7, timerRunning: false, timerEndsAt: null } });
    if (paused.ok) expect(run("timer_start", {}, paused.live as typeof live)).toMatchObject({ ok: true, live: { timerEndsAt: "2026-10-16T18:00:07.000Z", timerRunning: true } });
  });
  it("refuses expired deadlines and starting a timer on an answer screen", () => {
    expect(run("timer_start", {}, { ...live, timerEndsAt: "2026-10-16T17:59:59Z" }).ok).toBe(false);
    expect(run("timer_start", {}, { ...live, stage: "answer" }).ok).toBe(false);
  });
  it("validates direct question selection and resets its timer", () => {
    expect(run("set_question", { questionIndex: 1 })).toMatchObject({ ok: true, live: { activeQuestionIndex: 1, timerRemainingSec: 0, timerRunning: false, timerEndsAt: null } });
    expect(run("set_question", { questionIndex: 0.5 }).ok).toBe(false);
  });
});
