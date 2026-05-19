/** Canonical Events CRM workspace map for fundraising event operations. */

export type EventToolStatus = "Working" | "Partially Working" | "Not Implemented";

export type EventWorkspaceTool =
  | "overview"
  | "guests"
  | "tables"
  | "hosts"
  | "sponsors"
  | "registration"
  | "donations"
  | "check-in"
  | "event-page"
  | "emails"
  | "reports"
  | "follow-up"
  | "settings";

/** Journey stage labels used in sidebar grouping. */
export type EventStage = "Plan" | "Fill" | "Fundraise" | "Run" | "Follow Up";

export interface EventWorkspaceToolMeta {
  id: EventWorkspaceTool;
  label: string;
  /** Emoji icon shown next to the tool label in the sidebar. */
  icon: string;
  stage: EventStage;
  description: string;
  status: EventToolStatus;
  routeSegment?: string;
  globalHref?: (eventId: string) => string;
  notes: string;
}

/**
 * Maps each stage name to a display label and icon shown in the sidebar header row.
 * Stages correspond to the nonprofit fundraising event journey:
 *   Plan → Fill seats → Fundraise → Run the event → Follow up after
 */
export const STAGE_META: Record<EventStage, { label: string; icon: string; description: string }> = {
  "Plan":       { label: "Plan",      icon: "📋", description: "Set up registration, pages, and seating" },
  "Fill":       { label: "Fill",      icon: "👥", description: "Manage guests, tables, hosts, and sponsors" },
  "Fundraise":  { label: "Fundraise", icon: "💰", description: "Donations, pledges, and email outreach" },
  "Run":        { label: "Run",       icon: "🎪", description: "Live operations, check-in, and walk-ins" },
  "Follow Up":  { label: "Follow Up", icon: "✅", description: "Reports, thank-yous, and post-event stewardship" },
};

export const EVENT_WORKSPACE_TOOLS: EventWorkspaceToolMeta[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "📊",
    stage: "Plan",
    description: "Event command center, readiness, goals, and next actions.",
    status: "Working",
    routeSegment: "overview",
    notes: "Live event summary route is available.",
  },
  {
    id: "registration",
    label: "Registration",
    icon: "🎫",
    stage: "Plan",
    description: "Ticket types, free registration options, table tickets, and capacity rules.",
    status: "Working",
    routeSegment: "tickets",
    notes: "Uses the current ticket type manager as the registration setup surface.",
  },
  {
    id: "event-page",
    label: "Event Page",
    icon: "🌐",
    stage: "Plan",
    description: "Hosted event page and campaign-page builder entry point.",
    status: "Working",
    routeSegment: "event-page",
    notes: "Event-scoped builder has persistence, publish readiness, payment policy, deployment history, in-app preview, and public registration.",
  },
  {
    id: "guests",
    label: "Guests",
    icon: "👥",
    stage: "Fill",
    description: "Registrant list, RSVP status, donor links, dietary notes, and check-in state.",
    status: "Working",
    routeSegment: "guests",
    notes: "Core guest list is API-backed.",
  },
  {
    id: "tables",
    label: "Tables",
    icon: "🪑",
    stage: "Fill",
    description: "Structured seating list with capacity, open seats, and assignments.",
    status: "Working",
    routeSegment: "tables",
    notes: "Structured table management is available; visual seating still needs a later dedicated build.",
  },
  {
    id: "hosts",
    label: "Hosts",
    icon: "🤝",
    stage: "Fill",
    description: "Table host portal links, host guest lists, and open-seat follow-up.",
    status: "Partially Working",
    routeSegment: "hosts",
    notes: "Host workspace route is available; host portal links and resend controls still need deeper workflow coverage.",
  },
  {
    id: "sponsors",
    label: "Sponsors",
    icon: "💎",
    stage: "Fill",
    description: "Sponsor records, packages, fulfillment notes, and sponsor table context.",
    status: "Working",
    routeSegment: "sponsors",
    notes: "Sponsor manager exists and remains event-scoped.",
  },
  {
    id: "donations",
    label: "Donations",
    icon: "💳",
    stage: "Fundraise",
    description: "Event donations, pledges, recurring giving prospects, and giving follow-up.",
    status: "Partially Working",
    routeSegment: "donations",
    notes: "Event donations route is available with event-scoped summary and workflow cards; donor conversion handoffs remain partial.",
  },
  {
    id: "emails",
    label: "Emails",
    icon: "✉️",
    stage: "Fundraise",
    description: "Segmented event invitations, host reminders, sponsor thanks, and post-event follow-up.",
    status: "Partially Working",
    routeSegment: "emails",
    notes: "Event email workspace route is available; schedule/send automation still needs production hardening.",
  },
  {
    id: "check-in",
    label: "Check-In",
    icon: "✅",
    stage: "Run",
    description: "Live arrival workflow for search, check-in, table assignment, and walk-ins.",
    status: "Working",
    routeSegment: "check-in",
    notes: "Core check-in page is API-backed; dedicated clutter-free volunteer mode is still a later pass.",
  },
  {
    id: "reports",
    label: "Reports",
    icon: "📈",
    stage: "Follow Up",
    description: "Attendance, revenue, check-in rate, sponsor performance, and event outcomes.",
    status: "Working",
    routeSegment: "reports",
    notes: "Reports route uses live event reporting APIs.",
  },
  {
    id: "follow-up",
    label: "Follow-Up",
    icon: "💌",
    stage: "Follow Up",
    description: "Thank-you tasks, pledge follow-up, monthly donor prospects, and Steward summaries.",
    status: "Partially Working",
    routeSegment: "follow-up",
    notes: "Follow-up workspace route is available with next-step planning; automated task generation and donor segmentation are still partial.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    stage: "Follow Up",
    description: "Event defaults, publishing controls, registration policy, and internal notes.",
    status: "Partially Working",
    routeSegment: "settings",
    notes: "Scaffold route exists; production settings persistence needs more backend coverage.",
  },
];

