// Central sidebar configuration maps for Donor, Compassion, Events, HRM, and Watchdog modules.

import type { CrmSidebarGroup, SidebarItemBadge } from "@/app/components/layout/CrmSidebar";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";
import OyamaAdvancedIcon from "@/app/components/ui/OyamaAdvancedIcon";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

interface DonorSidebarOptions {
  qbEnabled: boolean;
}

const DONOR_TO_ADVANCED_ICON: Record<string, string> = {
  "donor-dashboard": "dashboard",
  constituents: "donors",
  donations: "donation",
  campaigns: "campaign",
  grants: "files",
  "fund-designation": "notes",
  "quickbooks-queue": "billing",
  reports: "reports",
  tasks: "tasks",
  calendar: "notes",
  communications: "chat",
  "contacts-manager": "contacts",
  letters: "notes",
  "steward-signals": "analytics",
  "steward-ai": "chat",
  volunteer: "users",
  "event-fundraising": "campaign",
  "workflow-automation": "integrations",
  database: "files",
  "field-mapping": "files",
  settings: "settings",
  help: "help",
  "system-status": "security",
  documentation: "files",
  integrations: "integrations",
};

const DonorPackIcon = ({ slug }: { slug: string }) => (
  <OyamaAdvancedIcon
    name={DONOR_TO_ADVANCED_ICON[slug] ?? "dashboard"}
    size={18}
    className="h-[18px] w-[18px] shrink-0"
  />
);

const AdvancedPackIcon = ({ name }: { name: string }) => (
  <OyamaAdvancedIcon name={name} size={18} className="h-[18px] w-[18px] shrink-0" />
);

const DONOR_ICONS = {
  dashboard: <DonorPackIcon slug="donor-dashboard" />,
  constituents: <DonorPackIcon slug="constituents" />,
  donations: <DonorPackIcon slug="donations" />,
  campaigns: <DonorPackIcon slug="campaigns" />,
  grants: <DonorPackIcon slug="grants" />,
  designations: <DonorPackIcon slug="fund-designation" />,
  payments: <DonorPackIcon slug="quickbooks-queue" />,
  reports: <DonorPackIcon slug="reports" />,
  tasks: <DonorPackIcon slug="tasks" />,
  meetings: <DonorPackIcon slug="calendar" />,
  communications: <DonorPackIcon slug="communications" />,
  contactsManager: <DonorPackIcon slug="contacts-manager" />,
  letters: <DonorPackIcon slug="letters" />,
  livecom: <DonorPackIcon slug="communications" />,
  stewardPaths: <AdvancedPackIcon name="steward-paths-special" />,
  signals: <DonorPackIcon slug="steward-signals" />,
  agentSteward: <DonorPackIcon slug="steward-ai" />,
  volunteers: <DonorPackIcon slug="volunteer" />,
  events: <DonorPackIcon slug="event-fundraising" />,
  automations: <DonorPackIcon slug="workflow-automation" />,
  dataTools: <DonorPackIcon slug="database" />,
  customFields: <DonorPackIcon slug="field-mapping" />,
  settings: <DonorPackIcon slug="settings" />,
  help: <DonorPackIcon slug="help" />,
  watchdog: <DonorPackIcon slug="system-status" />,
  webmaster: <DonorPackIcon slug="documentation" />,
  qbSync: <DonorPackIcon slug="integrations" />,
};

