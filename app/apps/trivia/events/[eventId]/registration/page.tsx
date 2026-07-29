"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import TriviaRegistrationSettingsPanel from "@/app/components/trivia/TriviaRegistrationSettingsPanel";

export default function TriviaRegistrationSetupPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const api = useTriviaModuleState();
  const event = useMemo(() => api.state.events.find((item) => item.id === eventId) ?? null, [api.state.events, eventId]);
  if (!event) return <section className="border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">Event not found.</section>;
  return <TriviaRegistrationSettingsPanel event={event} syncMode={api.syncMode} connectionStatus={api.connectionStatus} onSetSyncMode={api.setSyncMode} onUpdate={(updates) => api.updateRegistrationSettings(event.id, updates)} />;
}
