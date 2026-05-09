// Event-scoped tasks route wrapper for /events/[eventId]/tasks.

import EventTasksPage from "@/app/events/tasks/page";

/**
 * EventWorkspaceTasksPage renders the tasks tool inside event workspace routing.
 */
export default function EventWorkspaceTasksPage() {
  return <EventTasksPage />;
}
