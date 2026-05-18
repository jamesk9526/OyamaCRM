// Legacy global /events/tasks route — redirects to the event selector.
// Per the event-first workspace model, tasks are scoped to a selected event.
// Canonical route: /events/[eventId]/tasks

import { redirect } from "next/navigation";

/** Legacy compatibility redirect for /events/tasks. */
export default function LegacyTasksRedirect() {
  redirect("/events/events");
}
