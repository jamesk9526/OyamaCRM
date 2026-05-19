"use client";

import { useParams } from "next/navigation";
import EventPageBuilderShell from "@/app/components/events/page-builder/EventPageBuilderShell";

/** Event-scoped page builder entry point — renders the builder directly for the event in context. */
export default function EventWorkspaceEventPageRoute() {
  const { eventId } = useParams<{ eventId: string }>();
  return <EventPageBuilderShell eventId={eventId} />;
}
