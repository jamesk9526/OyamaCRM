// Legacy global /events/donations route — redirects to the event selector.
// Per the event-first workspace model, donations are scoped to a selected event.
// Canonical route: /events/[eventId]/donations

import { redirect } from "next/navigation";

/** Legacy compatibility redirect for /events/donations. */
export default function LegacyDonationsRedirect() {
  redirect("/events/events");
}
