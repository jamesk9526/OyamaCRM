"use client";

import { useParams } from "next/navigation";
import TriviaPublicRegistrationPage from "@/app/components/trivia/TriviaPublicRegistrationPage";

export default function PublicTriviaEventPage() {
  const { slug } = useParams<{ slug: string }>();
  return <TriviaPublicRegistrationPage slug={slug} />;
}
