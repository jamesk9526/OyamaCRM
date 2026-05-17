/**
 * Help knowledge catalog used by Steward help-mode retrieval.
 * This keeps help answers grounded in published /help workflows.
 */

export type StewardHelpScope = "donor" | "events" | "compassion" | "global";

export interface StewardHelpGuide {
  slug: string;
  title: string;
  scope: StewardHelpScope;
  summary: string;
  tags: string[];
}

const HELP_GUIDES: StewardHelpGuide[] = [
  { slug: "donor-add-constituent", title: "How To Add A Constituent In Donor CRM", scope: "donor", summary: "Create a constituent profile and verify timeline visibility.", tags: ["donor", "constituent", "profile", "create"] },
  { slug: "donor-import-csv", title: "Import Donor Data From CSV", scope: "donor", summary: "Run upload, mapping, validation, and duplicate review safely.", tags: ["import", "csv", "map", "duplicates"] },
  { slug: "donor-record-donation", title: "Record A Donation In Donor CRM", scope: "donor", summary: "Enter one-time gifts with designation and acknowledgment settings.", tags: ["donation", "gift", "entry", "receipt"] },
  { slug: "donor-recurring-gifts", title: "Set Up Recurring Gifts", scope: "donor", summary: "Configure recurring schedules and monitor payment health.", tags: ["recurring", "gifts", "donation"] },
  { slug: "donor-send-email-campaign", title: "Build And Send A Donor Email Campaign", scope: "donor", summary: "Draft, test, then send or schedule campaigns with compliance checks.", tags: ["email", "campaign", "communications", "send"] },
  { slug: "donor-email-preferences", title: "Manage Donor Email Preferences And Unsubscribes", scope: "donor", summary: "Respect opt-outs and suppression-safe sending rules.", tags: ["email", "preferences", "unsubscribe", "compliance"] },
  { slug: "donor-letters-print-queue", title: "Generate Letters And Manage Print Queue", scope: "donor", summary: "Move letters through review, print, and mail queue steps.", tags: ["letters", "print", "mail", "queue"] },
  { slug: "donor-stewardship-tasks", title: "Create Stewardship Follow-Up Tasks", scope: "donor", summary: "Assign donor follow-up tasks with due dates and ownership.", tags: ["tasks", "stewardship", "follow-up"] },
  { slug: "donor-report-builder", title: "Build A Donor Report And Export Results", scope: "donor", summary: "Build and export fundraising and stewardship reports.", tags: ["reports", "analytics", "export"] },
  { slug: "donor-grants-workspace", title: "Use The Grants Workspace", scope: "donor", summary: "Track grant deadlines, writing, and research tasks.", tags: ["grants", "deadlines", "research", "writing"] },
  { slug: "donor-quickbooks-sync-queue", title: "Queue Donations For QuickBooks Sync", scope: "donor", summary: "Use manual queue review and sync controls for QuickBooks.", tags: ["quickbooks", "queue", "sync", "finance"] },
  { slug: "donor-site-embeds", title: "Configure Site Embeds And Header Code Injection", scope: "donor", summary: "Configure secure embed snippets and allowed domains.", tags: ["embeds", "website", "header", "footer", "livecom"] },
  { slug: "donor-livecom-workspace", title: "Use LiveCom For Website Conversations", scope: "donor", summary: "Handle website conversations and follow-up actions.", tags: ["livecom", "chat", "communications"] },

  { slug: "events-create-event", title: "Create And Activate An Event Workspace", scope: "events", summary: "Create event records and select workspace scope.", tags: ["events", "workspace", "setup"] },
  { slug: "events-register-guests", title: "Register Guests For An Event", scope: "events", summary: "Create guest records and maintain RSVP/payment readiness.", tags: ["events", "guests", "registration", "rsvp"] },
  { slug: "events-table-seating", title: "Manage Tables And Seating Assignments", scope: "events", summary: "Assign seating and monitor capacity constraints.", tags: ["events", "tables", "seating"] },
  { slug: "events-check-in-guide", title: "Run Event Check-In Operations", scope: "events", summary: "Process guest arrivals and attendance status updates.", tags: ["check-in", "guests", "attendance"] },
  { slug: "events-page-builder", title: "Create Event Pages In Events Page Builder", scope: "events", summary: "Build event landing pages and registration messaging.", tags: ["page-builder", "events", "website"] },
  { slug: "events-cross-event-reports", title: "Run Cross-Event Reports", scope: "events", summary: "Compare attendance and revenue across events.", tags: ["events", "reports", "attendance", "revenue"] },

  { slug: "compassion-add-client", title: "Add A Client In Compassion CRM", scope: "compassion", summary: "Create privacy-safe client profiles and intake context.", tags: ["compassion", "clients", "intake"] },
  { slug: "compassion-open-case", title: "Open A New Compassion Case", scope: "compassion", summary: "Create client-scoped cases and track status.", tags: ["compassion", "cases", "workflow"] },
  { slug: "compassion-appointments-workspace", title: "Schedule And Manage Appointments", scope: "compassion", summary: "Create, reschedule, and complete appointments.", tags: ["appointments", "calendar", "schedule"] },
  { slug: "compassion-follow-up-tasks", title: "Manage Compassion Follow-Up Tasks", scope: "compassion", summary: "Assign and complete care follow-up tasks.", tags: ["follow-up", "tasks", "compassion"] },
  { slug: "compassion-client-import", title: "Import Clients Safely", scope: "compassion", summary: "Use validator-backed import with privacy safeguards.", tags: ["import", "clients", "privacy", "validation"] },
  { slug: "compassion-public-scheduling-widget", title: "Configure Public Scheduling Widget", scope: "compassion", summary: "Publish server-validated appointment booking slots.", tags: ["widget", "public", "appointments", "slots"] },

  { slug: "global-getting-started", title: "Get Started With OyamaCRM", scope: "global", summary: "Navigate modules and core workspace patterns.", tags: ["getting-started", "modules", "navigation"] },
  { slug: "global-permissions-and-readiness", title: "Understand Roles, Permissions, And Feature Readiness", scope: "global", summary: "Understand role permissions and readiness labels.", tags: ["permissions", "security", "roles"] },
  { slug: "global-email-provider-setup", title: "Set Up System Email Provider", scope: "global", summary: "Configure SMTP or Microsoft provider and run tests.", tags: ["email", "smtp", "provider", "microsoft"] },
  { slug: "global-microsoft-graph-connect", title: "Connect Microsoft Graph For Outbound Email", scope: "global", summary: "Complete OAuth connection and verify Graph sends.", tags: ["microsoft-graph", "oauth", "email"] },
  { slug: "global-help-search-troubleshooting", title: "Troubleshoot Help Search And Agent Suggestions", scope: "global", summary: "Improve findability using filters and route-scoped terms.", tags: ["help", "search", "troubleshooting"] },
  { slug: "global-steward-help-mode", title: "Use Steward Help Mode With Guide Links", scope: "global", summary: "Ask how-to questions and open linked guides quickly.", tags: ["steward", "help-mode", "guides"] },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function scoreGuide(guide: StewardHelpGuide, query: string): number {
  const q = normalize(query);
  const queryTokens = tokenize(query);
  const title = normalize(guide.title);
  const summary = normalize(guide.summary);
  const tags = normalize(guide.tags.join(" "));

  let score = 0;
  if (!q) return score;
  if (title.includes(q)) score += 12;
  if (summary.includes(q)) score += 8;
  if (tags.includes(q)) score += 9;

  for (const token of queryTokens) {
    if (title.includes(token)) score += 3;
    if (summary.includes(token)) score += 2;
    if (tags.includes(token)) score += 2;
  }

  return score;
}

/**
 * Returns best-matching guides for one scope, always including global guides.
 */
export function searchStewardHelpGuides(args: {
  scope: StewardHelpScope;
  query: string;
  limit?: number;
}): StewardHelpGuide[] {
  const scoped = HELP_GUIDES.filter((guide) => guide.scope === args.scope || guide.scope === "global");
  const query = args.query.trim();

  if (!query) {
    return scoped.slice(0, args.limit ?? 6);
  }

  return scoped
    .map((guide) => ({ guide, score: scoreGuide(guide, query) + (guide.scope === args.scope ? 2 : 1) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, args.limit ?? 6)
    .map((entry) => entry.guide);
}