/** Returns the refined Donor CRM sidebar groups with item metadata and stable routes. */
export function buildDonorSidebarGroups({ qbEnabled }: DonorSidebarOptions): CrmSidebarGroup[] {
  const systemItems: CrmSidebarGroup["items"] = [
    {
      id: "reports",
      label: "Reports",
      href: "/reports",
      icon: DONOR_ICONS.reports,
      kind: "insight" as const,
      description: "Open DonorCRM report tools for giving, retention, stewardship, and campaigns.",
    },
    {
      id: "settings",
      label: "Settings",
      href: "/settings",
      icon: DONOR_ICONS.settings,
      kind: "system" as const,
      description: "Configure organization, workspace, and donor CRM settings.",
    },
    {
      id: "data-tools",
      label: "Data Tools",
      href: "/data-tools",
      icon: DONOR_ICONS.dataTools,
      kind: "system" as const,
      description: "Clean, dedupe, and maintain donor data quality.",
    },
    {
      id: "custom-fields",
      label: "Custom Fields",
      href: "/custom-fields",
      icon: DONOR_ICONS.customFields,
      kind: "system" as const,
      description: "Manage configurable donor and donation fields.",
    },
    {
      id: "help",
      label: "Help",
      href: "/help?scope=donor&scopePath=/",
      icon: DONOR_ICONS.help,
      kind: "system" as const,
      description: "Open donor CRM help and operational guidance.",
    },
  ];

  if (qbEnabled) {
    systemItems.splice(3, 0, {
      id: "qb-sync",
      label: "QB Sync",
      href: "/quickbooks-sync",
      icon: DONOR_ICONS.qbSync,
      kind: "system" as const,
      description: "Queue and manually sync donation records to QuickBooks.",
    });
  }

  return [
    {
      id: "overview",
      label: "Overview",
      defaultOpen: true,
      collapsible: false,
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          href: "/",
          icon: DONOR_ICONS.dashboard,
          exact: true,
          kind: "workspace" as const,
          description: "View donor CRM overview and fundraising health.",
        },
      ],
    },
    {
      id: "people-relationships",
      label: "Donor Records",
      defaultOpen: true,
      collapsible: true,
      items: [
        {
          id: "constituents",
          label: "Constituents",
          href: "/constituents",
          icon: DONOR_ICONS.constituents,
          kind: "core_record" as const,
          description: "Manage donors, volunteers, members, and supporters.",
        },
        {
          id: "steward-signals",
          label: "Steward Signals",
          href: "/steward-signals",
          icon: DONOR_ICONS.signals,
          kind: "insight" as const,
          description: "Review donor signals, opportunities, and engagement insights.",
        },
      ],
    },
    {
      id: "fundraising",
      label: "Fundraising",
      defaultOpen: true,
      collapsible: true,
      items: [
        {
          id: "donations",
          label: "Donations",
          href: "/donations",
          icon: DONOR_ICONS.donations,
          kind: "core_record" as const,
          description: "Track gifts, giving history, and donation activity.",
        },
        {
          id: "campaigns",
          label: "Campaigns",
          href: "/campaigns",
          icon: DONOR_ICONS.campaigns,
          kind: "core_record" as const,
          description: "Manage fundraising campaigns and appeals.",
        },
        {
          id: "grants",
          label: "Grants",
          href: "/grants",
          icon: DONOR_ICONS.grants,
          kind: "core_record" as const,
          description: "Track grant opportunities, deadlines, and awards.",
        },
        {
          id: "payments",
          label: "Payments",
          href: "/payments",
          icon: DONOR_ICONS.payments,
          kind: "core_record" as const,
          description: "Review payment records and transaction activity.",
        },
        {
          id: "designations",
          label: "Funds",
          href: "/designations",
          icon: DONOR_ICONS.designations,
          kind: "system" as const,
          description: "Manage fund/designation options used when recording donations.",
        },
      ],
    },
    {
      id: "engagement",
      label: "Outreach & Communications",
      defaultOpen: true,
      collapsible: true,
      items: [
        {
          id: "oyama-email",
          label: "OyamaEmails",
          href: "/oyama-email",
          activePath: "/oyama-email",
          icon: DONOR_ICONS.communications,
          kind: "communication_tool" as const,
          badge: "New" as SidebarItemBadge,
          permissions: ["view:communications"],
          description: "Open the dedicated email studio for templates, send workflows, queue management, and analytics.",
        },
        {
          id: "oyama-letters",
          label: "OyamaLetters",
          href: "/oyama-letters",
          activePath: "/oyama-letters",
          icon: DONOR_ICONS.letters,
          kind: "communication_tool" as const,
          description: "Create, print, and manage donor letters and printable mail workflows.",
        },
        {
          id: "steward-paths",
          label: "Steward Paths",
          href: "/steward-paths",
          icon: DONOR_ICONS.stewardPaths,
          kind: "workspace" as const,
          badge: "App" as SidebarItemBadge,
          permissions: ["steward_paths.view"],
          description: "Build donor engagement sequences and follow-up workflows.",
        },
        {
          id: "events",
          label: "Events",
          href: "/events",
          icon: DONOR_ICONS.events,
          kind: "daily_tool" as const,
          description: "Manage fundraising events and registrations.",
        },
        {
          id: "volunteers",
          label: "Volunteers",
          href: "/volunteers",
          icon: DONOR_ICONS.volunteers,
          kind: "people" as const,
          description: "Manage volunteer relationships and involvement.",
        },
        {
          id: "livecom",
          label: "LiveCom",
          href: "/livecom/inbox",
          activePath: "/livecom",
          icon: DONOR_ICONS.livecom,
          kind: "communication_tool" as const,
          badge: "New" as SidebarItemBadge,
          description: "Open the LiveCom Inbox for website chat and live donor communication.",
        },
      ],
    },
    {
      id: "work-planning",
      label: "Work Planning",
      defaultOpen: true,
      collapsible: true,
      items: [
        {
          id: "tasks",
          label: "Tasks",
          href: "/tasks",
          icon: DONOR_ICONS.tasks,
          kind: "daily_tool" as const,
          description: "Manage follow-up tasks and stewardship assignments.",
        },
        {
          id: "meetings",
          label: "Meetings",
          href: "/meetings",
          icon: DONOR_ICONS.meetings,
          kind: "daily_tool" as const,
          description: "Track donor meetings and relationship touchpoints.",
        },
      ],
    },
    {
      id: "system",
      label: "System",
      defaultOpen: false,
      collapsible: true,
      items: systemItems,
    },
  ];
}

