/** EventsDashboard delegates the module root to the canonical event-first command center. */

import EventsWorkspaceSelectorPage from "@/app/components/events/EventsWorkspaceSelectorPage";

/**
 * EventsDashboard keeps /events stable while removing the separate generic dashboard path.
 */
export default function EventsDashboard() {
  return <EventsWorkspaceSelectorPage />;
}
