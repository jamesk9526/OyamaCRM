// Event-scoped guests route wrapper for /events/[eventId]/guests.

import EventGuestsPage from "@/app/events/guests/page";

/**
 * EventWorkspaceGuestsPage renders the guests tool inside event workspace routing.
 */
export default function EventWorkspaceGuestsPage() {
  return <EventGuestsPage />;
}
