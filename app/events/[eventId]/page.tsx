import { redirect } from "next/navigation";

interface EventPublicRouteProps {
  params: Promise<{ eventId: string }>;
}

function looksLikeEventId(value: string): boolean {
  if (/^demo_evt_/i.test(value)) return true;
  if (value.includes("_")) return true;
  return /^c[a-z0-9]{20,}$/i.test(value);
}

/**
 * /events/[eventId] is a compatibility shim.
 * Real event IDs still go to overview; non-ID values redirect to root slug URLs.
 */
export default async function EventPublicRoute({ params }: EventPublicRouteProps) {
  const resolved = await params;
  const slugOrId = resolved.eventId;

  if (looksLikeEventId(slugOrId)) {
    redirect(`/events/${slugOrId}/overview`);
  }

  redirect(`/${slugOrId}`);
}
