/** Communications workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventCommunicationsPage frames event-targeted confirmations, reminders, and follow-up emails.
 */
export default function EventCommunicationsPage() {
  return (
    <EventsWorkspacePage
      title="Communications"
      description="Send confirmations, host instructions, reminders, volunteer notes, and post-event follow-up."
      primaryAction="Create Event Email"
      secondaryAction="Open Segments"
      metrics={[
        { label: "Queued Emails", value: 0, helper: "Event-triggered or scheduled sends" },
        { label: "Segments", value: 0, helper: "Guests, hosts, sponsors, volunteers, VIPs" },
        { label: "Templates", value: 0, helper: "Reusable event email templates" },
        { label: "Needs Follow-Up", value: 0, helper: "No-shows, unpaid, missing info" },
      ]}
      sections={[
        {
          title: "Event Messaging",
          description: "This page should connect event records to Oyama communications instead of forcing staff into disconnected mailing tools.",
          bullets: ["Confirmation and receipt emails", "Reminder sequences", "Host and sponsor instructions", "Post-event thank-yous"],
        },
        {
          title: "Merge Fields",
          description: "Event-specific merge fields should make every message feel personalized and operationally useful.",
          bullets: ["Event name/date/location", "Ticket type and order details", "Table and seat assignment", "Donation or payment follow-up links"],
        },
      ]}
    />
  );
}
