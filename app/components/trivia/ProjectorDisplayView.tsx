// Audience-safe animated display package for live Trivia events.

import type { ReactNode } from "react";
import type { TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound, getSortedTeams, getWinnerTeam } from "@/app/apps/trivia/lib/trivia-selectors";

interface ProjectorDisplayViewProps {
  event: TriviaEvent;
  live: TriviaLiveState;
}

function ProjectorFrame({ event, live, eyebrow, children, tone = "cyan" }: { event: TriviaEvent; live: TriviaLiveState; eyebrow: string; children: ReactNode; tone?: "cyan" | "violet" | "amber" | "rose" }) {
  return (
    <main className={`trivia-projector trivia-projector-${tone} ${event.displaySettings.highContrast ? "is-high-contrast" : ""}`}>
      <div className="trivia-projector-grid" aria-hidden="true" />
      <div className="trivia-projector-orb trivia-projector-orb-one" aria-hidden="true" />
      <div className="trivia-projector-orb trivia-projector-orb-two" aria-hidden="true" />
      <header className="trivia-projector-brand"><div className="trivia-projector-mark">T</div><div><strong>{event.name}</strong><span>{event.venue || "Live trivia event"}</span></div><p>{eyebrow}</p></header>
      <section key={`${live.stage}-${live.activeRoundId}-${live.activeQuestionIndex}`} className="trivia-projector-stage">{children}</section>
      <footer className="trivia-projector-footer"><span>OYAMA TRIVIA</span><i /><span>{live.projectorConnectionStatus === "connected" ? "LIVE DISPLAY" : "EVENT DISPLAY"}</span></footer>
    </main>
  );
}

function Timer({ live, compact = false }: { live: TriviaLiveState; compact?: boolean }) {
  const urgent = live.timerRemainingSec <= 10;
  return <div className={`trivia-projector-timer ${compact ? "is-compact" : ""} ${urgent ? "is-urgent" : ""} ${live.timerRunning ? "is-running" : ""}`}><span>Time</span><strong>{live.timerRemainingSec}</strong><small>seconds</small></div>;
}

