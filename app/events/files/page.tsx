/** Files workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventFilesPage frames asset and print-file management for event execution.
 */
export default function EventFilesPage() {
  return (
    <EventsWorkspacePage
      title="Files"
      description="Store logos, contracts, venue maps, print materials, seating charts, and badge templates."
      primaryAction="Upload File"
      secondaryAction="Open Asset Folders"
      metrics={[
        { label: "Files", value: 0, helper: "Documents and assets linked to events" },
        { label: "Print Items", value: 0, helper: "Badges, cards, sheets, signs" },
        { label: "Sponsor Logos", value: 0, helper: "Artwork ready for the program" },
        { label: "Templates", value: 0, helper: "Reusable name-badge and print layouts" },
      ]}
      sections={[
        {
          title: "Event Assets",
          description: "The files workspace should keep execution assets close to the event instead of scattered in email threads and shared drives.",
          bullets: ["Program files and menus", "Venue maps and seating charts", "Sponsor logos and ad files", "Volunteer instructions and contracts"],
        },
        {
          title: "Print Suite",
          description: "Printable event materials belong here once PDF generation is connected.",
          bullets: ["Guest list and check-in sheets", "Name badges and tickets", "Table cards and seating sheets", "Donation and pledge cards"],
        },
      ]}
    />
  );
}
