// Central sidebar configuration maps for Donor, Compassion, Events, HRM, and Watchdog modules.

import type React from "react";
import type { CrmSidebarGroup } from "@/app/components/layout/CrmSidebar";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";

interface DonorSidebarOptions {
  qbEnabled: boolean;
}

/** Helper that wraps SVG paths in a consistent icon frame. */
const Ico = ({ d, children, className }: { d?: string; children?: React.ReactNode; className?: string }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const DONOR_ICONS = {
  dashboard: <Ico d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />,
  constituents: <Ico d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />,
  donations: <Ico d="M12 2v20m7-15H9a3 3 0 100 6h6a3 3 0 110 6H5" />,
  campaigns: <Ico d="M12 3l2.8 5.7L21 9.6l-4.5 4.4 1 6.2L12 17l-5.5 3.2 1-6.2L3 9.6l6.2-.9L12 3z" />,
  grants: <Ico d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z" />,
  payments: <Ico><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></Ico>,
  reports: <Ico d="M4 19h16M7 15V9m5 6V5m5 10v-3" />,
  tasks: <Ico d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  meetings: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  communications: <Ico d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  contactsManager: <Ico d="M4 6h16M4 12h10M4 18h16M17 10a3 3 0 110 6 3 3 0 010-6z" />,
  letters: <Ico d="M8 2h8l4 4v16H4V2h4zm1 9h6m-6 4h6m-6 4h4" />,
  livecom: <Ico d="M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-3v-6h5M4 13h5v6H6a2 2 0 01-2-2v-4z" />,
  stewardPaths: <Ico d="M5 7h5M14 7h5M7.5 7a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM5 17h5m4 0h5m-7-10v10m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z" />,
  signals: <Ico d="M3 12h4l2 5 4-10 2 5h6" />,
  agentSteward: <StewardAvatarIcon size={18} alt="" className="ring-emerald-300" />,
  volunteers: <Ico d="M16 11c1.7 0 3-1.6 3-3.5S17.7 4 16 4s-3 1.6-3 3.5 1.3 3.5 3 3.5zM8 11c1.7 0 3-1.6 3-3.5S9.7 4 8 4 5 5.6 5 7.5 6.3 11 8 11zm0 2c-2.8 0-5 1.8-5 4v3h10v-3c0-2.2-2.2-4-5-4zm8 0c-.9 0-1.8.2-2.6.6 1 .9 1.6 2.1 1.6 3.4v3h6v-3c0-2.2-2.2-4-5-4z" />,
  dataTools: <Ico d="M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4zm0 0c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4zm-9 9c0 2.2 4 4 9 4s9-1.8 9-4" />,
  customFields: <Ico><path d="M4 6h16M4 10h10M4 14h16M4 18h8" /><circle cx="16" cy="10" r="2" /><circle cx="14" cy="18" r="2" /></Ico>,
  settings: <Ico d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0 .2.8.9 1.3 1.7 1.3.3 0 .6-.1.9-.2 1.5-.9 3.3.8 2.4 2.4-.5.8-.2 1.9.7 2.3 1.8.4 1.8 2.9 0 3.4-.8.2-1.3.9-1.3 1.7 0 .3.1.6.2.9.9 1.5-.8 3.3-2.4 2.4-.8-.5-1.9-.2-2.3.7-.4 1.8-2.9 1.8-3.4 0-.2-.8-.9-1.3-1.7-1.3-.3 0-.6.1-.9.2-1.5.9-3.3-.8-2.4-2.4.5-.8.2-1.9-.7-2.3-1.8-.4-1.8-2.9 0-3.4.8-.2 1.3-.9 1.3-1.7 0-.3-.1-.6-.2-.9-.9-1.5.8-3.3 2.4-2.4.8.5 1.9.2 2.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z" />,
  help: <Ico d="M9.1 9a3 3 0 115.8 1c0 2-3 2.3-3 4m.1 4h.1M22 12A10 10 0 112 12a10 10 0 0120 0z" />,
  watchdog: <Ico d="M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" />,
  webmaster: <Ico d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20M4.9 4.9a15 15 0 0014.2 14.2M19.1 4.9A15 15 0 014.9 19.1" />,
  qbSync: <Ico d="M4 4v5h.6m14.8 2A8 8 0 004.6 9M20 20v-5h-.6m0 0A8 8 0 015 13m14.4 2H15" />,
};

/** Returns the refined Donor CRM sidebar groups with item metadata and stable routes. */
export function buildDonorSidebarGroups({ qbEnabled }: DonorSidebarOptions): CrmSidebarGroup[] {
  const fundraisingItems: CrmSidebarGroup["items"] = [
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
  ];

  if (qbEnabled) {
    fundraisingItems.push({
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
      id: "home",
      label: "Home",
      defaultOpen: true,
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
    {
      id: "constituents",
      label: "Constituents",
      href: "/constituents",
      icon: DONOR_ICONS.constituents,
      kind: "core_record" as const,
      description: "Manage donors, volunteers, members, and supporters.",
    },
    {
      id: "donations",
      label: "Donations",
      href: "/donations",
      icon: DONOR_ICONS.donations,
      kind: "core_record" as const,
      description: "Track gifts, giving history, and donation activity.",
    },
    {
      id: "tasks",
      label: "Tasks",
      href: "/tasks",
      icon: DONOR_ICONS.tasks,
      kind: "daily_tool",
      description: "Manage follow-up tasks and stewardship assignments.",
    },
    {
      id: "communications",
      label: "Communications",
      href: "/communications",
      icon: DONOR_ICONS.communications,
      kind: "communication_tool",
      permissions: ["view:communications"],
      description: "Manage email projects, communication activity, and outreach work.",
    },
      ],
    },
    {
      id: "fundraising",
      label: "Fundraising",
      defaultOpen: false,
      collapsible: true,
      items: fundraisingItems,
    },
    {
      id: "outreach",
      label: "Outreach",
      defaultOpen: false,
      collapsible: true,
      items: [
        {
          id: "contacts-manager",
          label: "Contacts Manager",
          href: "/contacts-manager",
          icon: DONOR_ICONS.contactsManager,
          kind: "communication_tool",
          description: "Build reusable audiences and contact lists for email campaigns and printable mailings.",
        },
        {
          id: "letters-printables",
          label: "Letters & Printables",
          href: "/letters-printables",
          icon: DONOR_ICONS.letters,
          kind: "communication_tool",
          permissions: ["letters.view"],
          description: "Create thank-you letters, receipts, newsletters, and printable donor communication.",
        },
        {
          id: "livecom",
          label: "LiveCom",
          href: "/livecom",
          icon: DONOR_ICONS.livecom,
          kind: "communication_tool",
          description: "Manage website chat and live donor communication.",
        },
        {
          id: "meetings",
          label: "Meetings",
          href: "/meetings",
          icon: DONOR_ICONS.meetings,
          kind: "daily_tool",
          description: "Track donor meetings and relationship touchpoints.",
        },
        {
          id: "steward-paths",
          label: "Steward Paths",
          href: "/steward-paths",
          icon: DONOR_ICONS.stewardPaths,
          kind: "workspace",
          permissions: ["steward_paths.view"],
          description: "Build donor engagement sequences and follow-up workflows.",
        },
      ],
    },
    {
      id: "insights",
      label: "Insights & Reports",
      defaultOpen: false,
      collapsible: true,
      items: [
        {
          id: "agent-steward",
          label: "AGENTSteward",
          href: "/steward-ai-workspace",
          icon: DONOR_ICONS.agentSteward,
          kind: "insight",
          badge: "AI",
          description: "Full-page CRM AI assistant with scope selection, thread history, and action workflows.",
        },
        {
          id: "steward-signals",
          label: "Steward Signals",
          href: "/steward-signals",
          icon: DONOR_ICONS.signals,
          kind: "insight",
          description: "Review donor signals, opportunities, and engagement insights.",
        },
        {
          id: "reports",
          label: "Reports",
          href: "/reports/donor-crm",
          icon: DONOR_ICONS.reports,
          kind: "insight",
          description: "Open DonorCRM report tools for giving, retention, stewardship, and campaigns.",
        },
      ],
    },
    {
      id: "people-service",
      label: "People & Service",
      defaultOpen: false,
      collapsible: true,
      items: [
        {
          id: "volunteers",
          label: "Volunteers",
          href: "/volunteers",
          icon: DONOR_ICONS.volunteers,
          kind: "people",
          description: "Manage volunteer relationships and involvement.",
        },
      ],
    },
    {
      id: "system",
      label: "Admin",
      defaultOpen: false,
      collapsible: true,
      items: [
        {
          id: "settings",
          label: "Settings",
          href: "/settings",
          icon: DONOR_ICONS.settings,
          kind: "system",
          description: "Manage donor CRM settings, tools, and workspace configuration.",
        },
        {
          id: "imports",
          label: "Imports",
          href: "/data-tools/import",
          icon: DONOR_ICONS.dataTools,
          kind: "system",
          description: "Import constituents with mapping, validation, and duplicate review.",
        },
        {
          id: "data-tools",
          label: "Data Tools",
          href: "/data-tools",
          icon: DONOR_ICONS.dataTools,
          kind: "system",
          exact: true,
          description: "Run data quality checks, exports, and merge workflows.",
        },
        {
          id: "custom-fields",
          label: "Custom Fields",
          href: "/custom-fields",
          icon: DONOR_ICONS.customFields,
          kind: "system",
          permissions: ["view:custom_fields"],
          description: "Manage organization-specific fields used across donor records.",
        },
        {
          id: "help",
          label: "Help",
          href: "/help?scope=donor&scopePath=/",
          icon: DONOR_ICONS.help,
          kind: "system",
          description: "Open donor CRM help guides and walkthroughs.",
        },
      ],
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
]);

/** Resolves active event ID from pathname and search params for Events CRM sidebar context. */
export function resolveActiveEventId(pathname: string, searchParams: Pick<URLSearchParams, "get">): string | null {
  const explicit = searchParams.get("eventId");
  if (explicit) return explicit;

  const parts = pathname.split("/").filter(Boolean);
  const maybeEventId = parts[1];

  if (!maybeEventId || EVENTS_RESERVED_SEGMENTS.has(maybeEventId)) {
    return null;
  }

  return maybeEventId;
}

function buildEventWorkspaceGroups(eventId: string): CrmSidebarGroup[] {
  const scopeQuery = `?eventId=${encodeURIComponent(eventId)}`;

  return [
    {
      id: "event-workspace",
      label: "Event Workspace",
      defaultOpen: true,
      items: [
        { id: "overview", label: "Overview", href: `/events/${eventId}/overview`, activePath: `/events/${eventId}`, icon: <OyamaGradientIcon name="growth-analytics" />, kind: "workspace", description: "Event-level dashboard and operating summary." },
        { id: "tickets", label: "Tickets", href: `/events/tickets${scopeQuery}`, icon: <OyamaGradientIcon name="donor-gift" />, kind: "core_record", description: "Manage ticket types, pricing, and availability." },
        { id: "orders", label: "Orders", href: `/events/orders${scopeQuery}`, icon: <OyamaGradientIcon name="contact-checklist" />, kind: "core_record", description: "Review order records and payment states." },
        { id: "guests", label: "Guests", href: `/events/guests${scopeQuery}`, icon: <OyamaGradientIcon name="constituent-search" />, kind: "core_record", description: "Track guests, households, and attendance details." },
        { id: "tables", label: "Tables", href: `/events/tables${scopeQuery}`, icon: <OyamaGradientIcon name="relationship-partnership" />, kind: "daily_tool", description: "Manage seating layouts and table assignments." },
        { id: "check-in", label: "Check-In", href: `/events/check-in${scopeQuery}`, icon: <OyamaGradientIcon name="client-profile-sync" />, kind: "daily_tool", description: "Check in guests using search, table, and scan workflows." },
        { id: "sponsors", label: "Sponsors", href: `/events/sponsors${scopeQuery}`, icon: <OyamaGradientIcon name="relationship-partnership" />, kind: "core_record", description: "Manage sponsor packages and fulfillment steps." },
      ],
    },
  ];
}

/** Returns Events CRM sidebar groups including global tools and optional selected-event workspace tools. */
export function buildEventsSidebarGroups(activeEventId: string | null): CrmSidebarGroup[] {
  const baseGroups: CrmSidebarGroup[] = [
    {
      id: "command-center",
      label: "Command Center",
      defaultOpen: true,
      items: [
        { id: "dashboard", label: "Dashboard", href: "/events", icon: <OyamaGradientIcon name="growth-analytics" />, exact: true, kind: "workspace", description: "Events CRM command center and activity snapshot." },
        { id: "events", label: "Events", href: "/events/events", icon: <OyamaGradientIcon name="task-checklist" />, kind: "core_record", description: "Manage event registry and lifecycle." },
        { id: "workspace-selector", label: "Workspace Selector", href: "/events/workspace", icon: <OyamaGradientIcon name="constituent-search" />, kind: "workspace", description: "Choose the event context before opening scoped tools." },
        { id: "setup", label: "Setup", href: "/events/setup", icon: <OyamaGradientIcon name="client-profile-sync" />, kind: "system", description: "Configure global Events CRM defaults." },
      ],
    },
    {
      id: "global-tools",
      label: "Global Tools",
      defaultOpen: false,
      collapsible: true,
      items: [
        { id: "global-reports", label: "Global Reports", href: "/events/reports", icon: <OyamaGradientIcon name="reporting-dashboard" />, kind: "insight", description: "Cross-event reporting and trend analysis." },
        { id: "page-builder", label: "Event Page Builder", href: "/events/page-builder", icon: <OyamaGradientIcon name="growth-analytics" />, kind: "communication_tool", description: "Build hosted event pages and registration flows." },
        { id: "templates", label: "Event Templates", href: "/events/templates", icon: <OyamaGradientIcon name="contact-checklist" />, kind: "system", description: "Manage reusable event templates and defaults." },
        { id: "management", label: "Overall Management", href: "/events/events", icon: <OyamaGradientIcon name="goal-target" />, kind: "system", description: "View and maintain full event inventory." },
        { id: "help", label: "Help", href: "/help?scope=events&scopePath=/events/workspace", icon: DONOR_ICONS.help, kind: "system", description: "Open event-specific documentation and guides." },
      ],
    },
  ];

  if (!activeEventId) {
    return baseGroups;
  }

  return [...baseGroups, ...buildEventWorkspaceGroups(activeEventId)];
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
