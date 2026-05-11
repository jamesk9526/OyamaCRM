// Projector display route for audience-safe trivia rendering.
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import ProjectorDisplayView from "@/app/components/trivia/ProjectorDisplayView";

/**
 * TriviaProjectorDisplayPage renders only audience-safe state from host controls.
 * It excludes private answer-key notes and all admin controls.
 */
export default function TriviaProjectorDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state } = useTriviaModuleState();

  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]);
  const live = event ? state.liveByEventId[event.id] : null;

  if (!event || !live) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-black text-white p-8 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-rose-300">Display unavailable</p>
          <h1 className="text-4xl font-semibold mt-3">Event not found</h1>
          <p className="text-lg text-slate-300 mt-2">Open a valid event host panel and launch the projector again.</p>
        </div>
      </section>
    );
  }

  return <ProjectorDisplayView event={event} live={live} />;
}
