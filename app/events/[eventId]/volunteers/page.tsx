// Event-scoped volunteers route wrapper for /events/[eventId]/volunteers.

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventWorkspaceVolunteersPage renders the volunteers scaffold within event-scoped routing.
 * The legacy global /events/volunteers route now redirects to /events/events.
 */
export default function EventWorkspaceVolunteersPage() {
  return (
    <EventsWorkspacePage
      title="Volunteers"
      description="Assign event-night roles, shifts, permissions, notes, and staff instructions."
      primaryAction="Add Volunteer"
      secondaryAction="Assign Shift"
      metrics={[
        { label: "Volunteers", value: 0, helper: "Assigned to this event workflow" },
        { label: "Roles", value: 0, helper: "Check-in, greeter, usher, runner, tech, cleanup" },
        { label: "Open Shifts", value: 0, helper: "Coverage gaps to fill" },
        { label: "Instructions Sent", value: 0, helper: "Volunteer communication readiness" },
      ]}
      sections={[
        {
          title: "Shift Planning",
          description: "Volunteers need clear roles, timing, permissions, and event-night instructions.",
          bullets: ["Door and check-in teams", "Room ushers and hosts", "Runner and AV support", "Cleanup and post-event assignments"],
        },
        {
          title: "Permissions",
          description: "Some volunteers will need check-in tools while others should only see shift details and task notes.",
          bullets: ["Event-night check-in access", "Table-coordinator permissions", "Communication-only roles", "Volunteer instruction packs"],
        },
      ]}
    />
  );
}
