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
  {
    routePrefix: "/data-tools/import",
    crmScope: "donor",
    tags: ["import", "csv", "data-quality"],
    prioritizeSlugs: ["donor-import-csv"],
  },
  {
    routePrefix: "/settings/site-embeds",
    crmScope: "donor",
    tags: ["site-embeds", "livecom", "header-code", "footer-code"],
    prioritizeSlugs: ["donor-site-embeds"],
  },
  {
    routePrefix: "/livecom",
    crmScope: "donor",
    tags: ["livecom", "communications"],
    prioritizeSlugs: ["donor-livecom-workspace"],
  },
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
];

/** Resolves contextual help tags and priorities for the current route path. */
export function getRouteHelpContext(pathname: string): HelpRouteContextRule | null {
  const normalized = pathname.trim().toLowerCase();
  if (!normalized) return null;

  const match = HELP_ROUTE_CONTEXT_RULES.find((rule) => normalized.startsWith(rule.routePrefix));
  return match ?? null;
}
