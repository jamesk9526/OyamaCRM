"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import TriviaRemoteController from "@/app/components/trivia/TriviaRemoteController";

export default function TriviaRemotePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <Suspense fallback={<main className="min-h-screen bg-[#0d0a16]" />}><TriviaRemoteController eventId={eventId} /></Suspense>;
}
