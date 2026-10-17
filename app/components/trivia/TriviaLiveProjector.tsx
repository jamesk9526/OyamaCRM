"use client";

import { useTriviaLiveEvent } from "@/app/apps/trivia/hooks/useTriviaLiveEvent";
import type { TriviaDisplayStage } from "@/app/apps/trivia/lib/trivia-types";
import ProjectorDisplayView from "@/app/components/trivia/ProjectorDisplayView";

/** A projector subscribes to one event and never downloads the full Trivia module. */
export default function TriviaLiveProjector({ eventId, stage }: { eventId: string; stage?: TriviaDisplayStage }) {
  const live = useTriviaLiveEvent(eventId);
  const snapshot = live.snapshot;

  if (!snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Trivia projector</p>
        <h1 className="text-3xl font-semibold">{live.connectionStatus === "offline" ? "Display connection unavailable" : "Connecting to the live game…"}</h1>
        {live.error ? <p role="alert" className="max-w-xl text-sm text-amber-200">{live.error}</p> : <p className="text-sm text-slate-300">This screen will show the event as soon as it connects.</p>}
        <button type="button" onClick={() => void live.refresh()} className="min-h-11 border border-slate-500 px-4 text-sm font-semibold hover:bg-slate-800">Retry connection</button>
      </main>
    );
  }

  return (
    <>
      {live.connectionStatus === "offline" && (stage ?? snapshot.live.stage) !== "blank" ? <p role="status" className="fixed left-1/2 top-3 z-50 -translate-x-1/2 border border-amber-300/50 bg-slate-950/95 px-4 py-2 text-sm text-amber-100">Reconnecting · showing the last received screen</p> : null}
      <ProjectorDisplayView event={snapshot.event} live={stage ? { ...snapshot.live, stage } : snapshot.live} clockOffsetMs={live.clockOffsetMs} />
    </>
  );
}
