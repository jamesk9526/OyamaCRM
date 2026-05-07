import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function EventsPage() {
  return (
    <PagePlaceholder
      title="Events"
      icon="📅"
      description="Organize fundraising events, manage registrations, and track revenue."
      stats={[
        { label: "Upcoming Events", description: "Next 30 days" },
        { label: "Total Attendees", description: "This year" },
        { label: "Event Revenue (YTD)", description: "Tickets + sponsorships" },
        { label: "Active Registrations", description: "Open events" },
      ]}
      features={[
        "Event creation with registration pages",
        "Ticket types and pricing tiers",
        "Online registration and check-in",
        "Attendee list management",
        "Revenue tracking (tickets, sponsorships, auction)",
        "Event-specific communication tools",
        "Post-event donor follow-up workflows",
      ]}
    />
  );
}
