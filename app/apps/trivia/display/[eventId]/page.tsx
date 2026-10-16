"use client";

import { useParams } from "next/navigation";
import TriviaLiveProjector from "@/app/components/trivia/TriviaLiveProjector";

/** Audience-safe projector for one server-backed Trivia event. */
export default function TriviaProjectorDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <TriviaLiveProjector eventId={eventId} />;
}