/** Returns Compassion CRM sidebar groups following the shared config pattern. */
export function buildCompassionSidebarGroups(): CrmSidebarGroup[] {
  return [
    {
      id: "care-workspace",
      label: "Care Workspace",
      defaultOpen: true,
      items: [
        { id: "dashboard", label: "Dashboard", href: "/compassion/dashboard", icon: <OyamaGradientIcon name="growth-analytics" />, exact: true, kind: "workspace", description: "Compassion CRM dashboard and daily service overview." },
        { id: "clients", label: "Clients", href: "/compassion/clients", icon: <OyamaGradientIcon name="constituent-search" />, kind: "core_record", description: "Manage privacy-first client records and profile history." },
        { id: "cases", label: "Cases", href: "/compassion/cases", icon: <OyamaGradientIcon name="contact-checklist" />, kind: "daily_tool", description: "Open and manage client cases with status workflows." },
        { id: "appointments", label: "Appointments", href: "/compassion/appointments", icon: <OyamaGradientIcon name="task-checklist" />, kind: "daily_tool", description: "Schedule and manage office appointments." },
        { id: "follow-ups", label: "Follow Ups", href: "/compassion/follow-ups", icon: <OyamaGradientIcon name="momentum-growth" />, kind: "daily_tool", description: "Manage pending follow-up work and case touchpoints." },
        { id: "reports", label: "Reports", href: "/compassion/reports", icon: <OyamaGradientIcon name="reporting-dashboard" />, kind: "insight", description: "Review care outcomes and module-level trends." },
      ],
    },
    {
      id: "system",
      label: "System",
      defaultOpen: false,
      collapsible: true,
      items: [
        { id: "data-tools", label: "Data Tools", href: "/compassion/data-tools", icon: <OyamaGradientIcon name="client-profile-sync" />, kind: "system", description: "Import, validate, and clean client workspace data." },
        { id: "settings", label: "Settings", href: "/compassion/settings", icon: DONOR_ICONS.settings, kind: "system", description: "Configure Compassion workspace settings and policies." },
        { id: "help", label: "Help", href: "/help?scope=compassion&scopePath=/compassion/dashboard", icon: DONOR_ICONS.help, kind: "system", description: "Open Compassion help and role-specific guides." },
      ],
    },
  ];
}

