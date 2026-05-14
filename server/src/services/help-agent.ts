/**
 * Lightweight Help Agent planner for route-aware "how do I" guidance and executable actions.
 */

export type HelpAgentScope = "donor" | "events" | "compassion" | "global";

export interface HelpAgentPlanAction {
  id: string;
  label: string;
  type: "open_route" | "open_help_article" | "open_help_search";
  href: string;
}

export interface HelpAgentPlan {
  summary: string;
  confidence: "high" | "medium" | "low";
  steps: string[];
  actions: HelpAgentPlanAction[];
}

interface HelpRouteItem {
  id: string;
  scope: HelpAgentScope | "all";
  title: string;
  href: string;
  helpSlug?: string;
  keywords: string[];
}

const HELP_ROUTE_CATALOG: HelpRouteItem[] = [
  {
    id: "donor-constituents",
    scope: "donor",
    title: "Constituents",
    href: "/constituents",
    helpSlug: "donor-add-constituent",
    keywords: ["constituent", "donor", "profile", "add person", "create donor"],
  },
  {
    id: "donor-donations",
    scope: "donor",
    title: "Donations",
    href: "/donations",
    keywords: ["donation", "gift", "record gift", "receipt"],
  },
  {
    id: "donor-import",
    scope: "donor",
    title: "Data Tools Import",
    href: "/data-tools/import",
    helpSlug: "donor-import-csv",
    keywords: ["import", "csv", "map fields", "duplicates", "merge"],
  },
  {
    id: "donor-site-embeds",
    scope: "donor",
    title: "Site Embeds",
    href: "/settings/site-embeds",
    helpSlug: "donor-site-embeds",
    keywords: ["embed", "script", "header", "footer", "website"],
  },
  {
    id: "donor-livecom",
    scope: "donor",
    title: "LiveCom Workspace",
    href: "/livecom",
    helpSlug: "donor-livecom-workspace",
    keywords: ["livecom", "chat", "website conversations", "inbox"],
  },
  {
    id: "events-workspace",
    scope: "events",
    title: "Events Workspace Selector",
    href: "/events/workspace",
    helpSlug: "events-create-event",
    keywords: ["event workspace", "select event", "event-first", "workspace"],
  },
  {
    id: "events-checkin",
    scope: "events",
    title: "Events Check-In",
    href: "/events/check-in",
    helpSlug: "events-check-in-guide",
    keywords: ["check in", "guest arrival", "scan qr", "attendance"],
  },
  {
    id: "events-tables",
    scope: "events",
    title: "Events Tables",
    href: "/events/tables",
    helpSlug: "events-table-seating",
    keywords: ["seating", "tables", "assign seat", "capacity"],
  },
  {
    id: "compassion-clients",
    scope: "compassion",
    title: "Compassion Clients",
    href: "/compassion/clients",
    helpSlug: "compassion-add-client",
    keywords: ["client", "intake", "new client", "profile"],
  },
  {
    id: "compassion-appointments",
    scope: "compassion",
    title: "Compassion Appointments",
    href: "/compassion/appointments",
    helpSlug: "compassion-appointments-workspace",
    keywords: ["appointment", "schedule", "calendar", "reschedule"],
  },
  {
    id: "compassion-import",
    scope: "compassion",
    title: "Compassion Client Import",
    href: "/compassion/import/clients",
    helpSlug: "compassion-client-import",
    keywords: ["import", "csv", "client import", "validation"],
  },
  {
    id: "global-help",
    scope: "all",
    title: "Help Home",
    href: "/help",
    helpSlug: "global-getting-started",
    keywords: ["help", "guide", "how to", "learn"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function scoreItem(item: HelpRouteItem, query: string): number {
  const q = normalize(query);
  const queryTokens = tokenize(query);
  const title = normalize(item.title);
  const keyBlob = normalize(item.keywords.join(" "));

  let score = 0;
  if (title.includes(q)) score += 12;
  if (keyBlob.includes(q)) score += 8;

  for (const token of queryTokens) {
    if (title.includes(token)) score += 3;
    if (keyBlob.includes(token)) score += 2;
  }

  return score;
}

function getScopedCatalog(scope: HelpAgentScope): HelpRouteItem[] {
  return HELP_ROUTE_CATALOG.filter((item) => item.scope === "all" || item.scope === scope);
}

function getScopeHelpPath(scope: HelpAgentScope): string {
  if (scope === "events") return "/help?scope=events";
  if (scope === "compassion") return "/help?scope=compassion";
  if (scope === "global") return "/help?scope=global";
  return "/help?scope=donor";
}

export function buildHelpAgentPlan(args: {
  query: string;
  scope: HelpAgentScope;
  scopePath?: string;
}): HelpAgentPlan {
  const query = String(args.query || "").trim();
  const scope = args.scope;
  const scopePath = String(args.scopePath || "/");

  if (!query) {
    return {
      summary: "Ask what you want to accomplish and Help Agent will suggest and run the best route.",
      confidence: "low",
      steps: [
        "Describe your goal in plain language.",
        "Review the suggested route and guide.",
        "Click Run on the action you want.",
      ],
      actions: [
        {
          id: "open-help-home",
          label: "Open Help Home",
          type: "open_help_search",
          href: getScopeHelpPath(scope),
        },
      ],
    };
  }

  const ranked = getScopedCatalog(scope)
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score <= 0) {
    const searchParams = new URLSearchParams();
    searchParams.set("scope", scope);
    searchParams.set("scopePath", scopePath || "/");
    searchParams.set("q", query);

    return {
      summary: "I could not confidently map that to a single route, so I prepared a scoped Help search.",
      confidence: "low",
      steps: [
        "Open scoped Help results.",
        "Pick the best matching guide.",
        "Run the linked route action from the article.",
      ],
      actions: [
        {
          id: "open-help-search",
          label: "Open Scoped Help Search",
          type: "open_help_search",
          href: `/help?${searchParams.toString()}`,
        },
      ],
    };
  }

  const confidence: HelpAgentPlan["confidence"] = best.score >= 18
    ? "high"
    : best.score >= 10
      ? "medium"
      : "low";

  const actions: HelpAgentPlanAction[] = [
    {
      id: `open-route-${best.item.id}`,
      label: `Open ${best.item.title}`,
      type: "open_route",
      href: best.item.href,
    },
  ];

  if (best.item.helpSlug) {
    actions.push({
      id: `open-help-${best.item.helpSlug}`,
      label: "Open Related Help Guide",
      type: "open_help_article",
      href: `/help/${best.item.helpSlug}?scope=${scope}`,
    });
  }

  if (second && second.score > 0) {
    actions.push({
      id: `open-route-${second.item.id}`,
      label: `Alternative: ${second.item.title}`,
      type: "open_route",
      href: second.item.href,
    });
  }

  const summary = confidence === "high"
    ? `I can do this directly by opening ${best.item.title}.`
    : confidence === "medium"
      ? `Best match is ${best.item.title}. I included a backup route too.`
      : "I found a likely route, plus a backup action if your goal differs.";

  return {
    summary,
    confidence,
    steps: [
      `Open ${best.item.title}.`,
      best.item.helpSlug
        ? "Follow the linked guide steps if you need a walkthrough."
        : "Use the page controls to complete your task.",
      "Return to Help Agent if you want the next step automated.",
    ],
    actions,
  };
}
