"use client";
import { useParams } from "next/navigation";
import TriviaEventWorkspaceLoader from "@/app/components/trivia/TriviaEventWorkspaceLoader";
export default function TriviaScoreboardPage() { const { eventId } = useParams<{ eventId: string }>(); return <TriviaEventWorkspaceLoader eventId={eventId} view="scoreboard" />; }