/** Reserved static route segments that should never be interpreted as dynamic Events IDs. */
export const EVENTS_RESERVED_SEGMENTS = new Set([
  "events",
  "workspace",
  "setup",
  "page-builder",
  "templates",
  "reports",
  "check-in",
  "communications",
  "emails",
  "donations",
  "files",
  "fundraising",
  "guests",
  "hosts",
  "follow-up",
  "overview",
  "event-page",
  "registration",
  "orders",
  "settings",
  "sponsors",
  "tables",
  "tasks",
  "tickets",
  "volunteers",
]);

/** Resolves active event ID from event-scoped route paths for EventSTUDIO sidebar context. */
export function resolveActiveEventId(pathname: string, searchParams: Pick<URLSearchParams, "get">): string | null {
  const explicitEventId = searchParams.get("eventId");
  if (explicitEventId) {
    return explicitEventId;
  }

  const parts = pathname.split("/").filter(Boolean);
  const maybeEventId = parts[1];

  if (!maybeEventId || EVENTS_RESERVED_SEGMENTS.has(maybeEventId)) {
    return null;
  }

  return maybeEventId;
}

export interface EventsSidebarContext {
  id: string;
  name?: string | null;
  status?: string | null;
  startDate?: string | null;
  location?: string | null;
  active?: boolean | null;
}

