// Helpers for resolving Help App scope from route and module context.

import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import type { HelpCrmScope } from "@/app/help-content/types";

/** Converts shared topbar module keys into Help App CRM scopes. */
export function mapModuleKeyToHelpScope(moduleKey: TopBarModuleKey): HelpCrmScope {
  if (moduleKey === "compassion") return "compassion";
  if (moduleKey === "events") return "events";
  if (moduleKey === "password") return "global";
  if (moduleKey === "donor") return "donor";
  if (moduleKey === "hrm") return "global";
  return "global";
}

/** Safely parses a query parameter into a valid Help App scope. */
export function parseHelpScope(raw: string | null | undefined): HelpCrmScope {
  if (raw === "donor") return "donor";
  if (raw === "events") return "events";
  if (raw === "compassion") return "compassion";
  if (raw === "global") return "global";
  return "donor";
}

/** Builds a contextual help URL from module and pathname context. */
export function buildHelpHref(args: { scope: HelpCrmScope; scopePath: string }): string {
  const params = new URLSearchParams();
  params.set("scope", args.scope);
  params.set("scopePath", args.scopePath || "/");
  return `/help?${params.toString()}`;
}
