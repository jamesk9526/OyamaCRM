/** Events route boundary helpers for retiring legacy global tool routes safely. */

export type EventWorkspaceTool =
  | "overview"
  | "check-in"
  | "orders"
  | "guests"
  | "tables"
  | "hosts"
  | "tickets"
  | "registration"
  | "sponsors"
  | "fundraising"
  | "donations"
  | "communications"
  | "emails"
  | "reports"
  | "follow-up"
  | "tasks"
  | "volunteers"
  | "files"
  | "settings";

const LEGACY_GLOBAL_TOOL_ROUTE_TO_TOOL: Record<string, EventWorkspaceTool> = {
  "/events/overview": "overview",
  "/events/check-in": "check-in",
  "/events/orders": "orders",
  "/events/guests": "guests",
  "/events/tables": "tables",
  "/events/hosts": "hosts",
  "/events/tickets": "tickets",
  "/events/registration": "registration",
  "/events/sponsors": "sponsors",
  "/events/fundraising": "fundraising",
  "/events/donations": "donations",
  "/events/communications": "communications",
  "/events/emails": "emails",
  "/events/follow-up": "follow-up",
  "/events/tasks": "tasks",
  "/events/volunteers": "volunteers",
  "/events/files": "files",
  "/events/settings": "settings",
};

/** Returns the matching legacy global tool key for a pathname, or null for non-legacy paths. */
export function resolveLegacyGlobalEventsTool(pathname: string): EventWorkspaceTool | null {
  return LEGACY_GLOBAL_TOOL_ROUTE_TO_TOOL[pathname] ?? null;
}

/** Reads first string value from URLSearchParams by key. */
function readQueryValue(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/** Computes a redirect into the unified Events home or a concrete event tab. */
export function resolveLegacyGlobalEventsRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  const tool = resolveLegacyGlobalEventsTool(pathname);
  if (!tool) return null;

  // Preserve old inbound event context when available.
  const eventId = readQueryValue(searchParams, "eventId")
    ?? readQueryValue(searchParams, "event")
    ?? readQueryValue(searchParams, "id");

  if (!eventId) return "/events";
  const segment: Partial<Record<EventWorkspaceTool, string>> = {
    orders: "payments",
    tickets: "registration",
    registration: "registration",
    emails: "communications",
    "check-in": "day",
    hosts: "tables",
    fundraising: "payments",
    donations: "payments",
    "follow-up": "reports",
    tasks: "overview",
    volunteers: "day",
    files: "overview",
  };
  return `/events/${eventId}/${segment[tool] ?? tool}`;
}