export const EVENT_JOURNEY_STAGES: EventStage[] = [
  "Plan",
  "Fill",
  "Fundraise",
  "Run",
  "Follow Up",
];

/**
 * Global Events CRM tools that operate outside a single selected event.
 * These appear in the "Studio Tools" section at the bottom of the sidebar.
 *
 * TODO: Add a `status: EventToolStatus` field here once templates have full metadata bundle cloning,
 *       so partial global tools can show amber dots like event-scoped tools.
 */
export const GLOBAL_EVENTS_TOOLS = [
  {
    label: "All Events",
    icon: "🗓️",
    description: "Create, select, duplicate, archive, and review event records.",
    href: "/events/events",
  },
  {
    label: "Event Templates",
    icon: "📄",
    description: "Reusable starting points for banquets, galas, campaigns, and open houses.",
    href: "/events/templates",
  },
  {
    label: "Global Reports",
    icon: "📊",
    description: "Cross-event reporting across active and archived fundraising events.",
    href: "/events/reports",
  },
  {
    label: "Event Page Builder",
    icon: "🌐",
    description: "Compatibility selector that routes staff into the scoped /events/[eventId]/event-page builder.",
    href: "/events/page-builder",
  },
];

export function getEventTool(id: EventWorkspaceTool): EventWorkspaceToolMeta {
  return EVENT_WORKSPACE_TOOLS.find((tool) => tool.id === id) ?? EVENT_WORKSPACE_TOOLS[0];
}

export function getEventToolHref(tool: EventWorkspaceToolMeta, eventId: string): string | null {
  if (!eventId) return null;
  if (tool.globalHref) return tool.globalHref(eventId);
  if (!tool.routeSegment) return null;
  return `/events/${eventId}/${tool.routeSegment}`;
}

/** Parses a safe workspace tool from URL query input. */
export function parseEventWorkspaceTool(raw: string | null): EventWorkspaceTool {
  if (!raw) return "overview";
  const match = EVENT_WORKSPACE_TOOLS.find((tool) => tool.id === raw || tool.routeSegment === raw);
  return match ? match.id : "overview";
}
