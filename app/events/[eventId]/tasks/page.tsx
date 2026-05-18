// Event-scoped tasks route wrapper for /events/[eventId]/tasks.

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventWorkspaceTasksPage renders the tasks scaffold inside event workspace routing.
 * The legacy global /events/tasks route now redirects to /events/events.
 */
export default function EventWorkspaceTasksPage() {
  return (
    <EventsWorkspacePage
      title="Tasks"
      description="Track event planning work across venue, sponsors, tickets, volunteers, printing, and follow-up."
      primaryAction="Add Event Task"
      secondaryAction="Load Checklist Template"
      metrics={[
        { label: "Open Tasks", value: 0, helper: "Event-specific task backlog" },
        { label: "Due This Week", value: 0, helper: "Immediate planning work" },
        { label: "Vendors Linked", value: 0, helper: "Venue, food, printing, AV, and more" },
        { label: "Checklists", value: 0, helper: "Reusable gala and banquet templates" },
      ]}
      sections={[
        {
          title: "Planning Board",
          description: "Each event needs a dedicated planning board that sits close to the event data rather than living in a generic task list.",
          bullets: ["Venue and food tasks", "Sponsor and donor follow-up", "Printing and run-of-show", "Volunteer coordination"],
        },
        {
          title: "Template Library",
          description: "Recurring galas and annual banquets should start from a reusable checklist rather than rebuilding from scratch.",
          bullets: ["Gala planning template", "Conference checklist", "Volunteer event setup", "Post-event stewardship template"],
        },
      ]}
    />
  );
}
