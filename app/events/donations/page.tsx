// Compatibility route wrapper for /events/donations.

import EventFundraisingPage from "@/app/events/fundraising/page";

/**
 * EventDonationsPage keeps legacy donations links pointed to the fundraising workspace.
 */
export default function EventDonationsPage() {
  return <EventFundraisingPage />;
}
