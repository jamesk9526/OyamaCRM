/**
 * Global scoped search routes.
 *
 * Returns module-scoped search results for tools + records so each CRM
 * only surfaces relevant pages and entities.
 *
 * Route:
 *   GET /api/search?module=donor|compassion|events|watchdog|webmaster|password&q=<query>&limit=<n>
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { donationOrgWhere } from "../lib/donationScope.js";
import { searchWebmasterPages, searchWebmasterSites } from "../services/webmaster-store.js";

const router = Router();

// All global search requests require authentication.
router.use(requireAuth);

type SearchModule = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "password";

type SearchResultType =
  | "tool"
  | "constituent"
  | "campaign"
  | "donation"
  | "client"
  | "case"
  | "event"
  | "guest"
  | "site"
  | "page";

interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  href: string;
  group: "tools" | "records";
}

interface ToolItem {
  id: string;
  label: string;
  href: string;
  keywords: string[];
}

const DONOR_TOOLS: ToolItem[] = [
  { id: "tool-donor-dashboard", label: "Dashboard", href: "/", keywords: ["home", "metrics", "overview"] },
  { id: "tool-donor-constituents", label: "Constituents", href: "/constituents", keywords: ["donors", "people", "profiles"] },
  { id: "tool-donor-donations", label: "Donations", href: "/donations", keywords: ["gifts", "payments", "receipts"] },
  { id: "tool-donor-campaigns", label: "Campaigns", href: "/campaigns", keywords: ["fundraising", "annual fund", "appeals"] },
  { id: "tool-donor-tasks", label: "Tasks", href: "/tasks", keywords: ["todo", "follow up", "reminders"] },
  { id: "tool-donor-steward-paths", label: "Steward Paths", href: "/automations", keywords: ["automation", "workflow", "rules"] },
  { id: "tool-donor-steward-signals", label: "Steward Signals", href: "/steward-signals", keywords: ["opportunity", "signals", "ai"] },
  { id: "tool-donor-reports", label: "Donor Reports", href: "/reports/donor-crm", keywords: ["analytics", "kpi", "export", "donor reports"] },
  { id: "tool-donor-communications", label: "Communications", href: "/communications", keywords: ["email", "newsletter", "outreach"] },
  { id: "tool-donor-data-tools", label: "Data Tools", href: "/data-tools", keywords: ["import", "merge", "dedupe"] },
];

const COMPASSION_TOOLS: ToolItem[] = [
  { id: "tool-compassion-dashboard", label: "Dashboard", href: "/compassion/dashboard", keywords: ["overview", "caseload", "metrics"] },
  { id: "tool-compassion-clients", label: "Clients", href: "/compassion/clients", keywords: ["people", "profiles", "intake"] },
  { id: "tool-compassion-cases", label: "Cases", href: "/compassion/cases", keywords: ["casework", "plans", "status"] },
  { id: "tool-compassion-appointments", label: "Appointments", href: "/compassion/appointments", keywords: ["calendar", "schedule", "visit"] },
  { id: "tool-compassion-assessments", label: "Assessments", href: "/compassion/assessments", keywords: ["evaluation", "intake", "screening"] },
  { id: "tool-compassion-care-plans", label: "Care Plans", href: "/compassion/care-plans", keywords: ["plan", "goals", "care"] },
  { id: "tool-compassion-activities", label: "Activities", href: "/compassion/activities", keywords: ["timeline", "notes", "log"] },
  { id: "tool-compassion-communications", label: "Communications", href: "/compassion/communications", keywords: ["messages", "outreach", "contact"] },
  { id: "tool-compassion-reports", label: "Reports", href: "/compassion/reports", keywords: ["analytics", "insights", "exports"] },
  { id: "tool-compassion-data-tools", label: "Data Tools", href: "/compassion/data-tools", keywords: ["import", "data", "quality"] },
];

const EVENTS_TOOLS: ToolItem[] = [
  { id: "tool-events-dashboard", label: "Events Dashboard", href: "/events", keywords: ["command center", "overview", "kpi"] },
  { id: "tool-events-registry", label: "Events Registry", href: "/events/events", keywords: ["event list", "create event", "manage"] },
  { id: "tool-events-orders", label: "Orders", href: "/events/orders", keywords: ["tickets", "checkout", "payments"] },
  { id: "tool-events-guests", label: "Guests", href: "/events/guests", keywords: ["attendees", "registration", "checkin"] },
  { id: "tool-events-check-in", label: "Check-In", href: "/events/check-in", keywords: ["scan", "arrival", "qr"] },
  { id: "tool-events-tables", label: "Tables", href: "/events/tables", keywords: ["seating", "layout", "assign"] },
  { id: "tool-events-reports", label: "Reports", href: "/events/reports", keywords: ["analytics", "revenue", "attendance"] },
];

const WATCHDOG_TOOLS: ToolItem[] = [
  { id: "tool-watchdog-dashboard", label: "Security Dashboard", href: "/watchdog", keywords: ["security", "alerts", "telemetry"] },
  { id: "tool-watchdog-feed", label: "Security Feed", href: "/watchdog#feed", keywords: ["logs", "audit", "events"] },
  { id: "tool-watchdog-vault", label: "Password Vault", href: "/watchdog#vault", keywords: ["passwords", "credentials", "encrypted"] },
  { id: "tool-watchdog-access", label: "Access Matrix", href: "/watchdog#access", keywords: ["permissions", "admin", "rbac"] },
];

const WEBMASTER_TOOLS: ToolItem[] = [
  { id: "tool-webmaster-dashboard", label: "WebMaster Dashboard", href: "/webmaster", keywords: ["website", "builder", "nonprofit"] },
  { id: "tool-webmaster-templates", label: "Template Planning", href: "/webmaster", keywords: ["templates", "pages", "themes"] },
  { id: "tool-webmaster-publishing", label: "Publishing Workflow", href: "/webmaster", keywords: ["publish", "approval", "domain"] },
];

const PASSWORD_TOOLS: ToolItem[] = [
  { id: "tool-password-home", label: "OyamaPASSWORD Vault", href: "/password", keywords: ["password", "credentials", "vault"] },
  { id: "tool-password-share", label: "Shared Credentials", href: "/password", keywords: ["share", "team", "access"] },
  { id: "tool-password-health", label: "Password Store Health", href: "/password", keywords: ["health", "encryption", "database"] },
];

/**
 * Filters a module's tool list using label + keywords.
 * Returns top matches for the global search dropdown.
 */
