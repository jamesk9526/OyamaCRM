type JsonObject = Record<string, unknown>;

const STAGES = new Set(["welcome", "check_in_open", "check_in_closed", "round_intro", "question", "timer_only", "answer", "explanation", "leaderboard", "break", "final_question", "tiebreaker", "winner", "blank"]);
const TIMED_STAGES = new Set(["question", "timer_only", "final_question", "tiebreaker"]);
const QUESTION_STAGES = new Set([...TIMED_STAGES, "answer", "explanation"]);
const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter((item): item is JsonObject => typeof item === "object" && item !== null && !Array.isArray(item)) : [];

function questionSeconds(question: JsonObject | undefined): number {
  const configuredSeconds = Number(question?.timeLimitSec ?? 30);
  return Number.isFinite(configuredSeconds) && configuredSeconds >= 0 ? configuredSeconds : 30;
}

/** Apply one authorized host command without mutating the persisted event/live state. */
export function applyRemoteTriviaHostAction(event: JsonObject, live: JsonObject, action: string, payload: JsonObject, now: string): { ok: true; live: JsonObject } | { ok: false; message: string } {
  const rounds = objects(event.rounds);
  const next: JsonObject = { ...live };
  const currentRound = () => rounds.find(round => round.id === next.activeRoundId);
  const currentQuestion = () => objects(currentRound()?.questions)[Number(next.activeQuestionIndex ?? 0)];
  const resetTimer = () => {
    const seconds = questionSeconds(currentQuestion());
    next.timerDefaultSec = seconds;
    next.timerRemainingSec = seconds;
    next.timerRunning = false;
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
  } else if (action === "next_question" || action === "previous_question") {
    const round = currentRound();
    const questions = objects(round?.questions);
    if (!questions.length) return { ok: false, message: "The active round has no questions." };
    const currentIndex = Number(next.activeQuestionIndex ?? 0);
    const index = Number.isInteger(currentIndex) ? currentIndex : 0;
    next.activeQuestionIndex = Math.max(0, Math.min(questions.length - 1, index + (action === "next_question" ? 1 : -1)));
    next.stage = round?.roundType === "final_wager" ? "final_question" : round?.roundType === "tiebreaker" ? "tiebreaker" : "question";
    next.winnerTeamId = null;
    resetTimer();
  } else if (action === "timer_start") {
    if (!currentQuestion() || !(Number(next.timerDefaultSec) > 0) || !(Number(next.timerRemainingSec) > 0)) return { ok: false, message: "Select a timed question and reset an expired timer before starting." };
    next.timerRunning = true;
  } else if (action === "timer_pause") {
    next.timerRunning = false;
  } else if (action === "timer_reset") {
    resetTimer();
  } else {
    return { ok: false, message: "Choose a valid host action." };
  }

  if (["set_stage", "set_round", "next_question", "previous_question"].includes(action)) {
    next.answerRevealed = next.stage === "answer" || next.stage === "explanation";
    next.leaderboardVisible = next.stage === "leaderboard";
    if (!TIMED_STAGES.has(String(next.stage))) next.timerRunning = false;
  }
  next.lastHostAction = `Remote ${action.replace(/_/g, " ")}`;
  next.updatedAt = now;
  return { ok: true, live: next };
}
