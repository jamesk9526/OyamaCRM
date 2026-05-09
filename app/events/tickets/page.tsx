/** Tickets workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventTicketsPage outlines the ticket-type builder and sales configuration workspace.
 */
export default function EventTicketsPage() {
  return (
    <EventsWorkspacePage
      title="Tickets"
      description="Build ticket types, pricing windows, discount rules, and registration options."
      primaryAction="Add Ticket Type"
      secondaryAction="Import Pricing"
      metrics={[
        { label: "Active Types", value: 0, helper: "Ticket builder is the next production slice" },
        { label: "Public Types", value: 0, helper: "What guests can buy online" },
        { label: "Internal Types", value: 0, helper: "Comp, sponsor, staff, and house allocations" },
        { label: "Discount Codes", value: 0, helper: "Promo and sponsor unlock codes" },
      ]}
      sections={[
        {
          title: "Ticket Builder",
          description: "This page will manage individual, couple, table, sponsor, VIP, childcare, and donation-only options.",
          bullets: ["Set pricing and quantity", "Open/close sales windows", "Capture required guest fields", "Control public vs internal visibility"],
        },
        {
          title: "Registration Rules",
          description: "Guest information and add-ons will be configured here once the order flow is wired.",
          bullets: ["Per-purchase limits", "Meal and childcare prompts", "Discount code validation", "Early-bird windows"],
        },
      ]}
    />
  );
}
