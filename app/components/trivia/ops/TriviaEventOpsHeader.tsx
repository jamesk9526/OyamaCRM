// Shared mission-control header for Trivia Night-of Operations pages.

import type { TriviaEvent, TriviaLiveState, TriviaScoreAction } from "@/app/apps/trivia/lib/trivia-types";
import { getActiveQuestion, getActiveRound, getCheckInSummary } from "@/app/apps/trivia/lib/trivia-selectors";

interface TriviaEventOpsHeaderProps {
  event: TriviaEvent;
  live: TriviaLiveState;
  scoreHistory: TriviaScoreAction[];
}

function statusTone(status: TriviaEvent["status"]): string {
  if (status === "live") return "border-emerald-400/40 bg-emerald-500/20 text-emerald-200";
  if (status === "paused") return "border-amber-400/40 bg-amber-500/20 text-amber-200";
  if (status === "completed") return "border-cyan-400/40 bg-cyan-500/20 text-cyan-200";
  if (status === "check_in_open") return "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200";
  if (status === "archived") return "border-slate-500/60 bg-slate-700/50 text-slate-200";
  return "border-slate-500/60 bg-slate-700/50 text-slate-200";
}

/** Renders the always-visible event status block for high-pressure event-night navigation. */
export default function TriviaEventOpsHeader({ event, live, scoreHistory }: TriviaEventOpsHeaderProps) {
  const round = getActiveRound(event, live);
  const question = getActiveQuestion(event, live);
  const checkIn = getCheckInSummary(event.teams);
  const lastAction = scoreHistory[scoreHistory.length - 1] ?? null;

  return (
    <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Night-of Operations Center</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{event.name}</h1>
          <p className="mt-1 text-sm text-slate-300">{event.venue || "Venue not set"} • Host {event.hostName || "Not set"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${statusTone(event.status)}`}>
          {event.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Current Position</p>
          <p className="text-xs text-slate-100 mt-1">{round?.title ?? "No round"}</p>
          <p className="text-xs text-slate-300">Q{question ? live.activeQuestionIndex + 1 : "-"} • Stage {live.stage}</p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Check-In</p>
          <p className="text-xs text-slate-100 mt-1">Expected {checkIn.expected} • Checked in {checkIn.checkedIn}</p>
          <p className="text-xs text-slate-300">Late {checkIn.late} • Inactive {checkIn.inactive + checkIn.dropped}</p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Live Connections</p>
          <p className="text-xs text-slate-100 mt-1">Projector: {live.projectorConnectionStatus ?? (live.displayOpenedAt ? "connected" : "offline")}</p>
          <p className="text-xs text-slate-300">Scorekeeper: {live.scorekeeperConnectionStatus ?? "offline"}</p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Last Score Action</p>
          <p className="text-xs text-slate-100 mt-1 truncate">{live.lastScoreActionSummary ?? (lastAction ? `${lastAction.actionType} ${lastAction.delta}` : "No scoring yet")}</p>
          <p className="text-xs text-slate-300">{live.lastScoreActionAt ? new Date(live.lastScoreActionAt).toLocaleTimeString() : "--"}</p>
        </div>
      </div>
    </header>
  );
}
