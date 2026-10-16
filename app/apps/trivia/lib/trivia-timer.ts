import type { TriviaLiveState } from "./trivia-types";

/** Countdown is derived from a deadline; rendering never writes game state. */
export function remainingTriviaSeconds(live: Pick<TriviaLiveState, "timerRunning" | "timerRemainingSec" | "updatedAt" | "timerEndsAt">, now = Date.now()): number {
  const remaining = Number.isFinite(live.timerRemainingSec) ? Math.max(0, live.timerRemainingSec) : 0;
  if (!live.timerRunning) return Math.ceil(remaining);
  const deadline = live.timerEndsAt ? Date.parse(live.timerEndsAt) : Number.NaN;
  if (Number.isFinite(deadline)) return Math.max(0, Math.ceil((deadline - now) / 1000));
  // Running timers saved before deadline support use their last recorded tick.
  const recordedAt = Date.parse(live.updatedAt);
  return Number.isFinite(recordedAt)
    ? Math.max(0, Math.ceil(remaining - Math.max(0, now - recordedAt) / 1000))
    : Math.ceil(remaining);
}
