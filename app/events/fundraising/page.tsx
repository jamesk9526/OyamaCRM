/** Fundraising workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventFundraisingPage frames event giving, pledges, and special fundraiser activity tracking.
 */
export default function EventFundraisingPage() {
  return (
    <EventsWorkspacePage
      title="Fundraising"
      description="Track event gifts, pledges, sponsor payments, paddle raises, auction-style revenue, and special activities."
      primaryAction="Record Event Gift"
      secondaryAction="Open Giving Totals"
      metrics={[
        { label: "Event Gifts", value: "$0", helper: "Donations tied to the event" },
        { label: "Pledges", value: "$0", helper: "Outstanding event-related pledges" },
        { label: "Sponsor Revenue", value: "$0", helper: "Paid sponsor commitments" },
        { label: "Activities", value: 0, helper: "Auction / appeal / game modules" },
      ]}
      sections={[
        {
          title: "Revenue Streams",
          description: "Event fundraising often includes far more than ticket sales, so this workspace must track each revenue source cleanly.",
          bullets: ["Ticket revenue", "Sponsorship revenue", "Appeal and paddle raise gifts", "Auction or game-related income"],
        },
        {
          title: "Donor Sync",
          description: "Every event gift needs to land back on the constituent profile and remain queryable in donor reporting.",
          bullets: ["Event-tagged donations", "Pledge follow-up tasks", "Payment method breakdowns", "Post-event donor segmentation"],
        },
      ]}
    />
  );
}
