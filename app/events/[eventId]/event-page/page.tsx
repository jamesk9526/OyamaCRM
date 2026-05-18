// Event-scoped event-page route wrapper for /events/[eventId]/event-page.

import EventsPageBuilderRoute from "@/app/events/page-builder/page";

/** EventWorkspaceEventPageRoute renders the event-scoped public page builder inside Events CRM. */
export default function EventWorkspaceEventPageRoute() {
  return <EventsPageBuilderRoute />;
}
