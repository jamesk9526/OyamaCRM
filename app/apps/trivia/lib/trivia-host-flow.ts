import type { TriviaEvent, TriviaLiveState } from "./trivia-types";
import { getActiveQuestion, getActiveRound } from "./trivia-selectors";

type HostAction = "show_question" | "reveal" | "next_question" | "next_round" | "leaderboard";

/** The recommended next action follows the audience display, independently of event status. */
export function getTriviaHostFlow(event: TriviaEvent, live: TriviaLiveState, _remaining?: number): {
  state: string;
  action: HostAction | null;
  label: string;
  hint: string;
  nextRoundId?: string;
} {
  void _remaining; // Legacy callers may still pass a clock value.
  const round = getActiveRound(event, live);
  const question = getActiveQuestion(event, live);
  if (live.stage === "winner") return { state: "Winner selected", action: null, label: "Winner screen selected", hint: "Use More display controls to change the audience screen." };
  if (!question || !round) return { state: "No question ready", action: null, label: "Add questions to begin", hint: "Select a round with questions, or open the game builder." };
  if (live.stage === "leaderboard" && round.id === event.rounds.at(-1)?.id && live.activeQuestionIndex === round.questions.length - 1) return { state: "Final score review", action: null, label: "Review final scores", hint: "Announce the winner from More display controls after checking scores and resolving ties." };
  if (live.stage === "answer" || live.stage === "explanation") {
    if (live.activeQuestionIndex < round.questions.length - 1) return { state: "Answer revealed", action: "next_question", label: "Next question", hint: "Show the next question." };
    const nextRound = event.rounds[event.rounds.findIndex((item) => item.id === round.id) + 1];
    return nextRound
      ? { state: "Round complete", action: "next_round", label: "Show next round intro", hint: `Up next: ${nextRound.title}.`, nextRoundId: nextRound.id }
      : { state: "Round complete", action: "leaderboard", label: "Show leaderboard", hint: "Review scores before announcing the winner in More display controls." };
  }
  if (!["question", "timer_only", "final_question", "tiebreaker"].includes(live.stage)) return { state: "Ready", action: "show_question", label: "Show question", hint: "Show the selected question, then reveal when the room is ready." };
  return { state: "Question ready", action: "reveal", label: "Reveal answer", hint: "Reveal when the room is ready. A second tap confirms the reveal." };
}
