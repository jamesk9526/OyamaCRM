type JsonObject = Record<string, unknown>;

const STAGES = new Set(["welcome", "check_in_open", "check_in_closed", "round_intro", "question", "timer_only", "answer", "explanation", "leaderboard", "break", "final_question", "tiebreaker", "winner", "blank"]);
const TIMED_STAGES = new Set(["question", "timer_only", "final_question", "tiebreaker"]);
const QUESTION_STAGES = new Set([...TIMED_STAGES, "answer", "explanation"]);
const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter((item): item is JsonObject => typeof item === "object" && item !== null && !Array.isArray(item)) : [];

export function resolveTriviaTimer(live: JsonObject, now: string): JsonObject {
  const deadline = typeof live.timerEndsAt === "string" ? Date.parse(live.timerEndsAt) : NaN;
  if (!live.timerRunning || !Number.isFinite(deadline)) return { ...live };
  const remaining = Math.max(0, Math.ceil((deadline - Date.parse(now)) / 1000));
  return { ...live, timerRemainingSec: remaining, timerRunning: remaining > 0, timerEndsAt: remaining > 0 ? live.timerEndsAt : null };
}

function questionSeconds(question: JsonObject | undefined): number {
  const configuredSeconds = Number(question?.timeLimitSec ?? 30);
  return Number.isFinite(configuredSeconds) && configuredSeconds >= 0 ? configuredSeconds : 30;
}

/** Apply one authorized host command without mutating the persisted event/live state. */
export function applyRemoteTriviaHostAction(event: JsonObject, live: JsonObject, action: string, payload: JsonObject, now: string): { ok: true; live: JsonObject } | { ok: false; message: string } {
  const rounds = objects(event.rounds);
  const next: JsonObject = resolveTriviaTimer(live, now);
  const currentRound = () => rounds.find(round => round.id === next.activeRoundId);
  const currentQuestion = () => objects(currentRound()?.questions)[Number(next.activeQuestionIndex ?? 0)];
  const resetTimer = () => {
    const seconds = questionSeconds(currentQuestion());
    next.timerDefaultSec = seconds;
    next.timerRemainingSec = seconds;
    next.timerRunning = false;
    next.timerEndsAt = null;
  };

  if (action === "set_stage") {
    if (typeof payload.stage !== "string" || !STAGES.has(payload.stage)) return { ok: false, message: "Choose a valid projector stage." };
    if (QUESTION_STAGES.has(payload.stage) && !currentQuestion()) return { ok: false, message: "Choose a question before changing the projector stage." };
    next.stage = payload.stage;
    if (payload.stage === "check_in_open") next.checkInOpenedAt = next.checkInOpenedAt ?? now;
    if (payload.stage === "check_in_closed") next.checkInClosedAt = next.checkInClosedAt ?? now;
  } else if (action === "set_round") {
    if (typeof payload.roundId !== "string" || !rounds.some(round => round.id === payload.roundId)) return { ok: false, message: "Choose a valid round." };
    next.activeRoundId = payload.roundId;
    next.activeQuestionIndex = 0;
    next.stage = "round_intro";
    next.winnerTeamId = null;
    resetTimer();
  } else if (action === "set_question" || action === "next_question" || action === "previous_question") {
    const round = currentRound();
    const questions = objects(round?.questions);
    if (!questions.length) return { ok: false, message: "The active round has no questions." };
    const currentIndex = Number(next.activeQuestionIndex ?? 0);
    const index = Number.isInteger(currentIndex) ? currentIndex : 0;
    if (action === "set_question" && (!Number.isInteger(payload.questionIndex) || Number(payload.questionIndex) < 0 || Number(payload.questionIndex) >= questions.length)) return { ok: false, message: "Choose a valid question." };
    next.activeQuestionIndex = action === "set_question" ? payload.questionIndex : Math.max(0, Math.min(questions.length - 1, index + (action === "next_question" ? 1 : -1)));
    next.stage = round?.roundType === "final_wager" ? "final_question" : round?.roundType === "tiebreaker" ? "tiebreaker" : "question";
    next.winnerTeamId = null;
    resetTimer();
  } else if (action === "timer_start") {
    if (!TIMED_STAGES.has(String(next.stage)) || !currentQuestion() || !(Number(next.timerDefaultSec) > 0) || !(Number(next.timerRemainingSec) > 0)) return { ok: false, message: "Show a timed question and reset an expired timer before starting." };
    if (next.timerRunning && typeof next.timerEndsAt === "string" && Number.isFinite(Date.parse(next.timerEndsAt))) return { ok: true, live: { ...live } };
    next.timerRunning = true;
    next.timerEndsAt = new Date(Date.parse(now) + Number(next.timerRemainingSec) * 1000).toISOString();
  } else if (action === "timer_pause") {
    next.timerRunning = false;
    next.timerEndsAt = null;
  } else if (action === "timer_reset") {
    resetTimer();
    if (payload.seconds !== undefined) {
      if (!Number.isInteger(payload.seconds) || Number(payload.seconds) < 0 || Number(payload.seconds) > 86400) return { ok: false, message: "Timer must be a whole number from 0 to 86400 seconds." };
      next.timerDefaultSec = payload.seconds;
      next.timerRemainingSec = payload.seconds;
    }
  } else if (action === "set_winner") {
    if (typeof payload.teamId !== "string" || !objects(event.teams).some(team => team.id === payload.teamId)) return { ok: false, message: "Choose a valid winning team." };
    next.winnerTeamId = payload.teamId;
    next.stage = "winner";
    next.timerRunning = false;
    next.timerEndsAt = null;
    next.answerRevealed = false;
    next.leaderboardVisible = false;
  } else if (action === "projector_opened") {
    next.displayOpenedAt = now;
  } else if (action === "set_status") {
    if (!["draft", "check_in_open", "live", "paused", "completed", "archived"].includes(String(payload.status))) return { ok: false, message: "Choose a valid event status." };
    if (payload.status !== "live") { next.timerRunning = false; next.timerEndsAt = null; }
  } else {
    return { ok: false, message: "Choose a valid host action." };
  }

  if (["set_stage", "set_round", "set_question", "next_question", "previous_question"].includes(action)) {
    next.answerRevealed = next.stage === "answer" || next.stage === "explanation";
    next.leaderboardVisible = next.stage === "leaderboard";
    if (!TIMED_STAGES.has(String(next.stage))) { next.timerRunning = false; next.timerEndsAt = null; }
  }
  next.lastHostAction = `Remote ${action.replace(/_/g, " ")}`;
  next.updatedAt = now;
  return { ok: true, live: next };
}
