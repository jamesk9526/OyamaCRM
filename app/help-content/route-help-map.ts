// Route-to-help mappings for contextual suggestions across CRM workspaces.

import type { HelpCrmScope } from "@/app/help-content/types";

/** One contextual route map record used by the Help App suggestion panel. */
export interface HelpRouteContextRule {
  /** Path prefix that activates this contextual mapping. */
  routePrefix: string;
  /** Module scope associated with this route context. */
  crmScope: HelpCrmScope;
  /** Preferred guide tags for this route context. */
  tags: string[];
  /** Optional high-priority article slugs to pin first. */
  prioritizeSlugs?: string[];
}

/** Centralized context rules used for route-aware guide suggestions. */
export const HELP_ROUTE_CONTEXT_RULES: HelpRouteContextRule[] = [
  // Data Tools
  {
    routePrefix: "/data-tools/import",
    crmScope: "donor",
    tags: ["import", "csv", "data-quality"],
    prioritizeSlugs: ["donor-import-csv"],
  },
  {
    routePrefix: "/data-tools",
    crmScope: "donor",
    tags: ["import", "export", "data-quality", "csv"],
    prioritizeSlugs: ["donor-import-csv", "global-data-export"],
  },

  // Settings
  {
    routePrefix: "/settings/site-embeds",
    crmScope: "donor",
    tags: ["site-embeds", "livecom", "header-code", "footer-code"],
    prioritizeSlugs: ["donor-site-embeds"],
  },
  {
    routePrefix: "/settings/organization",
    crmScope: "global",
    tags: ["settings", "smtp", "email", "microsoft-graph"],
    prioritizeSlugs: ["global-email-provider-setup", "global-org-settings"],
  },
  {
    routePrefix: "/settings/plugins",
    crmScope: "global",
    tags: ["quickbooks", "integrations", "settings"],
    prioritizeSlugs: ["donor-quickbooks-sync-queue"],
  },
  {
    routePrefix: "/settings/integrations",
    crmScope: "global",
    tags: ["integrations", "settings", "plugins"],
    prioritizeSlugs: ["donor-quickbooks-sync-queue", "global-system-settings"],
  },
  {
    routePrefix: "/settings/security",
    crmScope: "global",
    tags: ["security", "audit", "permissions"],
    prioritizeSlugs: ["global-permissions-and-readiness", "global-security-privacy"],
  },
  {
    routePrefix: "/settings",
    crmScope: "global",
    tags: ["settings", "organization", "admin"],
    prioritizeSlugs: ["global-system-settings", "global-org-settings"],
  },

  // Donor CRM
  {
    routePrefix: "/livecom",
    crmScope: "donor",
    tags: ["livecom", "communications"],
    prioritizeSlugs: ["donor-livecom-workspace"],
  },
  {
    routePrefix: "/constituents",
    crmScope: "donor",
    tags: ["donor", "constituents", "profile"],
    prioritizeSlugs: ["donor-add-constituent", "donor-view-constituent-profile"],
  },
  {
    routePrefix: "/donations/new",
    crmScope: "donor",
    tags: ["donations", "gift-entry"],
    prioritizeSlugs: ["donor-record-donation"],
  },
  {
    routePrefix: "/donations",
    crmScope: "donor",
    tags: ["donations", "gift-entry", "recurring"],
    prioritizeSlugs: ["donor-record-donation", "donor-recurring-gifts"],
  },
  {
    routePrefix: "/campaigns",
    crmScope: "donor",
    tags: ["campaigns", "fundraising"],
    prioritizeSlugs: ["donor-campaigns"],
  },
  {
    routePrefix: "/communications",
    crmScope: "donor",
    tags: ["communications", "email", "campaign"],
    prioritizeSlugs: ["donor-send-email-campaign", "donor-email-preferences"],
  },
  {
    routePrefix: "/letters-printables",
    crmScope: "donor",
    tags: ["letters", "printables", "mail", "queue"],
    prioritizeSlugs: ["donor-letters-print-queue"],
  },
  {
    routePrefix: "/tasks",
    crmScope: "donor",
    tags: ["tasks", "stewardship", "follow-up"],
    prioritizeSlugs: ["donor-stewardship-tasks"],
  },
  {
    routePrefix: "/grants",
    crmScope: "donor",
    tags: ["grants", "deadlines", "writing"],
    prioritizeSlugs: ["donor-grants-workspace"],
  },
  {
    routePrefix: "/reports",
    crmScope: "donor",
    tags: ["reports", "analytics", "export", "retention"],
    prioritizeSlugs: ["donor-report-builder"],
  },
  {
    routePrefix: "/steward-paths",
    crmScope: "donor",
    tags: ["steward", "sequence", "engagement"],
    prioritizeSlugs: ["donor-steward-paths-setup"],
  },
  {
    routePrefix: "/contacts-manager",
    crmScope: "donor",
    tags: ["contacts", "segment", "audience", "list"],
    prioritizeSlugs: ["donor-contacts-manager"],
  },
  {
    routePrefix: "/quickbooks-sync",
    crmScope: "donor",
    tags: ["quickbooks", "integrations", "finance"],
    prioritizeSlugs: ["donor-quickbooks-sync-queue"],
  },
  {
    routePrefix: "/volunteers",
    crmScope: "donor",
    tags: ["volunteers", "events", "tasks"],
    prioritizeSlugs: ["donor-volunteers"],
  },
  {
    routePrefix: "/help-agent",
    crmScope: "global",
    tags: ["help", "agent", "search", "troubleshooting"],
    prioritizeSlugs: ["global-help-search-troubleshooting"],
  },

  // Events CRM
  {
    routePrefix: "/events/tables",
    crmScope: "events",
    tags: ["table-seating", "event-seating", "check-in"],
    prioritizeSlugs: ["events-table-seating"],
  },
  {
    routePrefix: "/events/check-in",
    crmScope: "events",
    tags: ["check-in", "guests", "event-operations"],
    prioritizeSlugs: ["events-check-in-guide"],
  },
  {
    routePrefix: "/events/guests",
    crmScope: "events",
    tags: ["guests", "registration", "rsvp"],
    prioritizeSlugs: ["events-register-guests"],
  },
  {
    routePrefix: "/events/sponsors",
    crmScope: "events",
    tags: ["sponsor", "events", "tables"],
    prioritizeSlugs: ["events-sponsors"],
  },
  {
    routePrefix: "/events/tickets",
    crmScope: "events",
    tags: ["ticket", "events", "registration"],
    prioritizeSlugs: ["events-tickets"],
  },
  {
    routePrefix: "/events/workspace",
    crmScope: "events",
    tags: ["events", "workspace-selector"],
    prioritizeSlugs: ["events-create-event"],
  },
  {
    routePrefix: "/events/reports",
    crmScope: "events",
    tags: ["events", "reports", "attendance"],
    prioritizeSlugs: ["events-cross-event-reports"],
  },
  {
    routePrefix: "/events/page-builder",
    crmScope: "events",
    tags: ["events", "page-builder", "website"],
    prioritizeSlugs: ["events-page-builder"],
  },
  {
    routePrefix: "/events",
    crmScope: "events",
    tags: ["events", "workspace-selector", "event-scoped"],
    prioritizeSlugs: ["events-create-event"],
  },

  // Compassion CRM
  {
    routePrefix: "/compassion/appointments",
    crmScope: "compassion",
    tags: ["appointments", "calendar", "rescheduling"],
    prioritizeSlugs: ["compassion-appointments-workspace"],
  },
  {
    routePrefix: "/compassion/import/clients",
    crmScope: "compassion",
    tags: ["import", "clients", "privacy"],
    prioritizeSlugs: ["compassion-client-import"],
  },
  {
    routePrefix: "/compassion/clients",
    crmScope: "compassion",
    tags: ["clients", "intake", "privacy"],
    prioritizeSlugs: ["compassion-add-client"],
  },
  {
    routePrefix: "/compassion/cases",
    crmScope: "compassion",
    tags: ["cases", "case-management", "workflow"],
    prioritizeSlugs: ["compassion-open-case"],
  },
  {
    routePrefix: "/compassion/follow-ups",
    crmScope: "compassion",
    tags: ["follow-ups", "tasks", "case-management"],
    prioritizeSlugs: ["compassion-follow-up-tasks"],
  },
  {
    routePrefix: "/compassion/reports",
    crmScope: "compassion",
    tags: ["reports", "compassion", "analytics"],
    prioritizeSlugs: ["compassion-reports"],
  },
  {
    routePrefix: "/compassion",
    crmScope: "compassion",
    tags: ["compassion", "clients", "intake"],
    prioritizeSlugs: ["compassion-add-client", "compassion-appointments-workspace"],
  },

  // Global
  {
    routePrefix: "/setup",
    crmScope: "global",
    tags: ["getting-started", "setup", "configuration"],
    prioritizeSlugs: ["global-getting-started", "global-setup-wizard"],
  },
  {
    routePrefix: "/webmaster",
    crmScope: "global",
    tags: ["website", "webmaster", "pages"],
    prioritizeSlugs: ["global-webmaster"],
  },
];

/** Resolves contextual help tags and priorities for the current route path. */
export function getRouteHelpContext(pathname: string): HelpRouteContextRule | null {
  const normalized = pathname.trim().toLowerCase();
  if (!normalized) return null;

  const match = HELP_ROUTE_CONTEXT_RULES.find((rule) => normalized.startsWith(rule.routePrefix));
  return match ?? null;
}
