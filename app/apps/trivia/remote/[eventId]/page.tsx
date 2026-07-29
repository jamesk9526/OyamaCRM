"use client";

import { useParams } from "next/navigation";
import TriviaRemoteController from "@/app/components/trivia/TriviaRemoteController";

export default function TriviaRemotePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <TriviaRemoteController eventId={eventId} />;
}
