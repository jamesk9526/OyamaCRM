/** Events CRM module root route. */

import EventsWorkspaceSelectorPage from "@/app/components/events/EventsWorkspaceSelectorPage";

/**
 * EventsPage is the EventSTUDIO first-entry surface and requires staff to choose an event
 * before moving into event-scoped operations.
 */
export default function EventsPage() {
  return <EventsWorkspaceSelectorPage />;
}
