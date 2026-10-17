import type { TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound, getWinnerTeam } from "@/app/apps/trivia/lib/trivia-selectors";

/** Text preview follows the selected projector stage; private notes never appear here. */
export default function TriviaHostAudiencePreview({ event, live }: { event: TriviaEvent; live: TriviaLiveState }) {
  const round = getActiveRound(event, live);
  const question = getActiveQuestion(event, live);
  const questionVisible = ["question", "final_question", "tiebreaker", "answer", "explanation"].includes(live.stage)
    || live.stage === "timer_only";
  const answerVisible = live.stage === "answer" || live.stage === "explanation";
  const roundNumber = Math.max(1, event.rounds.findIndex((item) => item.id === round?.id) + 1);
  const winner = getWinnerTeam(event, live);
  const welcome = event.welcomeScreen;

  return (
    <section aria-label="Audience preview" className="space-y-2 border-l-4 border-cyan-400 bg-slate-950 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200">What the audience sees</h3>
      {questionVisible ? (
        <>
          <p className="text-sm font-semibold text-slate-300">Round {roundNumber} of {event.rounds.length} · {round?.title || "Awaiting round"} · Question {question ? live.activeQuestionIndex + 1 : 0} of {round?.questions.length ?? 0}</p>
          <p className="whitespace-pre-wrap break-words text-xl font-semibold text-white">{question?.prompt || "No active question selected."}</p>
          {!answerVisible && question?.options?.length ? (
            <ol className="list-inside list-[upper-alpha] space-y-1 text-sm text-slate-200">
              {question.options.map((option, index) => <li key={`${index}-${option}`}>{option}</li>)}
            </ol>
          ) : null}
          {!answerVisible && question?.mediaUrl ? <p className="text-xs text-slate-300">{question.questionType.replaceAll("_", " ")} clue on the projector</p> : null}
          {answerVisible ? (
            <div className="border border-slate-600 p-3 text-sm text-slate-200">
              <p className="font-semibold">Correct answer: {question?.audienceAnswer || question?.scoringAnswer || "Answer not available"}</p>
              {question?.revealText ? <p className="mt-1 whitespace-pre-wrap">{question.revealText}</p> : null}
              {question?.explanation ? <p className="mt-1 whitespace-pre-wrap">{question.explanation}</p> : null}
            </div>
          ) : null}
        </>
      ) : live.stage === "round_intro" ? (
        <>
          <p className="text-sm text-slate-300">Round {roundNumber} of {event.rounds.length} · Round intro</p>
          <p className="text-xl font-semibold text-white">{round?.title || "Next round"}</p>
          <p className="text-sm text-slate-200">{round?.description || "Get ready for the next set of questions."}</p>
          <p className="text-xs text-slate-300">{round?.questions.length ?? 0} questions · No question is displayed yet.</p>
        </>
      ) : live.stage === "welcome" ? (
        <>
          <p className="text-sm text-slate-300">Welcome screen</p>
          <p className="text-xl font-semibold text-white">{welcome?.headline || event.name}</p>
          <p className="text-sm text-slate-200">{welcome?.subtitle || "Get ready for a great night of trivia."}</p>
        </>
      ) : live.stage === "timer_only" ? (
        <p className="text-base font-semibold text-white">Timer only · No question text is displayed.</p>
      ) : live.stage === "blank" ? (
        <p className="text-base font-semibold text-white">Blank screen · No game content is displayed.</p>
      ) : live.stage === "break" ? (
        <p className="text-base font-semibold text-white">Short break · No question is displayed.</p>
      ) : live.stage === "leaderboard" ? (
        <p className="text-base font-semibold text-white">Leaderboard · Current team scores and rankings.</p>
      ) : live.stage === "winner" ? (
        <p className="text-base font-semibold text-white">Winner: {winner ? `${winner.name} · ${winner.score} points` : "Winner pending"}</p>
      ) : (
        <p className="text-base font-semibold text-white">{live.stage === "check_in_open" ? "Check-in is open · Welcome, teams" : "Check-in complete · Take your seats"}</p>
      )}
      <p className="pt-1 text-xs text-slate-400">Preview follows the game state. Check the projector to confirm it is connected.</p>
    </section>
  );
}
