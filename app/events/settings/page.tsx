/** Settings workspace route for Events CRM. */

import EventsWorkspacePage from "@/app/components/events/EventsWorkspacePage";

/**
 * EventSettingsPage frames event-wide defaults, templates, and registration behavior.
 */
export default function EventSettingsPage() {
  return (
    <EventsWorkspacePage
      title="Settings"
      description="Configure event templates, registration defaults, question sets, branding, and operational rules."
      primaryAction="Save Defaults"
      secondaryAction="Open Templates"
      metrics={[
        { label: "Templates", value: 0, helper: "Reusable gala or banquet setups" },
        { label: "Question Sets", value: 0, helper: "Meal, childcare, accessibility, and more" },
        { label: "Brand Themes", value: 0, helper: "Public registration page styling" },
        { label: "Automations", value: 0, helper: "Milestone-driven event workflows" },
      ]}
      sections={[
        {
          title: "Setup Templates",
          description: "Annual galas and recurring event formats should be reusable instead of rebuilt every year.",
          bullets: ["Ticket defaults", "Sponsor packages", "Planning checklists", "Registration question sets"],
        },
        {
          title: "Public Registration Defaults",
          description: "This is where public page branding and registration behavior should be controlled module-wide.",
          bullets: ["Confirmation messages", "Question visibility rules", "Payment and refund defaults", "Check-in QR behavior"],
        },
      ]}
    />
  );
}
