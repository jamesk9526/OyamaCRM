"use client";

import { useParams } from "next/navigation";
import TriviaLiveProjector from "@/app/components/trivia/TriviaLiveProjector";

export default function TriviaLeaderboardDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <TriviaLiveProjector eventId={eventId} stage="leaderboard" />;
}
