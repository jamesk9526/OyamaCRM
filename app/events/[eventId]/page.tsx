/**
 * /events/[eventId] — redirects to the event overview sub-page.
 * This is a client component because useParams requires the client runtime in Next.js 15+.
 */
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * EventWorkspaceIndexPage — immediately redirects to /events/[eventId]/overview.
 * The layout (layout.tsx) provides the amber banner; this page is just a router shim.
 */
export default function EventWorkspaceIndexPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();

  // Redirect as soon as eventId is available — use replace so back button skips this page
  useEffect(() => {
    if (eventId) {
      router.replace(`/events/${eventId}/overview`);
    }
  }, [eventId, router]);

  return null;
}
