"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/** Resolves retired Trivia application URLs to the owning Event workspace. */
export default function LegacyTriviaRouteRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, syncMode, setSyncMode } = useTriviaModuleState();
  const target = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length <= 2 || parts[2] === "events" && !parts[3]) return "/events";
    if (parts[2] === "events" && parts[3] === "new") return "/events";
    const oldId = parts[2] === "display" ? parts[3] : parts[2] === "events" ? parts[3] : null;
    if (!oldId) return "/events";
    const event = state.events.find((item) => item.id === oldId || item.legacyTriviaId === oldId || item.linkedEventsEventId === oldId);
    if (!event) return null;
    const eventId = event.linkedEventsEventId || event.id;
    if (parts[2] === "display") return `/events/${eventId}/trivia/projector`;
    const legacyView = parts[4] ?? "overview";
    if (legacyView === "builder") return `/events/${eventId}/trivia/builder`;
    if (["host", "scores", "scoreboard", "judge", "recovery", "answer-key", "printables"].includes(legacyView)) return `/events/${eventId}/trivia/host`;
    if (legacyView === "check-in") return `/events/${eventId}/day`;
    if (legacyView === "registration") return `/events/${eventId}/registration`;
    return `/events/${eventId}/trivia`;
  }, [pathname, state.events]);
  useEffect(() => { if (syncMode !== "server") setSyncMode("server"); }, [setSyncMode, syncMode]);
  useEffect(() => { if (target) router.replace(target); }, [router, target]);
  return <main className="grid min-h-dvh place-items-center bg-stone-50 p-6"><p className="text-sm text-slate-600">{target ? "Opening the event workspace…" : "Finding the Event that owns this Trivia Night…"}</p></main>;
}