function matchTools(tools: ToolItem[], query: string, limit: number): GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  return tools
    .filter((tool) => {
      const haystack = [tool.label, ...tool.keywords].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit)
    .map((tool) => ({
      id: tool.id,
      type: "tool",
      label: tool.label,
      sublabel: "Tool",
      href: tool.href,
      group: "tools",
    }));
}

/**
 * Adds better multi-word matching for name searches such as "jane smith"
 * by checking first/last combinations in both directions.
 */
function buildNamePairClauses(
  firstField: string,
  lastField: string,
  terms: string[]
): Array<Record<string, unknown>> {
  if (terms.length < 2) return [];
  const first = terms[0];
  const second = terms[1];
  return [
    { AND: [{ [firstField]: { contains: first } }, { [lastField]: { contains: second } }] },
    { AND: [{ [firstField]: { contains: second } }, { [lastField]: { contains: first } }] },
  ];
}

/**
 * GET /api/search
 * Returns scoped search results for one module.
 */
router.get("/", async (req, res) => {
  const moduleKey = ((req.query.module as string) || "donor") as SearchModule;
  const query = ((req.query.q as string) || "").trim();
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "6", 10) || 6, 1), 20);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const donorNamePairClauses = buildNamePairClauses("firstName", "lastName", terms);
  const clientNamePairClauses = buildNamePairClauses("firstName", "lastName", terms);
  const guestNamePairClauses = buildNamePairClauses("firstName", "lastName", terms);

  const normalizedModule: SearchModule =
    moduleKey === "compassion"
    || moduleKey === "events"
    || moduleKey === "watchdog"
    || moduleKey === "webmaster"
    || moduleKey === "password"
      ? moduleKey
      : "donor";

  if (!query.trim()) {
    res.json({ module: normalizedModule, query: "", results: [] });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ module: normalizedModule, query, results: [] });
    return;
  }

  const toolLimit = Math.max(3, Math.floor(limit / 2));
  const recordLimit = Math.max(4, limit);
  const searchResults: GlobalSearchResult[] = [];

  if (normalizedModule === "donor") {
    const [tools, constituents, campaigns, donations] = await Promise.all([
      Promise.resolve(matchTools(DONOR_TOOLS, query, toolLimit)),
      prisma.constituent.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            ...donorNamePairClauses,
          ],
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: recordLimit,
        select: { id: true, firstName: true, lastName: true, email: true, donorStatus: true },
      }),
      prisma.campaign.findMany({
        where: {
          organizationId,
          OR: [{ name: { contains: query } }, { description: { contains: query } }],
        },
        orderBy: { createdAt: "desc" },
        take: Math.max(3, Math.floor(recordLimit / 2)),
        select: { id: true, name: true, category: true },
      }),
      prisma.donation.findMany({
        where: {
          AND: [
            donationOrgWhere(organizationId),
            {
              OR: [
                { receiptNumber: { contains: query } },
                { constituent: { firstName: { contains: query } } },
                { constituent: { lastName: { contains: query } } },
                { constituent: { email: { contains: query } } },
                { campaign: { name: { contains: query } } },
              ],
            },
          ],
        },
        orderBy: { date: "desc" },
        take: Math.max(3, Math.floor(recordLimit / 2)),
        include: {
          constituent: { select: { firstName: true, lastName: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);

    searchResults.push(...tools);

    for (const constituent of constituents) {
      searchResults.push({
        id: constituent.id,
        type: "constituent",
        label: `${constituent.firstName} ${constituent.lastName}`,
        sublabel: constituent.email ?? constituent.donorStatus,
        href: `/constituents/${constituent.id}`,
        group: "records",
      });
    }

    for (const campaign of campaigns) {
      searchResults.push({
        id: campaign.id,
        type: "campaign",
        label: campaign.name,
        sublabel: `Campaign • ${campaign.category.replace(/_/g, " ")}`,
        href: "/campaigns",
        group: "records",
      });
    }

    for (const donation of donations) {
      searchResults.push({
        id: donation.id,
        type: "donation",
        label: `Donation $${Number(donation.amount).toLocaleString()}`,
        sublabel: `${donation.constituent.firstName} ${donation.constituent.lastName}${donation.campaign?.name ? ` • ${donation.campaign.name}` : ""}`,
        href: "/donations",
        group: "records",
      });
    }
  }

  if (normalizedModule === "compassion") {
    const [tools, clients, cases] = await Promise.all([
      Promise.resolve(matchTools(COMPASSION_TOOLS, query, toolLimit)),
      prisma.compassionClient.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { preferredName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            ...clientNamePairClauses,
          ],
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: recordLimit,
        select: { id: true, firstName: true, lastName: true, preferredName: true, email: true, clientStatus: true },
      }),
      prisma.compassionCase.findMany({
        where: {
          organizationId,
          OR: [
            { caseNumber: { contains: query } },
            { summary: { contains: query } },
            { client: { firstName: { contains: query } } },
            { client: { lastName: { contains: query } } },
          ],
        },
        orderBy: { openedAt: "desc" },
        take: Math.max(4, Math.floor(recordLimit / 2)),
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    searchResults.push(...tools);

    for (const client of clients) {
      searchResults.push({
        id: client.id,
        type: "client",
        label: `${client.firstName} ${client.lastName}`,
        sublabel: client.email ?? client.preferredName ?? client.clientStatus,
        href: `/compassion/clients/${client.id}`,
        group: "records",
      });
    }

    for (const compassionCase of cases) {
      searchResults.push({
        id: compassionCase.id,
        type: "case",
        label: compassionCase.caseNumber,
        sublabel: `${compassionCase.client.firstName} ${compassionCase.client.lastName} • ${compassionCase.caseStatus.replace(/_/g, " ")}`,
        href: "/compassion/cases",
        group: "records",
      });
    }
  }

  if (normalizedModule === "events") {
    const [tools, events, guests] = await Promise.all([
      Promise.resolve(matchTools(EVENTS_TOOLS, query, toolLimit)),
      prisma.event.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: query } },
            { location: { contains: query } },
            { city: { contains: query } },
          ],
        },
        orderBy: { startDate: "desc" },
        take: recordLimit,
        select: {
          id: true,
          name: true,
          startDate: true,
          status: true,
        },
      }),
      prisma.eventGuest.findMany({
        where: {
          event: { organizationId },
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { checkinCode: { contains: query } },
            { event: { name: { contains: query } } },
            ...guestNamePairClauses,
          ],
        },
        orderBy: { createdAt: "desc" },
        take: Math.max(4, Math.floor(recordLimit / 2)),
        include: {
          event: { select: { id: true, name: true } },
        },
      }),
    ]);

    searchResults.push(...tools);

    for (const event of events) {
      searchResults.push({
        id: event.id,
        type: "event",
        label: event.name,
        sublabel: `${event.status.replace(/_/g, " ")} • ${new Date(event.startDate).toLocaleDateString("en-US")}`,
        href: `/events/${event.id}/overview`,
        group: "records",
      });
    }

    for (const guest of guests) {
      const guestLabel = [guest.firstName, guest.lastName].filter(Boolean).join(" ") || guest.email || "Guest";
      searchResults.push({
        id: guest.id,
        type: "guest",
        label: guestLabel,
        sublabel: `${guest.event.name}${guest.checkinCode ? ` • ${guest.checkinCode}` : ""}`,
        href: `/events/${guest.event.id}/guests`,
        group: "records",
      });
    }
  }

  if (normalizedModule === "watchdog") {
    const tools = matchTools(WATCHDOG_TOOLS, query, Math.max(limit, 6));
    searchResults.push(...tools);
  }

  if (normalizedModule === "webmaster") {
    const [tools, sites, pages] = await Promise.all([
      Promise.resolve(matchTools(WEBMASTER_TOOLS, query, toolLimit)),
      searchWebmasterSites({ organizationId, query, limit: recordLimit }),
      searchWebmasterPages({ organizationId, query, limit: Math.max(4, Math.floor(recordLimit / 2)) }),
    ]);

    searchResults.push(...tools);

    for (const site of sites) {
      searchResults.push({
        id: site.id,
        type: "site",
        label: site.name,
        sublabel: `${site.status.replace(/_/g, " ")} • ${site.slug}`,
        href: `/webmaster?site=${site.id}`,
        group: "records",
      });
    }

    for (const page of pages) {
      searchResults.push({
        id: page.id,
        type: "page",
        label: page.title,
        sublabel: `${page.siteName} • ${page.status.replace(/_/g, " ")} • ${page.path}`,
        href: `/webmaster?site=${page.siteId}&page=${page.id}`,
        group: "records",
      });
    }
  }

  if (normalizedModule === "password") {
    const tools = matchTools(PASSWORD_TOOLS, query, Math.max(limit, 6));
    searchResults.push(...tools);
  }

  // Keep tools first, then records, and cap final payload size.
  const ordered = [
    ...searchResults.filter((item) => item.group === "tools"),
    ...searchResults.filter((item) => item.group === "records"),
  ].slice(0, Math.max(limit * 2, 10));

  res.json({ module: normalizedModule, query, results: ordered });
});

export default router;
