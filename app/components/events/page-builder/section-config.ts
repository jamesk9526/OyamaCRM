import type { EventPageSectionDefinition, EventPageSectionId, EventPageSectionState } from "@/app/components/events/page-builder/types";

/** Canonical section catalog for event-scoped public page composition. */
export const EVENT_PAGE_SECTION_DEFINITIONS: EventPageSectionDefinition[] = [
  { id: "hero", label: "Hero Section", description: "Event hero banner, headline, date, location, and CTA buttons." },
  { id: "countdown", label: "Countdown", description: "Event countdown panel for the public page." },
  { id: "event-details", label: "Event Details", description: "Date, time, location, registration deadline, and event context." },
  { id: "registration-form", label: "Registration Form", description: "Ticket and table option summaries with registration call-to-action." },
  { id: "table-host-signup", label: "Table Host Signup", description: "Table-host invitation and host package guidance." },
  { id: "sponsorship-levels", label: "Sponsorship Levels", description: "Sponsorship tiers, commitments, and fulfillment summary." },
  { id: "donation-goal", label: "Donation Goal", description: "Fundraising goal callout and donor conversion call-to-action." },
  { id: "donation-form", label: "Donation Form", description: "Public giving call-to-action linked to the event fundraising goal." },
  { id: "progress-meter", label: "Progress Meter", description: "Registration and fundraising progress pulled from event reporting." },
  { id: "speaker-program", label: "Speaker / Program", description: "Speaker and program highlights for event storytelling." },
  { id: "auction-preview", label: "Auction Preview", description: "Featured auction, raffle, or marketplace items with event-night bidding guidance." },
  { id: "live-appeal", label: "Live Appeal", description: "Mission moment pledge ask with giving levels and donor-facing impact language." },
  { id: "volunteer-callout", label: "Volunteer Callout", description: "Volunteer needs, shift guidance, and staff contact handoff for event support." },
  { id: "video", label: "Video", description: "Embedded campaign or event promotion video section." },
  { id: "image-gallery", label: "Image Gallery", description: "Visual gallery for venue, past event, or impact photos." },
  { id: "impact-story", label: "Impact Story", description: "Narrative section for mission impact and donor motivation." },
  { id: "cta-banner", label: "CTA Banner", description: "Focused conversion block for registration, giving, or table hosting." },
  { id: "documents", label: "Documents", description: "Links to sponsorship packets, event details, or downloadable resources." },
  { id: "schedule", label: "Schedule", description: "Event timeline and agenda cadence." },
  { id: "faq", label: "FAQ", description: "Frequently asked public attendee and donor questions." },
  { id: "map-location", label: "Map / Location", description: "Venue location details and map handoff." },
  { id: "sponsor-logos", label: "Sponsor Logos", description: "Public sponsor logo wall from event-linked sponsor records." },
  { id: "share-buttons", label: "Share Buttons", description: "Campaign sharing controls and outbound promotion links." },
  { id: "footer", label: "Footer", description: "Page footer with contact and support details." },
];

const SOURCE_FIELD_MAP: Record<EventPageSectionId, string[]> = {
  hero: ["event.name", "event.startDate", "event.location", "event.status"],
  countdown: ["event.startDate"],
  "event-details": ["event.startDate", "event.endDate", "event.location", "event.registrationDeadline"],
  "registration-form": ["event.registrationDeadline", "ticketTypes", "event.capacity", "event.registrationGoal"],
  "table-host-signup": ["ticketTypes[isTable=true]", "event.location", "event.startDate"],
  "sponsorship-levels": ["sponsors", "sponsors.level", "sponsors.amount"],
  "donation-goal": ["report.revenue.goal", "report.revenue.total", "event.revenueGoal"],
  "donation-form": ["event.revenueGoal", "report.revenue.total", "publicUrl"],
  "progress-meter": ["report.attendance.progress", "report.revenue.progress", "report.attendance.total"],
  "speaker-program": ["event.description", "event.internalNotes (future API)"],
  "auction-preview": ["event.name", "ticketTypes", "sponsors"],
  "live-appeal": ["event.revenueGoal", "report.revenue.total", "report.revenue.progress"],
  "volunteer-callout": ["event.startDate", "event.location", "volunteers (future API)"],
  video: ["event.description"],
  "image-gallery": ["sponsors.logoUrl", "event.location"],
  "impact-story": ["event.description", "report.revenue.goal"],
  "cta-banner": ["ticketTypes", "publicUrl"],
  documents: ["publicUrl"],
  schedule: ["event.startDate", "event.endDate"],
  faq: ["event.type", "event.location", "event.registrationDeadline"],
  "map-location": ["event.location", "event.address", "event.city", "event.state", "event.zip", "event.virtualUrl"],
  "sponsor-logos": ["sponsors.logoUrl", "sponsors.websiteUrl"],
  "share-buttons": ["publicUrl", "event.name"],
  footer: ["event.name", "event.location", "event.startDate"],
};

/** Creates default section state with event-data locking enabled. */
export function createDefaultEventPageSectionState(): EventPageSectionState[] {
  const optionalSections = new Set<EventPageSectionId>(["auction-preview", "donation-form", "video", "image-gallery", "documents", "volunteer-callout"]);

  return EVENT_PAGE_SECTION_DEFINITIONS.map((section) => {
    if (section.id === "hero") {
      return {
        id: section.id,
        enabled: true,
        lockToEventData: true,
        content: {
          kicker: "Join us for a night of hope",
          title: "",
          subtitle: "Gala 2027",
          primaryButtonText: "Get Tickets",
          primaryButtonLink: "#registration",
          secondaryButtonText: "View Event Details",
          secondaryButtonLink: "#event-details",
        },
        design: {
          backgroundType: "image",
          backgroundImageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1800&q=80",
          backgroundColor: "#120c3b",
          overlayOpacity: 62,
          showScrollIndicator: true,
          accentColor: "#8b5cf6",
          textAlign: "center",
        },
        advanced: { anchorId: "hero" },
      };
    }

    return {
      id: section.id,
      enabled: !optionalSections.has(section.id),
      lockToEventData: true,
      content: {
        heading: section.label,
        body: section.description,
      },
      design: {
        accentColor: "#8b5cf6",
        textAlign: "left",
      },
      advanced: {
        anchorId: section.id,
      },
    };
  });
}

/** Resolves source field hints used by the section inspector panel. */
export function getSectionSourceFields(sectionId: EventPageSectionId): string[] {
  return SOURCE_FIELD_MAP[sectionId] ?? [];
}

/** Utility resolver for section metadata lookups. */
export function getSectionDefinition(sectionId: EventPageSectionId): EventPageSectionDefinition {
  return EVENT_PAGE_SECTION_DEFINITIONS.find((section) => section.id === sectionId) ?? EVENT_PAGE_SECTION_DEFINITIONS[0];
}
