// ProjectorDisplayView renders audience-safe content for the trivia display window.

import type { TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound, getSortedTeams, getWinnerTeam } from "@/app/apps/trivia/lib/trivia-selectors";

interface ProjectorDisplayViewProps {
  /** Event data used for display-safe rendering. */
  event: TriviaEvent;
  /** Live runtime state controlled by host actions. */
  live: TriviaLiveState;
}

/**
 * ProjectorDisplayView intentionally excludes host-only data such as notes and scoring controls.
 * It is optimized for high-contrast, large-screen readability.
 */
export default function ProjectorDisplayView({ event, live }: ProjectorDisplayViewProps) {
  const round = getActiveRound(event, live);
  const question = getActiveQuestion(event, live);
  const teams = getSortedTeams(event.teams);
  const winner = getWinnerTeam(event, live);
  const showTimer = event.displaySettings.showTimerOnQuestion;
  const showTeamColors = event.displaySettings.showTeamColors;

  if (live.stage === "blank") {
    return <section className="min-h-screen bg-black" />;
  }

  if (live.stage === "welcome") {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Welcome</p>
        <h1 className="text-6xl font-bold mt-4">{event.name}</h1>
        <p className="text-2xl mt-4 text-slate-300">Hosted by {event.hostName || "Trivia Host"}</p>
        <p className="text-lg mt-2 text-slate-400">Venue: {event.venue || "Main Room"}</p>
      </section>
    );
  }

  if (live.stage === "round_intro") {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-sky-950 via-slate-950 to-black text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Round Intro</p>
        <h1 className="text-6xl font-bold mt-4">{round?.title || "Next Round"}</h1>
        <p className="text-2xl mt-4 text-slate-200">{round?.description || "Get ready for the next set of questions."}</p>
        <p className="text-lg mt-2 text-slate-400">Round type: {round?.roundType || "normal"}</p>
      </section>
    );
  }

  if (live.stage === "timer_only") {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-slate-950 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Timer</p>
        <h1 className="text-8xl font-bold mt-4 text-cyan-100">{live.timerRemainingSec}s</h1>
        <p className="text-xl mt-4 text-slate-300">Time remaining</p>
      </section>
    );
  }

  if (live.stage === "break") {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-black text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Intermission</p>
        <h1 className="text-6xl font-bold mt-4">Short Break</h1>
        <p className="text-2xl mt-4 text-slate-300">Get ready for the next round.</p>
      </section>
    );
  }

  if (live.stage === "winner") {
    return (
      <section className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-fuchsia-900 via-indigo-900 to-black text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-fuchsia-200">Final Results</p>
        <h1 className="text-6xl font-bold mt-4">{winner ? winner.name : "No Winner Yet"}</h1>
        <p className="text-2xl mt-4 text-fuchsia-100">Champion of {event.name}</p>
      </section>
    );
  }

  if (live.stage === "leaderboard") {
    return (
      <section className="min-h-screen p-10 bg-slate-950 text-white">
        <header className="text-center mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Live Rankings</p>
          <h1 className="text-5xl font-bold mt-3">Leaderboard</h1>
        </header>
        <div className="max-w-5xl mx-auto space-y-3">
          {teams.map((team, index) => (
            <div
              key={team.id}
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-4 flex items-center justify-between"
              style={showTeamColors ? { borderColor: `${team.color}88`, backgroundColor: `${team.color}22` } : undefined}
            >
              <p className="text-2xl font-semibold">#{index + 1} {team.name}</p>
              <p className="text-3xl font-bold text-cyan-200">{team.score}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (live.stage === "answer") {
    return (
      <section className="min-h-screen flex flex-col justify-center p-10 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto w-full">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Answer Reveal</p>
          <h1 className="text-5xl font-bold mt-3">{question?.prompt || "No active question"}</h1>
          <div className="mt-8 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-6">
            <p className="text-lg text-emerald-200">Answer</p>
            <p className="text-4xl font-bold text-emerald-100 mt-2">{question?.audienceAnswer || "Not available"}</p>
            {question?.revealText ? <p className="text-xl text-emerald-50 mt-3">{question.revealText}</p> : null}
            {question?.explanation ? <p className="text-lg text-emerald-100/90 mt-3">{question.explanation}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  const isFinalStyle = live.stage === "final_question";
  const isTieBreakerStyle = live.stage === "tiebreaker";

  return (
    <section className="min-h-screen flex flex-col justify-center p-10 bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">{event.name}</p>
            <h1 className="text-4xl font-semibold mt-2">
              {isFinalStyle ? "Final Question" : isTieBreakerStyle ? "Tiebreaker" : round?.title || "Awaiting round"}
            </h1>
          </div>
          {showTimer ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-5 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">Timer</p>
              <p className="text-4xl font-bold text-emerald-100">{live.timerRemainingSec}s</p>
            </div>
          ) : null}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-700 bg-slate-900/70 p-8">
          <p className="text-sm text-slate-400">Question {live.activeQuestionIndex + 1} • {question?.questionType || "text"}</p>
          <p className="text-5xl font-semibold mt-3 leading-tight">{question?.prompt || "No active question selected."}</p>
          {question?.mediaUrl ? (
            <p className="text-base text-emerald-200 mt-4">Media: {question.mediaUrl}</p>
          ) : null}
          {question?.options?.length ? (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.options.map((option) => (
                <div key={option} className="rounded-xl border border-slate-600 bg-slate-800/70 px-4 py-3 text-xl">
                  {option}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
