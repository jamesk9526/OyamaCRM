"use client";

import { useParams } from "next/navigation";
import TriviaLiveProjector from "@/app/components/trivia/TriviaLiveProjector";

export default function TriviaCheckInDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <TriviaLiveProjector eventId={eventId} stage="check_in_open" />;
}
