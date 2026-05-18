// Event-scoped donations route wrapper for /events/[eventId]/donations.

import EventDonationsPage from "@/app/events/donations/page";

/**
 * EventWorkspaceDonationsPage renders the donations workspace within event-scoped routing.
 */
export default function EventWorkspaceDonationsPage() {
  return <EventDonationsPage />;
}
