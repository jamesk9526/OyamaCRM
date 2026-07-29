"use client";

import { Suspense } from "react";
import TriviaRemoteController from "@/app/components/trivia/TriviaRemoteController";

export default function TriviaRemoteEntryPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#0d0a16]" />}><TriviaRemoteController /></Suspense>;
}
