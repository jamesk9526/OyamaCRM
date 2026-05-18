// Event-scoped emails route wrapper for /events/[eventId]/emails.

import EventCommunicationsPage from "@/app/events/communications/page";

/**
 * EventWorkspaceEmailsPage renders the communications workspace within event-scoped routing.
 * The legacy global /events/emails route now redirects to /events/events.
 */
export default function EventWorkspaceEmailsPage() {
  return <EventCommunicationsPage />;
}
