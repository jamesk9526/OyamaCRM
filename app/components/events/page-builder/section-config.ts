import type { EventPageSectionDefinition, EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

/** Canonical section catalog for event-scoped public page composition. */
export const EVENT_PAGE_SECTION_DEFINITIONS: EventPageSectionDefinition[] = [
  { id: "hero", label: "Hero Section", description: "Event hero banner, headline, date, location, and CTA buttons." },
  { id: "event-details", label: "Event Details", description: "Date, time, location, registration deadline, and event context." },
  { id: "registration-form", label: "Registration Form", description: "Ticket and table option summaries with registration call-to-action." },
  { id: "table-host-signup", label: "Table Host Signup", description: "Table-host invitation and host package guidance." },
  { id: "sponsorship-levels", label: "Sponsorship Levels", description: "Sponsorship tiers, commitments, and fulfillment summary." },
  { id: "donation-goal", label: "Donation Goal", description: "Fundraising goal callout and donor conversion call-to-action." },
  { id: "progress-meter", label: "Progress Meter", description: "Registration and fundraising progress pulled from event reporting." },
  { id: "speaker-program", label: "Speaker / Program", description: "Speaker and program highlights for event storytelling." },
  { id: "schedule", label: "Schedule", description: "Event timeline and agenda cadence." },
  { id: "faq", label: "FAQ", description: "Frequently asked public attendee and donor questions." },
  { id: "map-location", label: "Map / Location", description: "Venue location details and map handoff." },
  { id: "sponsor-logos", label: "Sponsor Logos", description: "Public sponsor logo wall from event-linked sponsor records." },
  { id: "share-buttons", label: "Share Buttons", description: "Campaign sharing controls and outbound promotion links." },
  { id: "footer", label: "Footer", description: "Page footer with contact and support details." },
];

const SOURCE_FIELD_MAP: Record<EventPageSectionId, string[]> = {
  hero: ["event.name", "event.startDate", "event.location", "event.status"],
  "event-details": ["event.startDate", "event.endDate", "event.location", "event.registrationDeadline"],
  "registration-form": ["event.registrationDeadline", "ticketTypes", "event.capacity", "event.registrationGoal"],
  "table-host-signup": ["ticketTypes[isTable=true]", "event.location", "event.startDate"],
  "sponsorship-levels": ["sponsors", "sponsors.level", "sponsors.amount"],
  "donation-goal": ["report.revenue.goal", "report.revenue.total", "event.revenueGoal"],
  "progress-meter": ["report.attendance.progress", "report.revenue.progress", "report.attendance.total"],
  "speaker-program": ["event.description", "event.internalNotes (future API)"],
  schedule: ["event.startDate", "event.endDate"],
  faq: ["event.type", "event.location", "event.registrationDeadline"],
  "map-location": ["event.location", "event.address", "event.city", "event.state", "event.zip", "event.virtualUrl"],
  "sponsor-logos": ["sponsors.logoUrl", "sponsors.websiteUrl"],
  "share-buttons": ["publicUrl", "event.name"],
  footer: ["event.name", "event.location", "event.startDate"],
};

/** Creates default section state with event-data locking enabled. */
export function createDefaultEventPageSectionState(): EventPageSectionState[] {
  return EVENT_PAGE_SECTION_DEFINITIONS.map((section) => ({
    id: section.id,
    enabled: true,
    lockToEventData: true,
  }));
}

/** Resolves source field hints used by the section inspector panel. */
export function getSectionSourceFields(sectionId: EventPageSectionId): string[] {
  return SOURCE_FIELD_MAP[sectionId] ?? [];
}

/** Utility resolver for section metadata lookups. */
export function getSectionDefinition(sectionId: EventPageSectionId): EventPageSectionDefinition {
  return EVENT_PAGE_SECTION_DEFINITIONS.find((section) => section.id === sectionId) ?? EVENT_PAGE_SECTION_DEFINITIONS[0];
}
