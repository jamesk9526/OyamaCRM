"use client";

import { useEffect, useState } from "react";
import type { TriviaLiveState } from "../lib/trivia-types";
import { remainingTriviaSeconds } from "../lib/trivia-timer";

/** A display clock only: background throttling and closed hosts do not stop time. */
export function useTriviaCountdown(live: TriviaLiveState, clockOffsetMs = 0): number {
  const [, setRemaining] = useState(() => remainingTriviaSeconds(live, Date.now() + clockOffsetMs));
  useEffect(() => {
    const update = () => setRemaining(remainingTriviaSeconds(live, Date.now() + clockOffsetMs));
    update();
    if (!live.timerRunning) return;
    const interval = window.setInterval(update, 250);
    const resume = () => { if (document.visibilityState === "visible") update(); };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [live, clockOffsetMs]);
  // Use current props immediately on a new stage instead of waiting for an effect.
  return remainingTriviaSeconds(live, Date.now() + clockOffsetMs);
}
