// Event-scoped donations route wrapper for /events/[eventId]/donations.

import EventFundraisingPage from "@/app/events/fundraising/page";

/**
 * EventWorkspaceDonationsPage renders the fundraising workspace within event-scoped routing.
 * The legacy global /events/donations route now redirects to /events/events.
 */
export default function EventWorkspaceDonationsPage() {
  return <EventFundraisingPage />;
}