/** Excludes scoring answers and host notes while rendering every public stage. */
export default function ProjectorDisplayView({ event, live }: ProjectorDisplayViewProps) {
  const round = getActiveRound(event, live);
  const question = getActiveQuestion(event, live);
  const teams = getSortedTeams(event.teams);
  const winner = getWinnerTeam(event, live);

  if (live.stage === "blank") return <main className="min-h-screen bg-black" aria-label="Projector intentionally blank" />;

  if (live.stage === "welcome") {
    const welcome = event.welcomeScreen ?? { eyebrow: "Tonight's event", headline: event.name, subtitle: "Get ready for a great night of trivia.", showHost: true, showVenue: true };
    const details = [welcome.showHost && event.hostName ? `Hosted by ${event.hostName}` : "", welcome.showVenue && event.venue ? event.venue : ""].filter(Boolean).join(" · ");
    return <ProjectorFrame event={event} live={live} eyebrow="Welcome"><div className="trivia-projector-hero"><p>{welcome.eyebrow || "Tonight's event"}</p><h1>{welcome.headline || event.name}</h1><div className="trivia-projector-rule" /><h2>{welcome.subtitle || "Get ready for a great night of trivia."}</h2>{details ? <span>{details}</span> : null}</div></ProjectorFrame>;
  }

  if (live.stage === "check_in_open" || live.stage === "check_in_closed") {
    const checkedIn = event.teams.filter((team) => team.checkInStatus === "checked_in" || team.checkInStatus === "late").length;
    return <ProjectorFrame event={event} live={live} eyebrow="Arrival" tone="violet"><div className="trivia-projector-hero"><p>{live.stage === "check_in_open" ? "Check-in is open" : "Check-in complete"}</p><h1>{live.stage === "check_in_open" ? "Welcome, teams" : "Take your seats"}</h1><h2>{live.stage === "check_in_open" ? "Please visit the welcome table before finding your seat." : "The first round begins shortly."}</h2><div className="trivia-projector-count"><strong>{checkedIn}</strong><span>of {event.teams.length} teams checked in</span></div></div></ProjectorFrame>;
  }

  if (live.stage === "round_intro") {
    const roundNumber = Math.max(1, event.rounds.findIndex((item) => item.id === round?.id) + 1);
    return <ProjectorFrame event={event} live={live} eyebrow={`Round ${roundNumber}`}><div className="trivia-projector-hero"><p>Up next</p><span className="trivia-projector-round-number">{String(roundNumber).padStart(2, "0")}</span><h1>{round?.title || "Next round"}</h1><h2>{round?.description || "Get ready for the next set of questions."}</h2><span>{round?.questions.length ?? 0} questions · {(round?.roundType || "normal").replaceAll("_", " ")}</span></div></ProjectorFrame>;
  }

  if (live.stage === "timer_only") {
    return <ProjectorFrame event={event} live={live} eyebrow="Countdown"><div className="trivia-projector-timer-stage"><p>Answers in</p><Timer live={live} /></div></ProjectorFrame>;
  }

  if (live.stage === "break") {
    return <ProjectorFrame event={event} live={live} eyebrow="Intermission" tone="violet"><div className="trivia-projector-hero"><p>Take a moment</p><h1>Short break</h1><div className="trivia-projector-rule" /><h2>Refresh your drinks, check your scores, and get ready for the next round.</h2></div></ProjectorFrame>;
  }

  if (live.stage === "winner") {
    return <ProjectorFrame event={event} live={live} eyebrow="Final results" tone="rose"><div className="trivia-projector-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--confetti-index": index } as React.CSSProperties} />)}</div><div className="trivia-projector-winner"><p>Tonight&apos;s champions</p><div className="trivia-projector-crown">♛</div><h1>{winner?.name || "Winner pending"}</h1><h2>{winner ? `${winner.score} points` : "Select the winning team from the host panel"}</h2><span>{event.name}</span></div></ProjectorFrame>;
  }

  if (live.stage === "leaderboard") {
    return <ProjectorFrame event={event} live={live} eyebrow="Live standings"><div className="trivia-projector-board"><div className="trivia-projector-title"><p>Current rankings</p><h1>Leaderboard</h1></div><div className="trivia-projector-rankings">{teams.length ? teams.slice(0, 10).map((team, index) => <div key={team.id} className={`trivia-projector-ranking ${index < 3 ? "is-podium" : ""}`} style={{ "--rank-delay": `${index * 70}ms`, ...(event.displaySettings.showTeamColors ? { borderColor: team.color } : {}) } as React.CSSProperties}><span>{index + 1}</span><strong>{team.name}</strong><em>{team.score}<small> pts</small></em></div>) : <div className="trivia-projector-empty">Teams will appear here after check-in.</div>}</div></div></ProjectorFrame>;
  }

  if (live.stage === "answer" || live.stage === "explanation") {
    return <ProjectorFrame event={event} live={live} eyebrow="Answer reveal" tone="violet"><div className="trivia-projector-answer"><p>{round?.title || "Current round"} · Question {live.activeQuestionIndex + 1}</p><h1>{question?.prompt || "No active question"}</h1><div className="trivia-projector-answer-card"><span>Correct answer</span><strong>{question?.audienceAnswer || question?.scoringAnswer || "Answer not available"}</strong>{question?.revealText ? <p>{question.revealText}</p> : null}{question?.explanation ? <small>{question.explanation}</small> : null}</div></div></ProjectorFrame>;
  }

  const finalQuestion = live.stage === "final_question";
  const tieBreaker = live.stage === "tiebreaker";
  const questionLabel = finalQuestion ? "Final question" : tieBreaker ? "Tie breaker" : `Question ${live.activeQuestionIndex + 1}`;

  return <ProjectorFrame event={event} live={live} eyebrow={questionLabel} tone={finalQuestion || tieBreaker ? "amber" : "cyan"}><div className="trivia-projector-question"><header><div><p>{round?.title || "Awaiting round"}</p><h1>{questionLabel}</h1></div>{event.displaySettings.showTimerOnQuestion ? <Timer live={live} compact /> : null}</header><article className={question?.mediaUrl ? "has-media" : ""}><div><span>{question?.questionType?.replaceAll("_", " ") || "text"}</span><h2>{question?.prompt || "No active question selected."}</h2>{question?.options?.length ? <div className="trivia-projector-options">{question.options.map((option, index) => <div key={`${index}-${option}`}><b>{String.fromCharCode(65 + index)}</b><p>{option}</p></div>)}</div> : null}</div>{question?.mediaUrl ? <div className="trivia-projector-media">{question.questionType === "image" ? <img src={question.mediaUrl} alt="Question visual clue" /> : null}{question.questionType === "audio" ? <div className="trivia-projector-audio"><span>♫</span><p>Listen to the audio clue</p><audio controls autoPlay src={question.mediaUrl} /></div> : null}{question.questionType === "video" ? <video controls autoPlay src={question.mediaUrl} /> : null}</div> : null}</article></div></ProjectorFrame>;
}
