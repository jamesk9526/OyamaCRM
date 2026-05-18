// Legacy global /events/emails route — redirects to the event selector.
// Per the event-first workspace model, emails are scoped to a selected event.
// Canonical route: /events/[eventId]/emails

import { redirect } from "next/navigation";

/** Legacy compatibility redirect for /events/emails. */
export default function LegacyEmailsEventsRedirect() {
  redirect("/events/events");
}