function formatSidebarEventDate(value?: string | null): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";

  const hasExplicitTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
  if (hasExplicitTime) {
    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSidebarEventStatus(value?: string | null, active?: boolean | null): string {
  if (value) {
    return value.toLowerCase().replace(/_/g, " ");
  }
  return active ? "active" : "inactive";
}

function resolveSelectedEventBadge(activeEvent: EventsSidebarContext): SidebarItemBadge | undefined {
  const status = (activeEvent.status ?? "").trim().toUpperCase();

  if (status === "DRAFT") return "Planned";
  if (status === "ACTIVE" || activeEvent.active) return "Live";
  if (status === "CANCELLED" || status === "ARCHIVED") return "Partial";
  if (activeEvent.active === false) return "Partial";

  return undefined;
}

function buildEventWorkspaceGroups(activeEvent: EventsSidebarContext): CrmSidebarGroup[] {
  const eventId = activeEvent.id;
  const selectedEventLabel = activeEvent.name?.trim() || "Selected Event";
  const selectedEventMeta = [
    formatSidebarEventStatus(activeEvent.status, activeEvent.active),
    formatSidebarEventDate(activeEvent.startDate),
    activeEvent.location?.trim(),
  ].filter(Boolean).join(" · ");

  return [
    {
      id: "selected-event",
      label: "Selected Event",
      defaultOpen: true,
      items: [
        {
          id: "selected-event-overview",
          label: selectedEventLabel,
          secondaryLabel: selectedEventMeta || "Event context locked",
          href: `/events/${eventId}/overview`,
          activePath: `/events/${eventId}`,
          icon: <OyamaGradientIcon name="growth-analytics" />,
          kind: "workspace",
          badge: resolveSelectedEventBadge(activeEvent),
          description: "Current event context for all command-center tools in this workspace.",
        },
      ],
    },
    {
      id: "event-command-center",
      label: "Event Command Center",
      defaultOpen: true,
      collapsible: true,
      items: [
        { id: "overview", label: "Overview", href: `/events/${eventId}/overview`, activePath: `/events/${eventId}`, icon: <OyamaGradientIcon name="growth-analytics" />, kind: "workspace", description: "Event-level dashboard and operating summary." },
        { id: "guests", label: "Guests / Registrants", href: `/events/${eventId}/guests`, icon: <OyamaGradientIcon name="constituent-search" />, kind: "core_record", description: "Track registrants, donor links, RSVP status, and attendance details." },
        { id: "tables", label: "Tables / Seating", href: `/events/${eventId}/tables`, icon: <OyamaGradientIcon name="relationship-partnership" />, kind: "daily_tool", description: "Manage floor plan, table capacity, and guest placement." },
        { id: "hosts", label: "Table Hosts", href: `/events/${eventId}/hosts`, icon: <OyamaGradientIcon name="relationship-partnership" />, kind: "daily_tool", badge: "Partial", description: "Manage table hosts, host outreach, and open-seat follow-up queues." },
        { id: "sponsors", label: "Sponsors", href: `/events/${eventId}/sponsors`, icon: <OyamaGradientIcon name="relationship-partnership" />, kind: "core_record", description: "Manage sponsor packages and fulfillment steps." },
        { id: "donations", label: "Donations / Pledges", href: `/events/${eventId}/donations`, icon: DONOR_ICONS.donations, kind: "core_record", description: "Track event donations, pledges, and giving follow-up status." },
        { id: "check-in", label: "Check-In", href: `/events/${eventId}/check-in`, icon: <OyamaGradientIcon name="client-profile-sync" />, kind: "daily_tool", badge: "Live", description: "Run event-night check-in with dark focused door operations." },
        { id: "event-page", label: "Event Page Builder", href: `/events/${eventId}/event-page`, icon: <OyamaGradientIcon name="growth-analytics" />, kind: "communication_tool", description: "Build or edit the public event page for this event." },
        { id: "emails", label: "Emails", href: `/events/${eventId}/emails`, icon: DONOR_ICONS.communications, kind: "communication_tool", description: "Prepare event invitations, reminders, host emails, and follow-up messages." },
        { id: "reports", label: "Reports", href: `/events/${eventId}/reports`, icon: <OyamaGradientIcon name="reporting-dashboard" />, kind: "insight", description: "Review event outcomes, attendance, revenue, and follow-up metrics." },
        { id: "follow-up", label: "Follow-Up", href: `/events/${eventId}/follow-up`, icon: <OyamaGradientIcon name="momentum-growth" />, kind: "daily_tool", badge: "Partial", description: "Queue post-event thank-yous, outreach tasks, and donor handoff lists." },
      ],
    },
    {
      id: "event-settings",
      label: "Event Settings",
      defaultOpen: true,
      collapsible: true,
      items: [
        { id: "event-details", label: "Event Details", href: `/events/${eventId}/settings`, icon: DONOR_ICONS.settings, kind: "system", description: "Manage event details, defaults, and internal setup notes." },
        { id: "forms-registration", label: "Forms / Registration", href: `/events/${eventId}/tickets`, icon: <OyamaGradientIcon name="donor-gift" />, kind: "system", description: "Configure ticketing, registration rules, and capacity controls." },
        { id: "team-staff", label: "Team / Staff", href: `/events/${eventId}/volunteers`, icon: DONOR_ICONS.volunteers, kind: "system", description: "Coordinate volunteer teams, staffing assignments, and event roles." },
        { id: "integrations", label: "Integrations", href: `/events/${eventId}/settings?tab=integrations`, icon: DONOR_ICONS.settings, kind: "system", description: "Review manager integration imports and payment/email readiness." },
      ],
    },
  ];
}

/** Returns EventSTUDIO sidebar groups with one selection hub and event-scoped command center tools. */
export function buildEventsSidebarGroups(activeEvent: EventsSidebarContext | null): CrmSidebarGroup[] {
  const baseGroups: CrmSidebarGroup[] = [
    {
      id: "events",
      label: "EventSTUDIO",
      defaultOpen: true,
      items: [
        { id: "dashboard", label: "Studio Home", href: "/events", icon: <OyamaGradientIcon name="growth-analytics" />, exact: true, kind: "workspace", description: "EventSTUDIO dashboard and fundraising portfolio summary." },
        { id: "events", label: "All Events", href: "/events/events", icon: <OyamaGradientIcon name="task-checklist" />, kind: "core_record", description: "Create, select, duplicate, archive, and review event records." },
      ],
    },
  ];

  if (!activeEvent) {
    return baseGroups;
  }

  return [...baseGroups, ...buildEventWorkspaceGroups(activeEvent)];
}

/** Returns OyamaHRM sidebar groups with shared item metadata and collapsible system tools. */
export function buildHrmSidebarGroups(): CrmSidebarGroup[] {
  return [
    {
      id: "hrm-workforce",
      label: "Workforce",
      defaultOpen: true,
      items: [
        { id: "dashboard", label: "Dashboard", href: "/hrm", exact: true, icon: DONOR_ICONS.dashboard, kind: "workspace", description: "Internal workforce dashboard and staffing snapshot." },
        { id: "people", label: "People", href: "/hrm/people", icon: DONOR_ICONS.constituents, kind: "people", description: "Manage internal staff and board-member records." },
        { id: "scheduling", label: "Scheduling", href: "/hrm/scheduling", icon: DONOR_ICONS.meetings, kind: "daily_tool", description: "Manage schedules and shift assignments." },
        { id: "locations", label: "Locations", href: "/hrm/locations", icon: DONOR_ICONS.campaigns, kind: "system", description: "Manage office and site locations." },
        { id: "messages", label: "Messages", href: "/hrm/messages", icon: DONOR_ICONS.communications, kind: "communication_tool", description: "Send and review internal HRM communication threads." },
      ],
    },
    {
      id: "hrm-system",
      label: "System",
      defaultOpen: false,
      collapsible: true,
      items: [
        { id: "settings", label: "Settings", href: "/hrm/settings", icon: DONOR_ICONS.settings, kind: "system", description: "Manage HRM configuration and defaults." },
        { id: "help", label: "Help", href: "/help?scope=global&scopePath=/hrm", icon: DONOR_ICONS.help, kind: "system", description: "Open HRM how-to guidance." },
      ],
    },
  ];
}

/** Returns OyamaWatchdog sidebar groups with role-aware security navigation. */
export function buildWatchdogSidebarGroups(): CrmSidebarGroup[] {
  return [
    {
      id: "operations-workspace",
      label: "Operations Workspace",
      defaultOpen: true,
      items: [
        { id: "operations-overview", label: "Overview", href: "/watchdog", exact: true, icon: <OyamaGradientIcon name="growth-analytics" size={16} />, kind: "workspace", description: "Central operations posture, attention queue, and readiness summary." },
        { id: "backups", label: "Backups", href: "/watchdog/backups", icon: <OyamaGradientIcon name="contact-checklist" size={16} />, kind: "system", description: "Backup scope coverage, policy controls, and verification history." },
        { id: "restore", label: "Restore", href: "/watchdog/restore", icon: <OyamaGradientIcon name="goal-target" size={16} />, kind: "system", description: "Dry-run and guarded restore execution with typed confirmation." },
        { id: "vault", label: "Vault", href: "/watchdog/vault", icon: <OyamaGradientIcon name="client-profile-sync" size={16} />, kind: "system", description: "Encrypted secrets with audited reveal, copy, and rotation controls." },
      ],
    },
    {
      id: "security-governance",
      label: "Security & Governance",
      defaultOpen: true,
      items: [
        { id: "security", label: "Security", href: "/watchdog/security", icon: <OyamaGradientIcon name="task-checklist" size={16} />, kind: "insight", description: "Permission risk checks, boundary warnings, and security posture." },
        { id: "health", label: "Health", href: "/watchdog/health", icon: <OyamaGradientIcon name="momentum-growth" size={16} />, kind: "insight", description: "Service and dependency readiness with status classification." },
        { id: "audit", label: "Audit", href: "/watchdog/audit", icon: <OyamaGradientIcon name="reporting-dashboard" size={16} />, kind: "insight", description: "Filterable operational event feed for review and forensics." },
        { id: "runbooks", label: "Runbooks", href: "/watchdog/runbooks", icon: <OyamaGradientIcon name="constituent-search" size={16} />, kind: "system", description: "Standardized response guides for incident and recovery workflows." },
      ],
    },
    {
      id: "operations-system",
      label: "System",
      defaultOpen: false,
      collapsible: true,
      items: [
        { id: "settings", label: "Settings", href: "/watchdog/settings", icon: DONOR_ICONS.settings, kind: "system", description: "Manage Watchdog policy and workspace-level settings." },
        { id: "feedback-tickets", label: "Feedback Tickets", href: "/watchdog/feedback-tickets", icon: <OyamaGradientIcon name="reporting-dashboard" size={16} />, kind: "system", description: "Review and triage cross-CRM user feedback." },
      ],
    },
  ];
}
