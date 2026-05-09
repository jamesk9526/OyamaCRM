/** Sponsors workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventSponsorsPage frames sponsor levels, packages, logos, and event-linked donor relationships.
 */
export default function EventSponsorsPage() {
  return (
    <EventsWorkspacePage
      title="Sponsors"
      description="Manage sponsor levels, package benefits, logos, payments, table assignments, and follow-up."
      primaryAction="Add Sponsor"
      secondaryAction="Export Sponsor List"
      metrics={[
        { label: "Sponsors", value: 0, helper: "All sponsor accounts and packages" },
        { label: "Revenue", value: "$0", helper: "Tracked sponsor commitments" },
        { label: "Logos Missing", value: 0, helper: "Sponsors without artwork" },
        { label: "Follow-Ups", value: 0, helper: "Outstanding sponsor tasks" },
      ]}
      sections={[
        {
          title: "Package Management",
          description: "Sponsorships must connect to organizations and constituents while carrying benefits and recognition settings.",
          bullets: ["Sponsor levels and benefits", "Logo and ad tracking", "Package payment status", "Table and recognition mapping"],
        },
        {
          title: "CRM Integration",
          description: "Sponsors should be visible as constituent or organization activity in Donor CRM, not isolated event-only records.",
          bullets: ["Link to business / constituent profiles", "Create follow-up tasks", "Track renewal conversations", "Push sponsor actions to timelines"],
        },
      ]}
    />
  );
}
