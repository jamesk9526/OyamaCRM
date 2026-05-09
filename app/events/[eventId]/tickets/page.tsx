// Event-scoped tickets route wrapper for /events/[eventId]/tickets.

import EventTicketsPage from "@/app/events/tickets/page";

/**
 * EventWorkspaceTicketsPage renders the tickets tool inside event workspace routing.
 */
export default function EventWorkspaceTicketsPage() {
  return <EventTicketsPage />;
}
