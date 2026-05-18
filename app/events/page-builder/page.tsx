"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { EventsPageBuilderLanding } from "@/app/components/events/EventsPageBuilderLanding";
import EventPageBuilderShell from "@/app/components/events/page-builder/EventPageBuilderShell";

/**
 * EventsPageBuilderRoute keeps /events/page-builder as a compatibility entrypoint.
 * Canonical workflow is event-scoped at /events/[eventId]/event-page.
 */
export default function EventsPageBuilderRoute() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const scopedEventId = (params.eventId ?? "").trim();
  const queryEventId = (searchParams.get("eventId") ?? "").trim();

  useEffect(() => {
    if (!scopedEventId && queryEventId) {
      router.replace(`/events/${queryEventId}/event-page`);
    }
  }, [queryEventId, router, scopedEventId]);

  if (scopedEventId) {
    return <EventPageBuilderShell eventId={scopedEventId} />;
  }

  if (queryEventId) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        Redirecting to event-scoped page builder...
      </div>
    );
  }

  return <EventsPageBuilderLanding />;
}
