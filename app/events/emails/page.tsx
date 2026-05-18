// Compatibility route wrapper for /events/emails.

import EventCommunicationsPage from "@/app/events/communications/page";

/**
 * EventEmailsPage keeps legacy email links pointed to the communications workspace.
 */
export default function EventEmailsPage() {
  return <EventCommunicationsPage />;
}
