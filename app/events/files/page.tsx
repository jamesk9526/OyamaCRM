// Legacy global /events/files route — redirects to the event selector.
// Per the event-first workspace model, files are scoped to a selected event.
// Canonical route: /events/[eventId]/files

import { redirect } from "next/navigation";

/** Legacy compatibility redirect for /events/files. */
export default function LegacyFilesEventsRedirect() {
  redirect("/events/events");
}
