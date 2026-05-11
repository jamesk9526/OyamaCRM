// Shared Help App route for CRM-scoped guidance, search, and walkthrough discovery.

import HelpWorkspace from "@/app/components/help/HelpWorkspace";
import { parseHelpScope } from "@/app/help-content";

interface HelpPageProps {
  /** Query parameters used for scope and route-context resolution. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * HelpPage renders the shared Help App with module-scoped defaults and route context support.
 */
export default async function HelpPage({ searchParams }: HelpPageProps) {
  const params = (await searchParams) ?? {};
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const rawScopePath = Array.isArray(params.scopePath) ? params.scopePath[0] : params.scopePath;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;

  const scope = parseHelpScope(rawScope);
  const scopePath = String(rawScopePath ?? "/");
  const initialQuery = String(rawQuery ?? "");

  return <HelpWorkspace scope={scope} scopePath={scopePath} initialQuery={initialQuery} />;
}
