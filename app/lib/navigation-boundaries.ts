/** Shared navigation boundary helpers for module routing and role-aware app launch visibility. */

export type TopBarModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview" | "hrm" | "password";

/** Maps pathname values to the owning CRM module key used by TopBar and scoped search. */
export function resolveTopBarModuleKey(pathname: string): TopBarModuleKey {
  if (pathname.startsWith("/compassion")) return "compassion";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/watchdog")) return "watchdog";
  if (pathname.startsWith("/password")) return "password";
  if (pathname.startsWith("/webmaster")) return "webmaster";
  if (pathname.startsWith("/reports")) return "oshareview";
  if (pathname.startsWith("/hrm")) return "hrm";
  return "donor";
}

interface RoleRestrictedApp {
  adminOnly?: boolean;
}

/** Filters app launch tiles by user role while keeping non-restricted tiles visible to all users. */
export function filterAppsForRole<T extends RoleRestrictedApp>(apps: T[], role?: string | null): T[] {
  return apps.filter((app) => !app.adminOnly || role === "admin");
}
