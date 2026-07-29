"use client";
import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import ProjectorDisplayView from "@/app/components/trivia/ProjectorDisplayView";
export default function TriviaLeaderboardDisplayPage() { const { eventId } = useParams<{ eventId: string }>(); const { state, syncMode, setSyncMode } = useTriviaModuleState(); useEffect(() => { if (syncMode !== "server") setSyncMode("server"); }, [setSyncMode, syncMode]); const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]); const live = event ? state.liveByEventId[event.id] : null; if (!event || !live) return <main className="flex min-h-screen items-center justify-center bg-black text-white">Display unavailable</main>; return <ProjectorDisplayView event={event} live={{ ...live, stage: "leaderboard" }} />; }
