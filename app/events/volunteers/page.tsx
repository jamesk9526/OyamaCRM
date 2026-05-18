// Legacy global /events/volunteers route — redirects to the event selector.
// Per the event-first workspace model, volunteers are scoped to a selected event.
// Canonical route: /events/[eventId]/volunteers

import { redirect } from "next/navigation";

/** Legacy compatibility redirect for /events/volunteers. */
export default function LegacyVolunteersRedirect() {
  redirect("/events/events");
}
