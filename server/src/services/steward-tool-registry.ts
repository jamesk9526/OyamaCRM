/**
 * Steward tool registry enforcing organization scope, permissions, and confirm-first write actions.
 */
import type { PermissionKey } from "../lib/permissions.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  getFiscalYearForDate,
  getFiscalYearRange,
  getFiscalYTDRange,
  getYearRange,
  normalizeFiscalYearStart,
} from "../lib/dateRanges.js";
import {
  getDailyBrief,
  getLapseRisks,
  getOShareviewDonorSummary,
  getProfileDecisionPacket,
  getThankYousNeeded,
  getTopOpportunities,
  getDonorFullProfile,
  getDonationHistory,
  getGiftSummaryByYear,
  getActiveCampaigns,
  getOverdueTasks,
  fmtDate,
  type DonorCommunicationPreferences,
} from "./steward-donor-context.js";

export type StewardToolName =
  | "donor.getDailyBrief"
  | "donor.getThankYousNeeded"
  | "donor.getAcknowledgmentQueue"
  | "donor.getRecurringGivingHealth"
  | "donor.getPledgeAtRisk"
  | "donor.getLapseRisks"
  | "donor.getTopOpportunities"
  | "donor.getProfileDecisionPacket"
  | "donor.getCommunicationSnapshot"
  | "donor.getFullProfile"
  | "donor.getDonationHistory"
  | "donor.getGiftSummaryByYear"
  | "campaigns.listActive"
  | "tasks.listOverdue"
  | "reports.getOShareviewDonorSummary"
  | "reports.runSummary"
  | "reports.runTotalsSnapshot"
  | "reports.runGivingByMonth"
  | "reports.runDonorRetention"
  | "reports.runLybunt"
  | "reports.runGivingByDesignation"
  | "reports.runGivingByCampaign"
  | "reports.runDonorTiers"
  | "reports.runNewDonors"
  | "reports.runYearOverYear"
  | "knowledge.searchCrmRecords"
  | "knowledge.searchDonorActivities"
  | "knowledge.getDonorsBySegment"
  | "knowledge.searchGrants"
  | "grants.getDeadlineRadar"
  | "communications.listDraftsForReview"
  | "tasks.createFollowUpTask"
  | "tasks.createThankYouTask"
  | "letters.createLetterDraft"
  | "letters.createThankYouLetterDraft"
  | "letters.createAppealLetterDraft"
  | "communications.createEmailDraft"
  | "communications.createThankYouEmailDraft"
  | "communications.createImpactUpdateEmailDraft"
  | "communications.createReEngagementEmailDraft";

export type StewardToolKind = "read" | "write";

export interface StewardToolExecutionContext {
  organizationId: string;
  userId: string;
  role: string;
  moduleKey?: "donor" | "oshareview" | "compassion" | "events" | "watchdog" | "webmaster";
  scopePath?: string;
  requestRoute?: string;
}

export interface StewardToolListItem {
  name: StewardToolName;
  kind: StewardToolKind;
  description: string;
  requiredPermissions: PermissionKey[];
  requiresConfirmation: boolean;
  allowed: boolean;
  missingPermissions: PermissionKey[];
}

export interface StewardToolExecutionResult<T = unknown> {
  tool: StewardToolName;
  kind: StewardToolKind;
  requiresConfirmation: boolean;
  result: T;
  permissionsChecked: PermissionKey[];
  scope: {
    organizationId: string;
    userId: string;
    role: string;
    moduleKey: string;
    scopePath: string;
  };
}

interface ToolDefinition {
  name: StewardToolName;
  kind: StewardToolKind;
  description: string;
  requiredPermissions: PermissionKey[];
  requiresConfirmation: boolean;
  allowedModules: Array<"donor" | "oshareview">;
}

interface PermissionSnapshot {
  allowed: Record<PermissionKey, boolean>;
  missing: PermissionKey[];
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "donor.getDailyBrief",
    kind: "read",
    description: "Returns the daily donor brief with key stewardship counts and recent gift context.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getThankYousNeeded",
    kind: "read",
    description: "Returns donors needing thank-you follow-up, with communication preference guidance.",
    requiredPermissions: ["view:constituents", "view:donations", "view:tasks"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getAcknowledgmentQueue",
    kind: "read",
    description: "Returns unresolved gift acknowledgments with timing and receipt-compliance context.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getRecurringGivingHealth",
    kind: "read",
    description: "Returns recurring-giving health metrics, upcoming charges, and missed recurring dates.",
    requiredPermissions: ["view:constituents", "view:donations", "view:reports"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getPledgeAtRisk",
    kind: "read",
    description: "Returns active pledges with unpaid balances and due-date risk scoring.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getLapseRisks",
    kind: "read",
    description: "Returns explainable lapse-risk rows for donor retention monitoring.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getTopOpportunities",
    kind: "read",
    description: "Returns top donor opportunities with explainable evidence and recommended channels.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getProfileDecisionPacket",
    kind: "read",
    description: "Returns one donor decision packet with signals, score components, and evidence.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getCommunicationSnapshot",
    kind: "read",
    description: "Returns donor communication readiness details: preferences, latest gift context, and open outreach tasks. Requires constituentId.",
    requiredPermissions: ["view:constituents", "view:donations", "view:tasks"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getFullProfile",
    kind: "read",
    description: "Returns the full profile for a single donor: contact info, giving history, open tasks, stewardship signals, and communication preferences. Requires constituentId.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getDonationHistory",
    kind: "read",
    description: "Returns paginated donation history for a specific donor with exact dates, amounts, campaign attribution, and acknowledgment status. Requires constituentId.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "donor.getGiftSummaryByYear",
    kind: "read",
    description: "Returns year-over-year giving totals for a specific donor across the last 6 calendar years. Requires constituentId.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "campaigns.listActive",
    kind: "read",
    description: "Returns all active fundraising campaigns with real-time goal progress, amounts raised, and gift counts.",
    requiredPermissions: ["view:campaigns"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "tasks.listOverdue",
    kind: "read",
    description: "Returns all overdue stewardship tasks ordered by how overdue they are, with donor name and assignee.",
    requiredPermissions: ["view:tasks"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.getOShareviewDonorSummary",
    kind: "read",
    description: "Returns a compact OShareview donor KPI summary for board/report contexts.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "tasks.createFollowUpTask",
    kind: "write",
    description: "Creates one donor follow-up task (confirm-first, audit-friendly).",
    requiredPermissions: ["edit:tasks", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "communications.createEmailDraft",
    kind: "write",
    description: "Creates one email draft only (never auto-send), with preference checks.",
    requiredPermissions: ["edit:communications", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "communications.createThankYouEmailDraft",
    kind: "write",
    description: "Creates a donor thank-you email draft with stewardship-safe defaults (review-first, never auto-send).",
    requiredPermissions: ["edit:communications", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "communications.createImpactUpdateEmailDraft",
    kind: "write",
    description: "Creates an impact-update email draft focused on outcomes and gratitude for the selected donor.",
    requiredPermissions: ["edit:communications", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "communications.createReEngagementEmailDraft",
    kind: "write",
    description: "Creates a re-engagement email draft for lapsed or cooling donors, with respectful stewardship language.",
    requiredPermissions: ["edit:communications", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runSummary",
    kind: "read",
    description: "Runs the org KPI summary report for the current fiscal year: YTD giving, gift count, constituents, active campaigns, pending tasks, grant awards.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runTotalsSnapshot",
    kind: "read",
    description: "Returns weekly total, monthly total, fiscal YTD total, full fiscal-year total, and unique donor counts for Steward reporting.",
    requiredPermissions: ["view:reports", "view:donations", "view:constituents"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runGivingByMonth",
    kind: "read",
    description: "Returns monthly giving breakdown for a fiscal or calendar year, with totals per month.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runDonorRetention",
    kind: "read",
    description: "Computes donor retention rate: how many donors from last fiscal year gave again this year.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runLybunt",
    kind: "read",
    description: "Returns LYBUNT donors (gave last year but not yet this year) for re-engagement targeting.",
    requiredPermissions: ["view:reports", "view:donations", "view:constituents"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runGivingByDesignation",
    kind: "read",
    description: "Returns YTD giving totals grouped by fund/designation. Useful for fund breakdowns and allocation questions.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runGivingByCampaign",
    kind: "read",
    description: "Returns per-campaign giving totals with goal progress, gift count, and percent complete. Includes both active and recently ended campaigns.",
    requiredPermissions: ["view:reports", "view:donations", "view:campaigns"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runDonorTiers",
    kind: "read",
    description: "Groups donors into Major Gift (≥$10k lifetime), Mid-Level ($1k–$9.9k), and Annual (<$1k) tiers with counts, total giving, and percentage of revenue per tier.",
    requiredPermissions: ["view:reports", "view:donations", "view:constituents"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runNewDonors",
    kind: "read",
    description: "Returns new donor acquisition counts and revenue per fiscal year for the last 5 fiscal years. Helps identify growth or decline in first-time giving.",
    requiredPermissions: ["view:reports", "view:donations", "view:constituents"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "reports.runYearOverYear",
    kind: "read",
    description: "Compares total giving, gift count, and unique donors across the current and previous 2 fiscal years side by side.",
    requiredPermissions: ["view:reports", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "knowledge.searchCrmRecords",
    kind: "read",
    description: "Searches CRM records (constituents, donations, campaigns) by keyword. Use for grounded context when the user asks about specific people, gifts, or programs.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "knowledge.searchDonorActivities",
    kind: "read",
    description: "Searches donor activity timeline records (notes, calls, emails sent, meetings) by keyword and/or activity type. Use to answer questions about past interactions with donors.",
    requiredPermissions: ["view:constituents"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "knowledge.getDonorsBySegment",
    kind: "read",
    description: "Returns a filtered list of donors by status (active/lapsed/new/major), constituent type, or last-gift recency. Useful for segmentation and targeted outreach questions.",
    requiredPermissions: ["view:constituents", "view:donations"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "knowledge.searchGrants",
    kind: "read",
    description: "Searches grant records by keyword, funder name, status, or program area. Returns grant title, funder, amount, status, and deadline.",
    requiredPermissions: ["grants.view"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "grants.getDeadlineRadar",
    kind: "read",
    description: "Returns upcoming LOI/proposal/reporting grant deadlines, grouped by urgency.",
    requiredPermissions: ["grants.view"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "communications.listDraftsForReview",
    kind: "read",
    description: "Returns recent email campaign drafts that still need human review.",
    requiredPermissions: ["view:communications"],
    requiresConfirmation: false,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "tasks.createThankYouTask",
    kind: "write",
    description: "Creates one thank-you task from a donor or donation context (confirm-first).",
    requiredPermissions: ["edit:tasks", "view:donations", "view:constituents"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "letters.createLetterDraft",
    kind: "write",
    description: "Creates one donor letter template draft only (never send), with review-first defaults.",
    requiredPermissions: ["letters.create", "letters.view"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "letters.createThankYouLetterDraft",
    kind: "write",
    description: "Creates a donor thank-you letter draft with nonprofit stewardship defaults.",
    requiredPermissions: ["letters.create", "letters.view"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
  {
    name: "letters.createAppealLetterDraft",
    kind: "write",
    description: "Creates a donor appeal letter draft with campaign-ready structure and review-first status.",
    requiredPermissions: ["letters.create", "letters.view"],
    requiresConfirmation: true,
    allowedModules: ["donor", "oshareview"],
  },
];

/** Fetches org fiscal year settings and computes current FY context. */
async function getOrgFiscalYear(organizationId: string): Promise<{
  fiscalYearStart: number;
  currentFiscalYear: number;
  ytdRange: { gte: Date; lte: Date };
  fyRange: { gte: Date; lt: Date };
  fyLabel: string;
  calendarYear: number;
}> {
  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { fiscalYearStart: true },
  });
  const fiscalYearStart = normalizeFiscalYearStart(settings?.fiscalYearStart);
  const now = new Date();
  const currentFiscalYear = getFiscalYearForDate(now, fiscalYearStart);
  const ytdRange = getFiscalYTDRange(fiscalYearStart, now);
  const fyRange = getFiscalYearRange(currentFiscalYear, fiscalYearStart);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fyLabel = fiscalYearStart === 1
    ? `FY${currentFiscalYear} (Jan–Dec ${currentFiscalYear})`
    : `FY${currentFiscalYear} (${months[fiscalYearStart - 1]} ${currentFiscalYear - 1}–${months[(fiscalYearStart + 10) % 12]} ${currentFiscalYear})`;
  return { fiscalYearStart, currentFiscalYear, ytdRange, fyRange, fyLabel, calendarYear: now.getFullYear() };
}

function asText(value: unknown, fallback = "", maxLength = 1200): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function asPositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asPriority(value: unknown): "LOW" | "MEDIUM" | "HIGH" {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") return normalized;
  return "MEDIUM";
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function asLetterCategory(value: unknown):
  | "THANK_YOU"
  | "TAX_RECEIPT"
  | "END_OF_YEAR"
  | "NEWSLETTER"
  | "CAMPAIGN"
  | "SPONSOR"
  | "EVENT"
  | "MONTHLY_DONOR"
  | "MAJOR_DONOR"
  | "GENERAL" {
  const normalized = String(value ?? "").toUpperCase();
  const allowed = new Set([
    "THANK_YOU",
    "TAX_RECEIPT",
    "END_OF_YEAR",
    "NEWSLETTER",
    "CAMPAIGN",
    "SPONSOR",
    "EVENT",
    "MONTHLY_DONOR",
    "MAJOR_DONOR",
    "GENERAL",
  ]);
  return allowed.has(normalized)
    ? (normalized as
      | "THANK_YOU"
      | "TAX_RECEIPT"
      | "END_OF_YEAR"
      | "NEWSLETTER"
      | "CAMPAIGN"
      | "SPONSOR"
      | "EVENT"
      | "MONTHLY_DONOR"
      | "MAJOR_DONOR"
      | "GENERAL")
    : "GENERAL";
}

function resolveModule(moduleKey: StewardToolExecutionContext["moduleKey"]): "donor" | "oshareview" {
  return moduleKey === "oshareview" ? "oshareview" : "donor";
}

function getToolDefinition(name: string): ToolDefinition {
  const match = TOOL_DEFINITIONS.find((tool) => tool.name === name);
  if (!match) {
    throw new StewardToolError(404, "TOOL_NOT_FOUND", `Unknown steward tool: ${name}`);
  }
  return match;
}

function communicationBlockReason(preferences: DonorCommunicationPreferences): string | null {
  if (preferences.doNotContact) {
    return "This donor is marked do-not-contact; outbound email draft creation is blocked.";
  }
  if (preferences.doNotEmail || preferences.emailOptOut) {
    return "This donor is marked do-not-email/email-opt-out; use a phone or printed-letter follow-up task instead.";
  }
  return null;
}

/**
 * Standardized tool-layer error carrying HTTP status and machine-readable code.
 */
export class StewardToolError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Returns allowed/missing permission snapshots for one user and one permission list. */
async function evaluatePermissionSnapshot(
  userId: string,
  role: string,
  permissions: PermissionKey[]
): Promise<PermissionSnapshot> {
  const unique = Array.from(new Set(permissions));
  if (unique.length === 0) {
    return {
      allowed: {} as Record<PermissionKey, boolean>,
      missing: [],
    };
  }

  const overrides = await prisma.userPermission.findMany({
    where: {
      userId,
      permission: { in: unique },
    },
    select: {
      permission: true,
      granted: true,
    },
  });

  const overrideMap = new Map(overrides.map((row) => [row.permission, row.granted]));
  const allowed = {} as Record<PermissionKey, boolean>;

  for (const permission of unique) {
    const override = overrideMap.get(permission);
    if (typeof override === "boolean") {
      allowed[permission] = override;
      continue;
    }
    allowed[permission] = hasDefaultPermission(role, permission);
  }

  return {
    allowed,
    missing: unique.filter((permission) => !allowed[permission]),
  };
}

/** Lists Steward tools with permission-aware availability status for the current user. */
export async function listStewardTools(context: StewardToolExecutionContext): Promise<StewardToolListItem[]> {
  const moduleKey = resolveModule(context.moduleKey);

  const permissionUniverse = Array.from(
    new Set(
      TOOL_DEFINITIONS
        .filter((tool) => tool.allowedModules.includes(moduleKey))
        .flatMap((tool) => tool.requiredPermissions)
    )
  );

  const snapshot = await evaluatePermissionSnapshot(context.userId, context.role, permissionUniverse);

  return TOOL_DEFINITIONS
    .filter((tool) => tool.allowedModules.includes(moduleKey))
    .map((tool) => {
      const missing = tool.requiredPermissions.filter((permission) => !snapshot.allowed[permission]);
      return {
        name: tool.name,
        kind: tool.kind,
        description: tool.description,
        requiredPermissions: tool.requiredPermissions,
        requiresConfirmation: tool.requiresConfirmation,
        allowed: missing.length === 0,
        missingPermissions: missing,
      };
    });
}

/**
 * Executes one approved Steward tool.
 * This is the only path Steward should use for donor intelligence and guarded write actions.
 */
export async function executeStewardTool(
  context: StewardToolExecutionContext,
  toolName: string,
  input: Record<string, unknown> | undefined,
  options?: { confirm?: boolean }
): Promise<StewardToolExecutionResult> {
  const definition = getToolDefinition(toolName);
  const moduleKey = resolveModule(context.moduleKey);

  if (!definition.allowedModules.includes(moduleKey)) {
    throw new StewardToolError(403, "MODULE_SCOPE_DENIED", `Tool ${toolName} is not allowed in module ${moduleKey}.`);
  }

  const snapshot = await evaluatePermissionSnapshot(context.userId, context.role, definition.requiredPermissions);
  if (snapshot.missing.length > 0) {
    throw new StewardToolError(
      403,
      "PERMISSION_DENIED",
      `Missing required permission(s): ${snapshot.missing.join(", ")}`
    );
  }

  if (definition.requiresConfirmation && options?.confirm !== true) {
    throw new StewardToolError(
      400,
      "CONFIRMATION_REQUIRED",
      `Tool ${toolName} requires explicit confirmation.`
    );
  }

  let result: unknown;

  switch (toolName) {
    case "donor.getDailyBrief": {
      result = await getDailyBrief(context.organizationId);
      break;
    }

    case "donor.getThankYousNeeded": {
      const limit = asPositiveInt(input?.limit, 30, 1, 200);
      result = await getThankYousNeeded(context.organizationId, { limit });
      break;
    }

    case "donor.getAcknowledgmentQueue": {
      const limit = asPositiveInt(input?.limit, 40, 1, 250);
      const maxAgeDays = asPositiveInt(input?.maxAgeDays, 180, 14, 730);
      const includeAcknowledged = asBoolean(input?.includeAcknowledged, false);
      const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

      const donations = await prisma.donation.findMany({
        where: {
          status: "COMPLETED",
          date: { gte: since },
          constituent: { organizationId: context.organizationId },
          ...(includeAcknowledged ? {} : { acknowledgmentSentAt: null }),
        },
        orderBy: { date: "desc" },
        take: limit,
        select: {
          id: true,
          constituentId: true,
          amount: true,
          date: true,
          taxDeductible: true,
          receiptNumber: true,
          receiptSentAt: true,
          acknowledgmentSentAt: true,
          campaign: { select: { name: true } },
          constituent: {
            select: {
              firstName: true,
              lastName: true,
              doNotEmail: true,
              emailOptOut: true,
              doNotCall: true,
              doNotMail: true,
              doNotContact: true,
            },
          },
        },
      });

      const now = Date.now();
      const queue = donations.map((d) => {
        const amount = Number(d.amount);
        const ageDays = Math.max(0, Math.floor((now - d.date.getTime()) / (1000 * 60 * 60 * 24)));
        const preferences: DonorCommunicationPreferences = {
          doNotEmail: d.constituent.doNotEmail,
          emailOptOut: d.constituent.emailOptOut,
          doNotCall: d.constituent.doNotCall,
          doNotMail: d.constituent.doNotMail,
          doNotContact: d.constituent.doNotContact,
        };
        const preferredChannel = communicationBlockReason(preferences)
          ? (!preferences.doNotMail ? "MAIL" : !preferences.doNotCall ? "PHONE" : "MANAGER_REVIEW")
          : "EMAIL";
        const receiptRequired = amount >= 250;
        const complianceRisk = receiptRequired && !d.receiptNumber ? "HIGH" : ageDays > 14 ? "MEDIUM" : "LOW";

        return {
          donationId: d.id,
          constituentId: d.constituentId,
          donorName: `${d.constituent.firstName} ${d.constituent.lastName}`.trim(),
          amount,
          donationDate: d.date.toISOString().slice(0, 10),
          ageDays,
          campaignName: d.campaign?.name ?? null,
          acknowledged: Boolean(d.acknowledgmentSentAt),
          receiptSent: Boolean(d.receiptSentAt),
          receiptNumber: d.receiptNumber ?? null,
          receiptRequired,
          taxDeductible: d.taxDeductible,
          preferredChannel,
          complianceRisk,
        };
      });

      result = {
        generatedAt: new Date().toISOString(),
        queue,
        totals: {
          total: queue.length,
          pendingAcknowledgments: queue.filter((item) => !item.acknowledged).length,
          pendingReceipts: queue.filter((item) => item.receiptRequired && !item.receiptSent).length,
          highRisk: queue.filter((item) => item.complianceRisk === "HIGH").length,
          overSevenDays: queue.filter((item) => item.ageDays > 7 && !item.acknowledged).length,
        },
      };
      break;
    }

    case "donor.getRecurringGivingHealth": {
      const limit = asPositiveInt(input?.limit, 30, 1, 120);
      const windowDays = asPositiveInt(input?.windowDays, 30, 7, 120);
      const now = new Date();
      const rangeStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const rangeEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

      const recurringDonations = await prisma.donation.findMany({
        where: {
          constituent: { organizationId: context.organizationId },
          isRecurring: true,
          status: "COMPLETED",
          OR: [
            { date: { gte: rangeStart } },
            { nextGiftDate: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) } },
          ],
        },
        orderBy: [{ nextGiftDate: "asc" }, { date: "desc" }],
        take: 600,
        select: {
          id: true,
          constituentId: true,
          amount: true,
          date: true,
          frequency: true,
          nextGiftDate: true,
          constituent: { select: { firstName: true, lastName: true } },
        },
      });

      const byConstituent = new Map<string, typeof recurringDonations[number]>();
      for (const gift of recurringDonations) {
        const existing = byConstituent.get(gift.constituentId);
        if (!existing || gift.date > existing.date) {
          byConstituent.set(gift.constituentId, gift);
        }
      }

      const currentTs = now.getTime();
      const upcomingTs = rangeEnd.getTime();
      const activeProfiles = Array.from(byConstituent.values());
      const upcoming = activeProfiles
        .filter((row) => row.nextGiftDate && row.nextGiftDate.getTime() >= currentTs && row.nextGiftDate.getTime() <= upcomingTs)
        .sort((a, b) => (a.nextGiftDate?.getTime() ?? 0) - (b.nextGiftDate?.getTime() ?? 0))
        .slice(0, limit)
        .map((row) => ({
          constituentId: row.constituentId,
          donorName: `${row.constituent.firstName} ${row.constituent.lastName}`.trim(),
          amount: Number(row.amount),
          frequency: row.frequency ?? "UNKNOWN",
          nextGiftDate: row.nextGiftDate?.toISOString().slice(0, 10) ?? null,
          daysUntilNextGift: row.nextGiftDate ? Math.ceil((row.nextGiftDate.getTime() - currentTs) / (1000 * 60 * 60 * 24)) : null,
        }));

      const missed = activeProfiles
        .filter((row) => row.nextGiftDate && row.nextGiftDate.getTime() < currentTs)
        .sort((a, b) => (a.nextGiftDate?.getTime() ?? 0) - (b.nextGiftDate?.getTime() ?? 0))
        .slice(0, limit)
        .map((row) => ({
          constituentId: row.constituentId,
          donorName: `${row.constituent.firstName} ${row.constituent.lastName}`.trim(),
          amount: Number(row.amount),
          frequency: row.frequency ?? "UNKNOWN",
          lastGiftDate: row.date.toISOString().slice(0, 10),
          nextGiftDate: row.nextGiftDate?.toISOString().slice(0, 10) ?? null,
          daysPastDue: row.nextGiftDate ? Math.max(0, Math.floor((currentTs - row.nextGiftDate.getTime()) / (1000 * 60 * 60 * 24))) : 0,
        }));

      const revenue30 = recurringDonations
        .filter((row) => row.date.getTime() >= currentTs - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, row) => sum + Number(row.amount), 0);

      result = {
        generatedAt: new Date().toISOString(),
        activeRecurringDonors: activeProfiles.length,
        recurringRevenueLast30Days: Math.round(revenue30 * 100) / 100,
        upcomingCount: upcoming.length,
        missedCount: missed.length,
        upcoming,
        missed,
      };
      break;
    }

    case "donor.getPledgeAtRisk": {
      const limit = asPositiveInt(input?.limit, 30, 1, 120);
      const maxDaysAhead = asPositiveInt(input?.maxDaysAhead, 120, 14, 365);
      const now = new Date();
      const horizon = new Date(now.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000);

      const pledges = await prisma.pledge.findMany({
        where: {
          active: true,
          constituent: { organizationId: context.organizationId },
          OR: [{ endDate: { lte: horizon } }, { endDate: null }],
        },
        orderBy: [{ endDate: "asc" }, { updatedAt: "desc" }],
        take: 300,
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          startDate: true,
          endDate: true,
          frequency: true,
          campaign: { select: { name: true } },
          designation: { select: { name: true } },
          constituent: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      const rows = pledges
        .map((p) => {
          const totalAmount = Number(p.totalAmount);
          const paidAmount = Number(p.paidAmount);
          const remainingAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
          const daysToEnd = p.endDate
            ? Math.floor((p.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const risk = daysToEnd == null
            ? (remainingAmount > 0 ? "MEDIUM" : "LOW")
            : (daysToEnd < 0 ? "HIGH" : daysToEnd <= 30 ? "HIGH" : daysToEnd <= 90 ? "MEDIUM" : "LOW");

          return {
            pledgeId: p.id,
            constituentId: p.constituent.id,
            donorName: `${p.constituent.firstName} ${p.constituent.lastName}`.trim(),
            campaignName: p.campaign?.name ?? null,
            designationName: p.designation?.name ?? null,
            totalAmount,
            paidAmount,
            remainingAmount,
            frequency: p.frequency ?? null,
            startDate: p.startDate.toISOString().slice(0, 10),
            endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
            daysToEnd,
            risk,
          };
        })
        .filter((row) => row.remainingAmount > 0)
        .sort((a, b) => {
          const riskRank = (value: string) => value === "HIGH" ? 3 : value === "MEDIUM" ? 2 : 1;
          if (riskRank(a.risk) !== riskRank(b.risk)) return riskRank(b.risk) - riskRank(a.risk);
          if ((a.daysToEnd ?? 99999) !== (b.daysToEnd ?? 99999)) return (a.daysToEnd ?? 99999) - (b.daysToEnd ?? 99999);
          return b.remainingAmount - a.remainingAmount;
        })
        .slice(0, limit);

      result = {
        generatedAt: new Date().toISOString(),
        totalAtRisk: rows.length,
        highRiskCount: rows.filter((row) => row.risk === "HIGH").length,
        rows,
      };
      break;
    }

    case "donor.getLapseRisks": {
      const limit = asPositiveInt(input?.limit, 40, 1, 250);
      const minimumRiskRaw = String(input?.minimumRisk ?? "MEDIUM").toUpperCase();
      const minimumRisk = minimumRiskRaw === "HIGH" || minimumRiskRaw === "CRITICAL"
        ? minimumRiskRaw
        : "MEDIUM";
      result = await getLapseRisks(context.organizationId, {
        limit,
        minimumRisk,
      });
      break;
    }

    case "donor.getTopOpportunities": {
      const limit = asPositiveInt(input?.limit, 25, 1, 150);
      result = await getTopOpportunities(context.organizationId, { limit });
      break;
    }

    case "donor.getProfileDecisionPacket": {
      const constituentId = asText(input?.constituentId, "", 120);
      if (!constituentId) {
        throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      }
      const packet = await getProfileDecisionPacket(context.organizationId, constituentId);
      if (!packet) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent not found for decision packet.");
      }
      result = packet;
      break;
    }

    case "donor.getCommunicationSnapshot": {
      const constituentId = asText(input?.constituentId, "", 120);
      if (!constituentId) {
        throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      }

      const [constituent, recentDonation, openTasks] = await Promise.all([
        prisma.constituent.findFirst({
          where: {
            id: constituentId,
            organizationId: context.organizationId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            doNotEmail: true,
            emailOptOut: true,
            doNotCall: true,
            doNotMail: true,
            doNotContact: true,
            donorStatus: true,
            totalLifetimeGiving: true,
            lastGiftDate: true,
          },
        }),
        prisma.donation.findFirst({
          where: {
            constituentId,
            status: "COMPLETED",
          },
          orderBy: { date: "desc" },
          select: {
            id: true,
            amount: true,
            date: true,
            campaign: { select: { name: true } },
          },
        }),
        prisma.task.findMany({
          where: {
            constituentId,
            status: "PENDING",
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            title: true,
            type: true,
            priority: true,
            dueDate: true,
          },
        }),
      ]);

      if (!constituent) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent not found.");
      }

      const preferences: DonorCommunicationPreferences = {
        doNotEmail: constituent.doNotEmail,
        emailOptOut: constituent.emailOptOut,
        doNotCall: constituent.doNotCall,
        doNotMail: constituent.doNotMail,
        doNotContact: constituent.doNotContact,
      };

      result = {
        generatedAt: new Date().toISOString(),
        constituent: {
          id: constituent.id,
          donorName: `${constituent.firstName} ${constituent.lastName}`.trim(),
          donorStatus: constituent.donorStatus,
          totalLifetimeGiving: Number(constituent.totalLifetimeGiving ?? 0),
          lastGiftDate: constituent.lastGiftDate?.toISOString().slice(0, 10) ?? null,
          primaryEmail: constituent.email,
          primaryPhone: constituent.phone,
        },
        communicationPreferences: preferences,
        blockedReason: communicationBlockReason(preferences),
        recentDonation: recentDonation
          ? {
              donationId: recentDonation.id,
              amount: Number(recentDonation.amount),
              date: recentDonation.date.toISOString().slice(0, 10),
              campaignName: recentDonation.campaign?.name ?? null,
            }
          : null,
        openTasks: openTasks.map((task) => ({
          taskId: task.id,
          title: task.title,
          type: task.type,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
        })),
      };
      break;
    }

    case "reports.getOShareviewDonorSummary": {
      const year = asPositiveInt(input?.year, new Date().getFullYear(), 2000, 2200);
      result = await getOShareviewDonorSummary(context.organizationId, { year });
      break;
    }

    case "tasks.createFollowUpTask": {
      const constituentId = asText(input?.constituentId, "", 120);
      if (!constituentId) {
        throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      }

      const constituent = await prisma.constituent.findFirst({
        where: {
          id: constituentId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!constituent) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent not found.");
      }

      const dueDate = parseDate(input?.dueDateIso) ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const task = await prisma.task.create({
        data: {
          constituentId: constituent.id,
          assigneeId: asText(input?.assigneeId, context.userId, 120) || context.userId,
          createdById: context.userId,
          title: asText(
            input?.title,
            `${constituent.firstName} ${constituent.lastName}: Steward follow-up`,
            220
          ),
          description: asText(
            input?.description,
            "Steward tool-created follow-up task. Confirm outreach channel before contact.",
            4000
          ),
          type: "FOLLOW_UP",
          status: "PENDING",
          priority: asPriority(input?.priority),
          dueDate,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          constituentId: true,
        },
      });

      result = {
        created: true,
        task,
      };
      break;
    }

    case "tasks.createThankYouTask": {
      const donationId = asText(input?.donationId, "", 120);
      const explicitConstituentId = asText(input?.constituentId, "", 120);
      if (!donationId && !explicitConstituentId) {
        throw new StewardToolError(400, "VALIDATION_ERROR", "donationId or constituentId is required.");
      }

      const donation = donationId
        ? await prisma.donation.findFirst({
            where: {
              id: donationId,
              constituent: { organizationId: context.organizationId },
            },
            select: {
              id: true,
              constituentId: true,
              amount: true,
              date: true,
              campaign: { select: { name: true } },
              constituent: { select: { firstName: true, lastName: true } },
            },
          })
        : null;

      const constituentId = donation?.constituentId || explicitConstituentId;
      if (!constituentId) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent could not be resolved for thank-you task.");
      }

      const constituent = await prisma.constituent.findFirst({
        where: { id: constituentId, organizationId: context.organizationId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!constituent) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent not found.");
      }

      const dueDate = parseDate(input?.dueDateIso) ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const amountSnippet = donation ? ` ($${Number(donation.amount).toLocaleString()} gift)` : "";
      const campaignSnippet = donation?.campaign?.name ? ` for ${donation.campaign.name}` : "";
      const titleDefault = `Thank ${constituent.firstName} ${constituent.lastName}${amountSnippet}${campaignSnippet}`.slice(0, 220);

      const task = await prisma.task.create({
        data: {
          constituentId: constituent.id,
          assigneeId: asText(input?.assigneeId, context.userId, 120) || context.userId,
          createdById: context.userId,
          title: asText(input?.title, titleDefault, 220),
          description: asText(
            input?.description,
            donation
              ? `Thank-you task created from donation ${donation.id} on ${donation.date.toISOString().slice(0, 10)}.`
              : "Thank-you stewardship task created by Steward.",
            4000
          ),
          type: "THANK_YOU",
          status: "PENDING",
          priority: asPriority(input?.priority),
          dueDate,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          constituentId: true,
        },
      });

      result = {
        created: true,
        sourceDonationId: donation?.id ?? null,
        task,
      };
      break;
    }

    case "communications.createEmailDraft": {
      const constituentId = asText(input?.constituentId, "", 120);
      if (!constituentId) {
        throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      }

      const constituent = await prisma.constituent.findFirst({
        where: {
          id: constituentId,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          doNotEmail: true,
          emailOptOut: true,
          doNotCall: true,
          doNotMail: true,
          doNotContact: true,
        },
      });

      if (!constituent) {
        throw new StewardToolError(404, "NOT_FOUND", "Constituent not found.");
      }

      const preferences: DonorCommunicationPreferences = {
        doNotEmail: constituent.doNotEmail,
        emailOptOut: constituent.emailOptOut,
        doNotCall: constituent.doNotCall,
        doNotMail: constituent.doNotMail,
        doNotContact: constituent.doNotContact,
      };
      const blockedReason = communicationBlockReason(preferences);
      if (blockedReason) {
        throw new StewardToolError(409, "COMMUNICATION_BLOCKED", blockedReason);
      }

      const [organization, settings] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { name: true },
        }),
        prisma.organizationSettings.findUnique({
          where: { organizationId: context.organizationId },
          select: { smtpFromName: true, smtpFromEmail: true },
        }),
      ]);

      const donorName = `${constituent.firstName} ${constituent.lastName}`.trim();
      const subject = asText(input?.subject, `Stewardship follow-up for ${constituent.firstName}`, 180);
      const previewText = asText(
        input?.previewText,
        "Draft for review. Confirm message before send.",
        220
      );
      const bodyPlainText = asText(
        input?.bodyPlainText,
        `Dear ${constituent.firstName},\n\nThank you for your support. This draft is prepared for review before sending.`,
        12000
      );
      const bodyHtml = asText(
        input?.bodyHtml,
        `<p>Dear ${constituent.firstName},</p><p>Thank you for your support. This draft is prepared for review before sending.</p>`,
        24000
      );

      const campaign = await prisma.emailCampaign.create({
        data: {
          organizationId: context.organizationId,
          name: asText(input?.name, `Steward Draft: ${donorName}`, 180),
          subject,
          previewText,
          fromName: settings?.smtpFromName || organization?.name || "OyamaCRM Steward",
          fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
          replyToEmail: settings?.smtpFromEmail || "support@oyamacrm.org",
          bodyText: bodyPlainText,
          bodyHtml,
          audienceFilter: JSON.stringify({
            source: "steward-tool-registry",
            constituentIds: [constituent.id],
            donorName,
          }),
          status: "DRAFT",
        },
        select: {
          id: true,
          name: true,
          subject: true,
          status: true,
          updatedAt: true,
        },
      });

      result = {
        created: true,
        draft: campaign,
        communicationPreferences: preferences,
      };
      break;
    }

    case "communications.createThankYouEmailDraft": {
      const subject = asText(input?.subject, "Thank you for your generosity", 180);
      const previewText = asText(input?.previewText, "Your support is making a real impact.", 220);
      const bodyPlainText = asText(
        input?.bodyPlainText,
        "Dear {{preferredName}},\n\nThank you for your generous support. Your gift is helping us serve more people with consistency and care.\n\nWith gratitude,\n{{organizationName}}",
        12000
      );
      const bodyHtml = asText(
        input?.bodyHtml,
        "<p>Dear {{preferredName}},</p><p>Thank you for your generous support. Your gift is helping us serve more people with consistency and care.</p><p>With gratitude,<br/>{{organizationName}}</p>",
        24000
      );
      const nested = await executeStewardTool(
        context,
        "communications.createEmailDraft",
        {
          ...input,
          subject,
          previewText,
          bodyPlainText,
          bodyHtml,
          name: asText(input?.name, "Steward Thank-You Draft", 180),
        },
        { confirm: true }
      );
      result = nested.result;
      break;
    }

    case "communications.createImpactUpdateEmailDraft": {
      const subject = asText(input?.subject, "Your support in action this month", 180);
      const previewText = asText(input?.previewText, "A quick update on what your support made possible.", 220);
      const bodyPlainText = asText(
        input?.bodyPlainText,
        "Dear {{preferredName}},\n\nThank you again for standing with us. Here is a short impact update on the outcomes your support helped make possible this month.\n\nWe are grateful for your continued partnership.\n\nWarmly,\n{{organizationName}}",
        12000
      );
      const bodyHtml = asText(
        input?.bodyHtml,
        "<p>Dear {{preferredName}},</p><p>Thank you again for standing with us. Here is a short impact update on the outcomes your support helped make possible this month.</p><p>We are grateful for your continued partnership.</p><p>Warmly,<br/>{{organizationName}}</p>",
        24000
      );
      const nested = await executeStewardTool(
        context,
        "communications.createEmailDraft",
        {
          ...input,
          subject,
          previewText,
          bodyPlainText,
          bodyHtml,
          name: asText(input?.name, "Steward Impact Update Draft", 180),
        },
        { confirm: true }
      );
      result = nested.result;
      break;
    }

    case "communications.createReEngagementEmailDraft": {
      const subject = asText(input?.subject, "We miss you and value your partnership", 180);
      const previewText = asText(input?.previewText, "A quick note and invitation to reconnect.", 220);
      const bodyPlainText = asText(
        input?.bodyPlainText,
        "Dear {{preferredName}},\n\nWe wanted to reach out and thank you for the support you have given in the past. If now is a good time, we would love to reconnect and share what is happening this season.\n\nGratefully,\n{{organizationName}}",
        12000
      );
      const bodyHtml = asText(
        input?.bodyHtml,
        "<p>Dear {{preferredName}},</p><p>We wanted to reach out and thank you for the support you have given in the past. If now is a good time, we would love to reconnect and share what is happening this season.</p><p>Gratefully,<br/>{{organizationName}}</p>",
        24000
      );
      const nested = await executeStewardTool(
        context,
        "communications.createEmailDraft",
        {
          ...input,
          subject,
          previewText,
          bodyPlainText,
          bodyHtml,
          name: asText(input?.name, "Steward Re-Engagement Draft", 180),
        },
        { confirm: true }
      );
      result = nested.result;
      break;
    }

    case "reports.runSummary": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const now = new Date();
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
      const [constituents, ytdDonations, weekDonations, activeCampaigns, pendingTasks, overdueTasks, ytdGrants] = await Promise.all([
        prisma.constituent.count({ where: { organizationId: context.organizationId } }),
        prisma.donation.aggregate({
          where: { status: "COMPLETED", date: fiscal.ytdRange, constituent: { organizationId: context.organizationId } },
          _sum: { amount: true }, _count: true,
        }),
        prisma.donation.aggregate({
          where: { status: "COMPLETED", date: { gte: startOfWeek }, constituent: { organizationId: context.organizationId } },
          _sum: { amount: true }, _count: true,
        }),
        prisma.campaign.count({ where: { organizationId: context.organizationId, active: true } }),
        prisma.task.count({ where: { status: "PENDING", constituent: { organizationId: context.organizationId } } }),
        prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now }, constituent: { organizationId: context.organizationId } } }),
        prisma.grant.aggregate({
          where: { organizationId: context.organizationId, status: "AWARDED", awardedAt: fiscal.ytdRange, amountAwarded: { not: null } },
          _sum: { amountAwarded: true },
        }),
      ]);
      result = {
        fiscalYearLabel: fiscal.fyLabel,
        currentFiscalYear: fiscal.currentFiscalYear,
        ytdRevenue: Number(ytdDonations._sum.amount ?? 0),
        ytdGiftCount: ytdDonations._count,
        ytdGrantAmount: Number(ytdGrants._sum.amountAwarded ?? 0),
        weekRevenue: Number(weekDonations._sum.amount ?? 0),
        weekGiftCount: weekDonations._count,
        totalConstituents: constituents,
        activeCampaigns,
        pendingTasks,
        overdueTasks,
        generatedAt: new Date().toISOString(),
      };
      break;
    }

    case "reports.runTotalsSnapshot": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const now = new Date();
      // Monday-start week for consistent nonprofit operations reporting.
      const weekday = (now.getDay() + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - weekday);
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        weeklyAggregate,
        monthlyAggregate,
        fiscalYtdAggregate,
        fiscalYearAggregate,
        weeklyDonors,
        monthlyDonors,
        fiscalYtdDonors,
        fiscalYearDonors,
      ] = await Promise.all([
        prisma.donation.aggregate({
          where: {
            status: "COMPLETED",
            date: { gte: weekStart, lte: now },
            constituent: { organizationId: context.organizationId },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.donation.aggregate({
          where: {
            status: "COMPLETED",
            date: { gte: monthStart, lte: now },
            constituent: { organizationId: context.organizationId },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.donation.aggregate({
          where: {
            status: "COMPLETED",
            date: fiscal.ytdRange,
            constituent: { organizationId: context.organizationId },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.donation.aggregate({
          where: {
            status: "COMPLETED",
            date: fiscal.fyRange,
            constituent: { organizationId: context.organizationId },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.donation.findMany({
          where: {
            status: "COMPLETED",
            date: { gte: weekStart, lte: now },
            constituent: { organizationId: context.organizationId },
          },
          select: { constituentId: true },
          distinct: ["constituentId"],
        }),
        prisma.donation.findMany({
          where: {
            status: "COMPLETED",
            date: { gte: monthStart, lte: now },
            constituent: { organizationId: context.organizationId },
          },
          select: { constituentId: true },
          distinct: ["constituentId"],
        }),
        prisma.donation.findMany({
          where: {
            status: "COMPLETED",
            date: fiscal.ytdRange,
            constituent: { organizationId: context.organizationId },
          },
          select: { constituentId: true },
          distinct: ["constituentId"],
        }),
        prisma.donation.findMany({
          where: {
            status: "COMPLETED",
            date: fiscal.fyRange,
            constituent: { organizationId: context.organizationId },
          },
          select: { constituentId: true },
          distinct: ["constituentId"],
        }),
      ]);

      result = {
        generatedAt: now.toISOString(),
        fiscalYearLabel: fiscal.fyLabel,
        calendarMonthLabel: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
        windows: {
          weekly: {
            startDate: weekStart.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10),
            amount: Number(weeklyAggregate._sum.amount ?? 0),
            giftCount: weeklyAggregate._count,
            donorTotal: weeklyDonors.length,
          },
          monthly: {
            startDate: monthStart.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10),
            amount: Number(monthlyAggregate._sum.amount ?? 0),
            giftCount: monthlyAggregate._count,
            donorTotal: monthlyDonors.length,
          },
          fiscalYtd: {
            startDate: fiscal.ytdRange.gte.toISOString().slice(0, 10),
            endDate: fiscal.ytdRange.lte.toISOString().slice(0, 10),
            amount: Number(fiscalYtdAggregate._sum.amount ?? 0),
            giftCount: fiscalYtdAggregate._count,
            donorTotal: fiscalYtdDonors.length,
          },
          fiscalFullYear: {
            startDate: fiscal.fyRange.gte.toISOString().slice(0, 10),
            endDate: new Date(fiscal.fyRange.lt.getTime() - 1).toISOString().slice(0, 10),
            amount: Number(fiscalYearAggregate._sum.amount ?? 0),
            giftCount: fiscalYearAggregate._count,
            donorTotal: fiscalYearDonors.length,
          },
        },
      };
      break;
    }

    case "reports.runGivingByMonth": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const targetYear = asPositiveInt(input?.year, fiscal.currentFiscalYear, 2000, 2200);
      const useFiscal = input?.dateBasis !== "calendar";
      const range = useFiscal
        ? getFiscalYearRange(targetYear, fiscal.fiscalYearStart)
        : getYearRange(targetYear);
      const donations = await prisma.donation.findMany({
        where: {
          status: "COMPLETED",
          date: { gte: range.gte, lt: range.lt },
          constituent: { organizationId: context.organizationId },
        },
        select: { amount: true, date: true },
        orderBy: { date: "asc" },
      });
      const byMonth: Record<string, { month: string; amount: number; count: number }> = {};
      for (const d of donations) {
        const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}`;
        const label = d.date.toLocaleString("en-US", { month: "short", year: "numeric" });
        if (!byMonth[key]) byMonth[key] = { month: label, amount: 0, count: 0 };
        byMonth[key].amount += Number(d.amount);
        byMonth[key].count += 1;
      }
      const months = Object.entries(byMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => ({ ...v, amount: Math.round(v.amount * 100) / 100 }));
      result = {
        year: targetYear,
        dateBasis: useFiscal ? "fiscal" : "calendar",
        fiscalYearLabel: fiscal.fyLabel,
        months,
        totals: {
          amount: Math.round(months.reduce((s, m) => s + m.amount, 0) * 100) / 100,
          count: months.reduce((s, m) => s + m.count, 0),
        },
      };
      break;
    }

    case "reports.runDonorRetention": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const lastFiscalYear = fiscal.currentFiscalYear - 1;
      const lastYearRange = getFiscalYearRange(lastFiscalYear, fiscal.fiscalYearStart);
      const [lastYearDonors, thisYearDonors] = await Promise.all([
        prisma.donation.findMany({
          where: { status: "COMPLETED", date: lastYearRange, constituent: { organizationId: context.organizationId } },
          select: { constituentId: true }, distinct: ["constituentId"],
        }),
        prisma.donation.findMany({
          where: { status: "COMPLETED", date: fiscal.ytdRange, constituent: { organizationId: context.organizationId } },
          select: { constituentId: true }, distinct: ["constituentId"],
        }),
      ]);
      const total = lastYearDonors.length;
      const thisYearSet = new Set(thisYearDonors.map((d) => d.constituentId));
      const retained = lastYearDonors.filter((d) => thisYearSet.has(d.constituentId)).length;
      const rate = total > 0 ? Math.round((retained / total) * 1000) / 10 : 0;
      result = {
        fiscalYearLabel: fiscal.fyLabel,
        currentFiscalYear: fiscal.currentFiscalYear,
        lastFiscalYear,
        totalDonorsLastYear: total,
        retainedDonors: retained,
        newDonorsThisYear: thisYearDonors.length - retained,
        retentionRate: rate,
        lostDonors: total - retained,
      };
      break;
    }

    case "reports.runLybunt": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const lastFiscalYear = fiscal.currentFiscalYear - 1;
      const lastYearRange = getFiscalYearRange(lastFiscalYear, fiscal.fiscalYearStart);
      const limit = asPositiveInt(input?.limit, 50, 1, 200);
      const [lastYearDonors, thisYearDonors] = await Promise.all([
        prisma.donation.findMany({
          where: { status: "COMPLETED", date: lastYearRange, constituent: { organizationId: context.organizationId } },
          select: { constituentId: true }, distinct: ["constituentId"],
        }),
        prisma.donation.findMany({
          where: { status: "COMPLETED", date: fiscal.ytdRange, constituent: { organizationId: context.organizationId } },
          select: { constituentId: true }, distinct: ["constituentId"],
        }),
      ]);
      const thisYearSet = new Set(thisYearDonors.map((d) => d.constituentId));
      const lybuntIds = lastYearDonors
        .filter((d) => !thisYearSet.has(d.constituentId))
        .map((d) => d.constituentId)
        .filter((id): id is string => Boolean(id));
      const donors = lybuntIds.length > 0
        ? await prisma.constituent.findMany({
            where: { id: { in: lybuntIds }, organizationId: context.organizationId },
            orderBy: { lastGiftAmount: "desc" },
            take: limit,
            select: {
              id: true, firstName: true, lastName: true, email: true,
              lastGiftDate: true, lastGiftAmount: true, totalLifetimeGiving: true, donorStatus: true,
            },
          })
        : [];
      result = {
        fiscalYearLabel: fiscal.fyLabel,
        currentFiscalYear: fiscal.currentFiscalYear,
        lastFiscalYear,
        totalLybunt: lybuntIds.length,
        donors: donors.map((d) => ({
          id: d.id,
          name: `${d.firstName} ${d.lastName}`.trim(),
          email: d.email,
          lastGiftDate: d.lastGiftDate?.toISOString().slice(0, 10) ?? null,
          lastGiftAmount: Number(d.lastGiftAmount ?? 0),
          lifetimeGiving: Number(d.totalLifetimeGiving ?? 0),
          status: d.donorStatus,
        })),
      };
      break;
    }

    case "reports.runGivingByDesignation": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const targetYear = asPositiveInt(input?.year, fiscal.currentFiscalYear, 2000, 2200);
      const useFiscal = input?.dateBasis !== "calendar";
      const range = useFiscal
        ? getFiscalYearRange(targetYear, fiscal.fiscalYearStart)
        : getYearRange(targetYear);

      // Fetch donations with designation data
      const rows = await prisma.donation.findMany({
        where: {
          status: "COMPLETED",
          date: { gte: range.gte, lt: range.lt },
          constituent: { organizationId: context.organizationId },
        },
        select: {
          amount: true,
          designation: { select: { id: true, name: true } },
        },
      });

      const byDesig: Record<string, { designationId: string; name: string; amount: number; count: number }> = {};
      const undesignated = { amount: 0, count: 0 };
      for (const row of rows) {
        const amt = Number(row.amount);
        if (row.designation) {
          const key = row.designation.id;
          if (!byDesig[key]) byDesig[key] = { designationId: key, name: row.designation.name, amount: 0, count: 0 };
          byDesig[key].amount += amt;
          byDesig[key].count += 1;
        } else {
          undesignated.amount += amt;
          undesignated.count += 1;
        }
      }

      const designations = Object.values(byDesig)
        .sort((a, b) => b.amount - a.amount)
        .map((d) => ({ ...d, amount: Math.round(d.amount * 100) / 100 }));

      const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0);

      result = {
        year: targetYear,
        dateBasis: useFiscal ? "fiscal" : "calendar",
        fiscalYearLabel: fiscal.fyLabel,
        totalAmount: Math.round(totalAmount * 100) / 100,
        designations,
        undesignated: { amount: Math.round(undesignated.amount * 100) / 100, count: undesignated.count },
      };
      break;
    }

    case "reports.runGivingByCampaign": {
      const fiscal = await getOrgFiscalYear(context.organizationId);
      const targetYear = asPositiveInt(input?.year, fiscal.currentFiscalYear, 2000, 2200);
      const useFiscal = input?.dateBasis !== "calendar";
      const range = useFiscal
        ? getFiscalYearRange(targetYear, fiscal.fiscalYearStart)
        : getYearRange(targetYear);

      const campaigns = await prisma.campaign.findMany({
        where: { organizationId: context.organizationId },
        select: {
          id: true,
          name: true,
          goal: true,
          active: true,
          category: true,
          startDate: true,
          endDate: true,
          donations: {
            where: {
              status: "COMPLETED",
              date: { gte: range.gte, lt: range.lt },
            },
            select: { amount: true },
          },
        },
        orderBy: { startDate: "desc" },
        take: 30,
      });

      const campaignResults = campaigns
        .map((c) => {
          const raised = c.donations.reduce((s, d) => s + Number(d.amount), 0);
          const goal = Number(c.goal ?? 0);
          return {
            id: c.id,
            name: c.name,
            category: c.category,
            active: c.active,
            goal,
            raised: Math.round(raised * 100) / 100,
            giftCount: c.donations.length,
            percentComplete: goal > 0 ? Math.round((raised / goal) * 1000) / 10 : null,
            startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
            endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
          };
        })
        .filter((c) => c.giftCount > 0 || c.active)
        .sort((a, b) => b.raised - a.raised);

      result = {
        year: targetYear,
        dateBasis: useFiscal ? "fiscal" : "calendar",
        fiscalYearLabel: fiscal.fyLabel,
        campaigns: campaignResults,
        totalCampaigns: campaignResults.length,
      };
      break;
    }

    case "reports.runDonorTiers": {
      const fiscal = await getOrgFiscalYear(context.organizationId);

      const donors = await prisma.constituent.findMany({
        where: {
          organizationId: context.organizationId,
          totalLifetimeGiving: { gt: 0 },
        },
        select: { id: true, totalLifetimeGiving: true },
      });

      let majorCount = 0, majorRevenue = 0;
      let midCount = 0, midRevenue = 0;
      let annualCount = 0, annualRevenue = 0;

      for (const d of donors) {
        const ltg = Number(d.totalLifetimeGiving ?? 0);
        if (ltg >= 10000) { majorCount++; majorRevenue += ltg; }
        else if (ltg >= 1000) { midCount++; midRevenue += ltg; }
        else { annualCount++; annualRevenue += ltg; }
      }

      const totalRevenue = majorRevenue + midRevenue + annualRevenue;

      result = {
        fiscalYearLabel: fiscal.fyLabel,
        totalDonors: donors.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        tiers: [
          {
            tier: "Major Donor",
            threshold: "≥$10,000 lifetime",
            donorCount: majorCount,
            totalRevenue: Math.round(majorRevenue * 100) / 100,
            percentOfRevenue: totalRevenue > 0 ? Math.round((majorRevenue / totalRevenue) * 1000) / 10 : 0,
          },
          {
            tier: "Mid-Level",
            threshold: "$1,000–$9,999 lifetime",
            donorCount: midCount,
            totalRevenue: Math.round(midRevenue * 100) / 100,
            percentOfRevenue: totalRevenue > 0 ? Math.round((midRevenue / totalRevenue) * 1000) / 10 : 0,
          },
          {
            tier: "Annual Fund",
            threshold: "< $1,000 lifetime",
            donorCount: annualCount,
            totalRevenue: Math.round(annualRevenue * 100) / 100,
            percentOfRevenue: totalRevenue > 0 ? Math.round((annualRevenue / totalRevenue) * 1000) / 10 : 0,
          },
        ],
      };
      break;
    }

    case "reports.runNewDonors": {
      const fiscal = await getOrgFiscalYear(context.organizationId);

      // Build 5 fiscal years of new-donor data
      const years = Array.from({ length: 5 }, (_, i) => fiscal.currentFiscalYear - 4 + i);
      const yearRows = await Promise.all(
        years.map(async (yr) => {
          const range = getFiscalYearRange(yr, fiscal.fiscalYearStart);
          const [newDonors, totalRevenue] = await Promise.all([
            prisma.constituent.count({
              where: {
                organizationId: context.organizationId,
                firstGiftDate: { gte: range.gte, lt: range.lt },
              },
            }),
            prisma.donation.aggregate({
              where: {
                status: "COMPLETED",
                date: { gte: range.gte, lt: range.lt },
                constituent: {
                  organizationId: context.organizationId,
                  firstGiftDate: { gte: range.gte, lt: range.lt },
                },
              },
              _sum: { amount: true },
            }),
          ]);
          return {
            fiscalYear: yr,
            newDonors,
            revenueFromNewDonors: Math.round(Number(totalRevenue._sum.amount ?? 0) * 100) / 100,
          };
        })
      );

      result = {
        fiscalYearLabel: fiscal.fyLabel,
        years: yearRows,
      };
      break;
    }

    case "reports.runYearOverYear": {
      const fiscal = await getOrgFiscalYear(context.organizationId);

      const years = [fiscal.currentFiscalYear - 2, fiscal.currentFiscalYear - 1, fiscal.currentFiscalYear];
      const yearData = await Promise.all(
        years.map(async (yr) => {
          const range = getFiscalYearRange(yr, fiscal.fiscalYearStart);
          const isCurrentYear = yr === fiscal.currentFiscalYear;
          const dateRange = isCurrentYear ? { gte: range.gte, lt: new Date() } : { gte: range.gte, lt: range.lt };

          const [agg, uniqueDonors] = await Promise.all([
            prisma.donation.aggregate({
              where: {
                status: "COMPLETED",
                date: dateRange,
                constituent: { organizationId: context.organizationId },
              },
              _sum: { amount: true },
              _count: true,
            }),
            prisma.donation.findMany({
              where: {
                status: "COMPLETED",
                date: dateRange,
                constituent: { organizationId: context.organizationId },
              },
              select: { constituentId: true },
              distinct: ["constituentId"],
            }),
          ]);

          return {
            fiscalYear: yr,
            isYtd: isCurrentYear,
            totalRevenue: Math.round(Number(agg._sum.amount ?? 0) * 100) / 100,
            giftCount: agg._count,
            uniqueDonors: uniqueDonors.length,
          };
        })
      );

      // Compute YoY changes
      const annotated = yearData.map((yr, i) => {
        if (i === 0) return { ...yr, revenueChange: null, donorChange: null };
        const prev = yearData[i - 1];
        const revenueChange = prev.totalRevenue > 0
          ? Math.round(((yr.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 1000) / 10
          : null;
        const donorChange = prev.uniqueDonors > 0
          ? Math.round(((yr.uniqueDonors - prev.uniqueDonors) / prev.uniqueDonors) * 1000) / 10
          : null;
        return { ...yr, revenueChange, donorChange };
      });

      result = {
        fiscalYearLabel: fiscal.fyLabel,
        years: annotated,
      };
      break;
    }

    case "knowledge.searchCrmRecords": {
      const query = asText(input?.query, "", 200);
      if (!query) throw new StewardToolError(400, "VALIDATION_ERROR", "query is required.");
      const limit = asPositiveInt(input?.limit, 10, 1, 30);
      const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2).slice(0, 4);
      const entityType = asText(input?.entityType, "all", 40);

      const constituents = entityType === "donation" || entityType === "campaign"
        ? []
        : await prisma.constituent.findMany({
            where: {
              organizationId: context.organizationId,
              OR: tokens.flatMap((t) => [
                { firstName: { contains: t } },
                { lastName: { contains: t } },
                { email: { contains: t } },
              ]),
            },
            take: Math.ceil(limit / 2),
            orderBy: { totalLifetimeGiving: "desc" },
            select: {
              id: true, firstName: true, lastName: true, email: true,
              donorStatus: true, totalLifetimeGiving: true, lastGiftDate: true, lastGiftAmount: true,
            },
          });

      const campaigns = entityType === "constituent" || entityType === "donation"
        ? []
        : await prisma.campaign.findMany({
            where: {
              organizationId: context.organizationId,
              OR: tokens.map((t) => ({ name: { contains: t } })),
            },
            take: 5,
            orderBy: { startDate: "desc" },
            select: { id: true, name: true, goal: true, active: true, startDate: true, endDate: true },
          });

      const donations = entityType === "campaign"
        ? []
        : await prisma.donation.findMany({
            where: {
              status: "COMPLETED",
              constituent: {
                organizationId: context.organizationId,
                OR: tokens.flatMap((t) => [
                  { firstName: { contains: t } },
                  { lastName: { contains: t } },
                ]),
              },
            },
            take: Math.ceil(limit / 2),
            orderBy: { date: "desc" },
            select: {
              id: true, amount: true, date: true, notes: true,
              constituent: { select: { firstName: true, lastName: true } },
              campaign: { select: { name: true } },
            },
          });

      result = {
        query,
        constituents: constituents.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          status: c.donorStatus,
          lifetimeGiving: Number(c.totalLifetimeGiving ?? 0),
          lastGiftDate: c.lastGiftDate?.toISOString().slice(0, 10) ?? null,
          lastGiftAmount: Number(c.lastGiftAmount ?? 0),
        })),
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          goal: Number(c.goal ?? 0),
          active: c.active,
          startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
        })),
        recentDonations: donations.map((d) => ({
          id: d.id,
          donorName: `${d.constituent.firstName} ${d.constituent.lastName}`.trim(),
          amount: Number(d.amount),
          date: d.date.toISOString().slice(0, 10),
          campaign: d.campaign?.name ?? null,
          notes: d.notes?.slice(0, 200) ?? null,
        })),
        totalMatches: constituents.length + campaigns.length + donations.length,
      };
      break;
    }

    case "knowledge.searchDonorActivities": {
      const query = asText(input?.query, "", 200);
      if (!query) throw new StewardToolError(400, "VALIDATION_ERROR", "query is required.");
      const limit = asPositiveInt(input?.limit, 20, 1, 60);
      const constituentId = asText(input?.constituentId, "", 120);
      const activityTypeRaw = asText(input?.activityType, "", 40).toUpperCase();
      const validTypes = ["NOTE", "CALL", "EMAIL_SENT", "EMAIL_RECEIVED", "MEETING", "MEETING_SCHEDULED", "MEETING_COMPLETED", "TASK_COMPLETED", "DONATION"];
      const activityTypeFilter = validTypes.includes(activityTypeRaw) ? activityTypeRaw : undefined;

      const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2).slice(0, 5);

      const activities = await prisma.activity.findMany({
        where: {
          ...(activityTypeFilter ? { type: activityTypeFilter as never } : {}),
          constituent: {
            organizationId: context.organizationId,
            ...(constituentId ? { id: constituentId } : {}),
          },
          OR: tokens.map((t) => ({ description: { contains: t } })),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          description: true,
          createdAt: true,
          constituent: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      result = {
        query,
        activities: activities.map((a) => ({
          id: a.id,
          type: a.type,
          description: a.description.slice(0, 400),
          createdAt: a.createdAt.toISOString().slice(0, 10),
          donorName: a.constituent ? `${a.constituent.firstName} ${a.constituent.lastName}`.trim() : null,
          constituentId: a.constituent?.id ?? null,
        })),
        totalMatches: activities.length,
      };
      break;
    }

    case "knowledge.getDonorsBySegment": {
      const limit = asPositiveInt(input?.limit, 40, 1, 200);
      const statusRaw = asText(input?.donorStatus, "", 30).toUpperCase();
      const validStatuses = ["NEW", "ACTIVE", "LAPSED", "MAJOR_DONOR", "DECEASED"];
      const statusFilter = validStatuses.includes(statusRaw) ? statusRaw : undefined;
      const constituentTypeRaw = asText(input?.constituentType, "", 40).toUpperCase();
      const validConstituentTypes = ["DONOR", "VOLUNTEER", "MEMBER", "PROSPECT", "SPONSOR", "BOARD_MEMBER", "FOUNDATION", "ORGANIZATION"];
      const typeFilter = validConstituentTypes.includes(constituentTypeRaw) ? constituentTypeRaw : undefined;
      const lastGiftWithinDays = asPositiveInt(input?.lastGiftWithinDays, 0, 0, 3650);

      const now = new Date();
      const lastGiftAfter = lastGiftWithinDays > 0
        ? new Date(now.getTime() - lastGiftWithinDays * 24 * 60 * 60 * 1000)
        : undefined;

      const constituents = await prisma.constituent.findMany({
        where: {
          organizationId: context.organizationId,
          ...(statusFilter ? { donorStatus: statusFilter as never } : {}),
          ...(typeFilter ? { type: typeFilter as never } : {}),
          ...(lastGiftAfter ? { lastGiftDate: { gte: lastGiftAfter } } : {}),
        },
        orderBy: { totalLifetimeGiving: "desc" },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          type: true,
          donorStatus: true,
          lastGiftDate: true,
          lastGiftAmount: true,
          totalLifetimeGiving: true,
        },
      });

      result = {
        filters: {
          donorStatus: statusFilter ?? null,
          constituentType: typeFilter ?? null,
          lastGiftWithinDays: lastGiftWithinDays > 0 ? lastGiftWithinDays : null,
        },
        total: constituents.length,
        donors: constituents.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          type: c.type,
          status: c.donorStatus,
          lastGiftDate: c.lastGiftDate?.toISOString().slice(0, 10) ?? null,
          lastGiftAmount: Number(c.lastGiftAmount ?? 0),
          lifetimeGiving: Number(c.totalLifetimeGiving ?? 0),
        })),
      };
      break;
    }

    case "knowledge.searchGrants": {
      const query = asText(input?.query, "", 200);
      const limit = asPositiveInt(input?.limit, 20, 1, 60);
      const statusRaw = asText(input?.status, "", 30);

      const tokens = query.length >= 2
        ? query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2).slice(0, 4)
        : [];

      const grants = await prisma.grant.findMany({
        where: {
          organizationId: context.organizationId,
          ...(statusRaw ? { status: statusRaw as never } : {}),
          ...(tokens.length > 0
            ? {
                OR: tokens.flatMap((t) => [
                  { title: { contains: t } },
                  { programArea: { contains: t } },
                  { funder: { name: { contains: t } } },
                ]),
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          programArea: true,
          amountRequested: true,
          amountAwarded: true,
          applicationDeadline: true,
          awardedAt: true,
          funder: { select: { name: true } },
        },
      });

      result = {
        query: query || "(all grants)",
        statusFilter: statusRaw || null,
        grants: grants.map((g) => ({
          id: g.id,
          title: g.title,
          funder: g.funder.name,
          status: g.status,
          programArea: g.programArea ?? null,
          amountRequested: g.amountRequested ? Number(g.amountRequested) : null,
          amountAwarded: g.amountAwarded ? Number(g.amountAwarded) : null,
          applicationDeadline: g.applicationDeadline?.toISOString().slice(0, 10) ?? null,
          awardedAt: g.awardedAt?.toISOString().slice(0, 10) ?? null,
        })),
        totalMatches: grants.length,
      };
      break;
    }

    case "grants.getDeadlineRadar": {
      const limit = asPositiveInt(input?.limit, 30, 1, 120);
      const windowDays = asPositiveInt(input?.windowDays, 120, 14, 365);
      const now = new Date();
      const end = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

      const grants = await prisma.grant.findMany({
        where: {
          organizationId: context.organizationId,
          status: { notIn: ["REJECTED", "WITHDRAWN", "CLOSED"] },
          OR: [
            { loiDeadline: { gte: now, lte: end }, loiSubmittedAt: null },
            { applicationDeadline: { gte: now, lte: end }, submittedAt: null },
            { reportingDeadline: { gte: now, lte: end }, reportingSubmittedAt: null },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          loiDeadline: true,
          loiSubmittedAt: true,
          applicationDeadline: true,
          submittedAt: true,
          reportingDeadline: true,
          reportingSubmittedAt: true,
          funder: { select: { name: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
      });

      const rows = grants.flatMap((g) => {
        const assignee = g.assignee ? `${g.assignee.firstName} ${g.assignee.lastName}`.trim() : null;
        const createEntry = (deadline: Date | null, submitted: Date | null, type: "LOI" | "PROPOSAL" | "REPORTING") => {
          if (!deadline || submitted) return null;
          const daysUntilDue = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const urgency = daysUntilDue <= 14 ? "HIGH" : daysUntilDue <= 45 ? "MEDIUM" : "LOW";
          return {
            grantId: g.id,
            title: g.title,
            funderName: g.funder.name,
            status: g.status,
            deadlineType: type,
            dueDate: deadline.toISOString().slice(0, 10),
            daysUntilDue,
            urgency,
            assignee,
          };
        };

        const entries = [
          createEntry(g.loiDeadline, g.loiSubmittedAt, "LOI"),
          createEntry(g.applicationDeadline, g.submittedAt, "PROPOSAL"),
          createEntry(g.reportingDeadline, g.reportingSubmittedAt, "REPORTING"),
        ];

        return entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);

      result = {
        generatedAt: new Date().toISOString(),
        windowDays,
        totals: {
          total: rows.length,
          highUrgency: rows.filter((row) => row.urgency === "HIGH").length,
          mediumUrgency: rows.filter((row) => row.urgency === "MEDIUM").length,
          lowUrgency: rows.filter((row) => row.urgency === "LOW").length,
        },
        deadlines: rows,
      };
      break;
    }

    case "communications.listDraftsForReview": {
      const limit = asPositiveInt(input?.limit, 25, 1, 100);
      const drafts = await prisma.emailCampaign.findMany({
        where: {
          organizationId: context.organizationId,
          status: "DRAFT",
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          subject: true,
          previewText: true,
          updatedAt: true,
          createdAt: true,
          fromName: true,
          fromEmail: true,
          audienceFilter: true,
        },
      });

      result = {
        generatedAt: new Date().toISOString(),
        totalDrafts: drafts.length,
        drafts: drafts.map((d) => ({
          id: d.id,
          name: d.name,
          subject: d.subject,
          previewText: d.previewText,
          fromName: d.fromName,
          fromEmail: d.fromEmail,
          updatedAt: d.updatedAt.toISOString(),
          ageDays: Math.max(0, Math.floor((Date.now() - d.updatedAt.getTime()) / (1000 * 60 * 60 * 24))),
          audienceFilter: d.audienceFilter,
          deepLink: `/communications/${d.id}`,
          builderLink: `/email-builder?campaign=${encodeURIComponent(d.id)}&returnTo=${encodeURIComponent(`/communications/${d.id}`)}`,
        })),
      };
      break;
    }

    case "letters.createLetterDraft": {
      const name = asText(input?.name, "Steward Letter Draft", 180);
      const printBody = asText(
        input?.printBody,
        "<p>Dear {{preferredName}},</p><p>Thank you for your support. This draft is prepared for review before sending.</p>",
        60000
      );

      const template = await prisma.letterTemplate.create({
        data: {
          organizationId: context.organizationId,
          name,
          category: asLetterCategory(input?.category),
          description: asText(input?.description, "Draft generated by Steward tool workflow.", 4000),
          status: "DRAFT",
          printSubject: asText(input?.printSubject, "Steward Letter Draft", 200) || null,
          printBody,
          emailSubject: asText(input?.emailSubject, "", 200) || null,
          emailBody: asText(input?.emailBody, "", 60000) || null,
          crmScope: "DONOR",
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        },
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          updatedAt: true,
        },
      });

      result = {
        created: true,
        draft: template,
        deepLink: `/letters-printables/templates/${template.id}`,
      };
      break;
    }

    case "letters.createThankYouLetterDraft": {
      const nested = await executeStewardTool(
        context,
        "letters.createLetterDraft",
        {
          ...input,
          category: "THANK_YOU",
          name: asText(input?.name, "Steward Thank-You Letter", 180),
          printSubject: asText(input?.printSubject, "Thank you for your generous support", 200),
          printBody: asText(
            input?.printBody,
            "<p>Dear {{preferredName}},</p><p>Thank you for your generous support and partnership. Your gift is helping us continue this mission with strength and consistency.</p><p>With gratitude,<br/>{{organizationName}}</p>",
            60000
          ),
        },
        { confirm: true }
      );
      result = nested.result;
      break;
    }

    case "letters.createAppealLetterDraft": {
      const nested = await executeStewardTool(
        context,
        "letters.createLetterDraft",
        {
          ...input,
          category: "CAMPAIGN",
          name: asText(input?.name, "Steward Appeal Letter", 180),
          printSubject: asText(input?.printSubject, "Join us in this season of impact", 200),
          printBody: asText(
            input?.printBody,
            "<p>Dear {{preferredName}},</p><p>Because of supporters like you, this mission keeps moving forward. We are writing with an invitation to help meet this season's goal so more families can be served.</p><p>Thank you for considering this appeal and for standing with us.</p><p>Sincerely,<br/>{{organizationName}}</p>",
            60000
          ),
        },
        { confirm: true }
      );
      result = nested.result;
      break;
    }

    case "donor.getFullProfile": {
      const constituentId = asText(input?.constituentId, "", 40);
      if (!constituentId) throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      const profile = await getDonorFullProfile(context.organizationId, constituentId);
      if (!profile) throw new StewardToolError(404, "NOT_FOUND", `Donor not found: ${constituentId}`);
      result = profile;
      break;
    }

    case "donor.getDonationHistory": {
      const constituentId = asText(input?.constituentId, "", 40);
      if (!constituentId) throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      const limit = asPositiveInt(input?.limit, 20, 1, 100);
      result = await getDonationHistory(context.organizationId, constituentId, { limit });
      break;
    }

    case "donor.getGiftSummaryByYear": {
      const constituentId = asText(input?.constituentId, "", 40);
      if (!constituentId) throw new StewardToolError(400, "VALIDATION_ERROR", "constituentId is required.");
      result = await getGiftSummaryByYear(context.organizationId, constituentId);
      break;
    }

    case "campaigns.listActive": {
      result = await getActiveCampaigns(context.organizationId);
      break;
    }

    case "tasks.listOverdue": {
      const limit = asPositiveInt(input?.limit, 25, 1, 100);
      result = await getOverdueTasks(context.organizationId, { limit });
      break;
    }

    default: {
      throw new StewardToolError(404, "TOOL_NOT_FOUND", `Unknown steward tool: ${toolName}`);
    }
  }

  return {
    tool: definition.name,
    kind: definition.kind,
    requiresConfirmation: definition.requiresConfirmation,
    result,
    permissionsChecked: definition.requiredPermissions,
    scope: {
      organizationId: context.organizationId,
      userId: context.userId,
      role: context.role,
      moduleKey,
      scopePath: asText(context.scopePath, "/", 400),
    },
  };
}

function summarizeRecordRow(row: TopOpportunityRow): string {
  return `${row.donorName} (score ${row.opportunityScore}, risk ${row.lapseRisk}, channel ${row.bestChannel})`;
}

type TopOpportunityRow = {
  donorName: string;
  opportunityScore: number;
  lapseRisk: string;
  bestChannel: string;
};

interface DonorRetrievalIntent {
  draftCommunication: boolean;
  helpWorkflow: boolean;
  analysis: boolean;
  reporting: boolean;
  specificLookup: boolean;
  tasks: boolean;
  campaigns: boolean;
  numericComputation: boolean;
  acknowledgments: boolean;
  recurring: boolean;
  pledges: boolean;
  grants: boolean;
  draftQueue: boolean;
}

/** Detects the user's retrieval intent so context loading stays focused and less noisy. */
function detectDonorRetrievalIntent(lowerQuery: string): DonorRetrievalIntent {
  return {
    draftCommunication: /(draft|write|compose|email|letter|message|subject line|thank you note)/i.test(lowerQuery),
    helpWorkflow: /(how do i|how to|steps|where do i|walk me through)/i.test(lowerQuery),
    analysis: /(analy[sz]e|trend|why|risk|retention|opportun|segment|insight|compare)/i.test(lowerQuery),
    reporting: /(report|ytd|revenue|giving|fiscal|kpi|dashboard|month|year)/i.test(lowerQuery),
    specificLookup: /(who is|tell me about|find|search|look up|show me|what do you know about)/i.test(lowerQuery),
    tasks: /(task|follow.up|overdue|behind|pending|assign)/i.test(lowerQuery),
    campaigns: /(campaign|fundrais|goal|progress|raised|appeal)/i.test(lowerQuery),
    numericComputation: /(calculate|calculation|percent|percentage|ratio|difference|delta|average|total|sum|math|formula)/i.test(lowerQuery),
    acknowledgments: /(acknowledg|receipt|substantiat|tax receipt|thank.you queue|quid pro quo|donor advised fund|daf)/i.test(lowerQuery),
    recurring: /(recurring|monthly donor|sustain|sustainer|auto.?gift|subscription gift|churn)/i.test(lowerQuery),
    pledges: /(pledge|installment|commitment|remaining balance|pledged)/i.test(lowerQuery),
    grants: /(grant|loi|proposal deadline|reporting deadline|funder)/i.test(lowerQuery),
    draftQueue: /(draft queue|drafts needing review|unsent drafts|communications drafts|email drafts)/i.test(lowerQuery),
  };
}

/** Builds donor chat context by calling approved read tools instead of ad-hoc route SQL. */
export async function buildDonorToolContextForChat(params: {
  organizationId: string;
  userId: string;
  role: string;
  scopePath: string;
  moduleKey?: "donor" | "oshareview";
  query: string;
  /** IDs of @mentioned donors to load full profiles for. */
  mentionedConstituentIds?: string[];
}): Promise<{ contextText: string; toolsUsed: string[]; recordsUsed: string[] }> {
  const toolsUsed: string[] = [];
  const recordsUsed: string[] = [];
  const lines: string[] = [`Donor scope path: ${params.scopePath}`];

  const context: StewardToolExecutionContext = {
    organizationId: params.organizationId,
    userId: params.userId,
    role: params.role,
    moduleKey: params.moduleKey ?? "donor",
    scopePath: params.scopePath,
    requestRoute: "/api/steward-ai/chat",
  };

  const lower = params.query.toLowerCase();
  const intent = detectDonorRetrievalIntent(lower);

  // Inject fiscal year context so the AI knows the current FY and YTD window
  try {
    const fiscal = await getOrgFiscalYear(params.organizationId);
    lines.push(
      `Fiscal year context: ${fiscal.fyLabel}`,
      `Current fiscal year: FY${fiscal.currentFiscalYear}`,
      `Fiscal YTD start: ${fiscal.ytdRange.gte.toISOString().slice(0, 10)}`,
      `Calendar year: ${fiscal.calendarYear}`
    );
    toolsUsed.push("fiscal.context");
  } catch {
    // Non-fatal: fiscal year context is enhancement only
  }

  const brief = await executeStewardTool(context, "donor.getDailyBrief", undefined);
  toolsUsed.push(brief.tool);
  const briefData = brief.result as Awaited<ReturnType<typeof getDailyBrief>>;

  lines.push(
    `Daily brief generated at ${briefData.generatedAt}`,
    `YTD revenue: $${briefData.summary.ytdRevenue.toLocaleString()}`,
    `YTD gift count: ${briefData.summary.ytdGiftCount}`,
    `Thank-yous needed: ${briefData.summary.thankYousNeeded}`,
    `Lapse-risk donors: ${briefData.summary.lapseRiskDonorCount}`,
    `High opportunity donors: ${briefData.summary.topOpportunityCount}`,
    `Top donors by lifetime giving: ${briefData.topDonors.length}`
  );

  if (!intent.draftCommunication && (intent.analysis || intent.reporting || /top donors?|major donors?/i.test(lower))) {
    for (const donor of briefData.topDonors.slice(0, 5)) {
      const lastGift = donor.lastGiftDate ? fmtDate(donor.lastGiftDate) : "no date on record";
      const record = `${donor.name} — $${donor.lifetimeGiving.toLocaleString()} lifetime, last gift ${lastGift}`;
      lines.push(`- Top donor: ${record}`);
      recordsUsed.push(record);
    }
  }

  if (/thank|gratitude|acknowledg/i.test(lower) || intent.draftCommunication) {
    const thanks = await executeStewardTool(context, "donor.getThankYousNeeded", { limit: 12 });
    toolsUsed.push(thanks.tool);
    const thankRows = thanks.result as Awaited<ReturnType<typeof getThankYousNeeded>>;
    lines.push(`Donors needing thank-you: ${thankRows.length}`);
    for (const row of thankRows.slice(0, 6)) {
      const record = `${row.donorName} — $${row.amount.toLocaleString()} donated on ${fmtDate(row.donationDate)}, suggested channel: ${row.suggestedChannel}`;
      lines.push(`- Thank-you candidate: ${record}`);
      recordsUsed.push(record);
    }
  }

  if (intent.acknowledgments) {
    try {
      const ackResult = await executeStewardTool(context, "donor.getAcknowledgmentQueue", { limit: 12 });
      toolsUsed.push(ackResult.tool);
      const ack = ackResult.result as {
        totals: { total: number; pendingAcknowledgments: number; pendingReceipts: number; highRisk: number; overSevenDays: number };
        queue: Array<{ donorName: string; amount: number; donationDate: string; complianceRisk: string; preferredChannel: string; receiptRequired: boolean }>;
      };

      lines.push(
        `Acknowledgment queue: ${ack.totals.pendingAcknowledgments} pending thank-yous, ${ack.totals.pendingReceipts} pending receipts, ${ack.totals.highRisk} high-risk compliance items.`
      );
      for (const row of ack.queue.slice(0, 5)) {
        const record = `${row.donorName} — $${row.amount.toLocaleString()} on ${fmtDate(row.donationDate)} [risk ${row.complianceRisk}] via ${row.preferredChannel}${row.receiptRequired ? " (receipt-required)" : ""}`;
        lines.push(`- Acknowledgment item: ${record}`);
        recordsUsed.push(record);
      }
    } catch {
      // Non-fatal
    }
  }

  if (/lapse|at risk|retention|lybunt|sybunt|drift/i.test(lower) || intent.analysis) {
    const lapse = await executeStewardTool(context, "donor.getLapseRisks", {
      limit: 12,
      minimumRisk: "MEDIUM",
    });
    toolsUsed.push(lapse.tool);
    const lapseRows = lapse.result as Awaited<ReturnType<typeof getLapseRisks>>;
    lines.push(`Lapse risk rows: ${lapseRows.length}`);
    for (const row of lapseRows.slice(0, 6)) {
      const record = `${row.donorName} (${row.lapseRisk}, overdue ${row.daysOverdue}d)`;
      lines.push(`- Lapse signal: ${record}`);
      recordsUsed.push(record);
    }
  }

  if (/opportun|monthly|next step|best/i.test(lower) || intent.analysis) {
    const opportunities = await executeStewardTool(context, "donor.getTopOpportunities", { limit: 12 });
    toolsUsed.push(opportunities.tool);
    const opportunityRows = opportunities.result as TopOpportunityRow[];
    lines.push(`Top opportunities: ${opportunityRows.length}`);
    for (const row of opportunityRows.slice(0, 6)) {
      const record = summarizeRecordRow(row);
      lines.push(`- Opportunity: ${record}`);
      recordsUsed.push(record);
    }
  }

  if (intent.recurring) {
    try {
      const recurringResult = await executeStewardTool(context, "donor.getRecurringGivingHealth", { limit: 10, windowDays: 45 });
      toolsUsed.push(recurringResult.tool);
      const recurring = recurringResult.result as {
        activeRecurringDonors: number;
        recurringRevenueLast30Days: number;
        upcomingCount: number;
        missedCount: number;
        upcoming: Array<{ donorName: string; amount: number; nextGiftDate: string | null; frequency: string }>;
        missed: Array<{ donorName: string; amount: number; daysPastDue: number; frequency: string }>;
      };

      lines.push(
        `Recurring giving health: ${recurring.activeRecurringDonors} active recurring donors, $${recurring.recurringRevenueLast30Days.toLocaleString()} in last 30 days, ${recurring.upcomingCount} upcoming and ${recurring.missedCount} missed.`
      );
      for (const row of recurring.missed.slice(0, 4)) {
        const record = `${row.donorName} — ${row.frequency} recurring $${row.amount.toLocaleString()} is ${row.daysPastDue} day(s) past due`;
        lines.push(`- Recurring risk: ${record}`);
        recordsUsed.push(record);
      }
      for (const row of recurring.upcoming.slice(0, 3)) {
        const record = `${row.donorName} — next ${row.frequency} gift $${row.amount.toLocaleString()} on ${row.nextGiftDate ?? "unknown"}`;
        lines.push(`- Recurring upcoming: ${record}`);
        recordsUsed.push(record);
      }
    } catch {
      // Non-fatal
    }
  }

  if (intent.pledges) {
    try {
      const pledgeResult = await executeStewardTool(context, "donor.getPledgeAtRisk", { limit: 10, maxDaysAhead: 120 });
      toolsUsed.push(pledgeResult.tool);
      const pledge = pledgeResult.result as {
        totalAtRisk: number;
        highRiskCount: number;
        rows: Array<{ donorName: string; remainingAmount: number; daysToEnd: number | null; risk: string; campaignName: string | null }>;
      };

      lines.push(`Pledge risk: ${pledge.totalAtRisk} active pledges with unpaid balances (${pledge.highRiskCount} high-risk).`);
      for (const row of pledge.rows.slice(0, 5)) {
        const record = `${row.donorName} — $${row.remainingAmount.toLocaleString()} remaining${row.daysToEnd == null ? "" : `, ${row.daysToEnd} day(s) to end`} [${row.risk}]${row.campaignName ? ` (${row.campaignName})` : ""}`;
        lines.push(`- Pledge at-risk: ${record}`);
        recordsUsed.push(record);
      }
    } catch {
      // Non-fatal
    }
  }

  if (params.moduleKey === "oshareview" || /board|oshareview|summary report/i.test(lower)) {
    const summary = await executeStewardTool(context, "reports.getOShareviewDonorSummary", {
      year: new Date().getFullYear(),
    });
    toolsUsed.push(summary.tool);
    const report = summary.result as Awaited<ReturnType<typeof getOShareviewDonorSummary>>;
    lines.push(
      `OShareview summary (${report.year}): revenue $${report.summary.ytdRevenue.toLocaleString()}, retention ${report.summary.donorRetentionRate}%, major gifts ${report.summary.majorGiftCount}`
    );
    recordsUsed.push(`OShareview retention ${report.summary.donorRetentionRate}%`);
  }

  // Report-running tools: triggered by report/metric keywords
  if (/report|ytd|revenue|giving|fiscal|this year|last year|goal|kpi|dashboard/i.test(lower) || intent.reporting || intent.numericComputation) {
    try {
      const summaryResult = await executeStewardTool(context, "reports.runSummary", undefined);
      toolsUsed.push(summaryResult.tool);
      const s = summaryResult.result as {
        fiscalYearLabel: string; ytdRevenue: number; ytdGiftCount: number;
        ytdGrantAmount: number; weekRevenue: number; activeCampaigns: number;
        pendingTasks: number; overdueTasks: number; totalConstituents: number;
      };
      lines.push(
        `KPI report (${s.fiscalYearLabel}): YTD revenue $${s.ytdRevenue.toLocaleString()}, ${s.ytdGiftCount} gifts, ${s.ytdGrantAmount > 0 ? `$${s.ytdGrantAmount.toLocaleString()} grants, ` : ""}${s.activeCampaigns} active campaigns, ${s.totalConstituents} constituents`,
        `Tasks: ${s.pendingTasks} pending (${s.overdueTasks} overdue)`,
        `This week: $${s.weekRevenue.toLocaleString()} raised`
      );
      recordsUsed.push(`KPI: $${s.ytdRevenue.toLocaleString()} YTD (${s.fiscalYearLabel})`);
    } catch {
      // Non-fatal: report tool failure should not break chat
    }
  }

  if (/retention|kept|renew|retained|lapse rate|who gave again/i.test(lower) || intent.analysis || intent.numericComputation) {
    try {
      const retentionResult = await executeStewardTool(context, "reports.runDonorRetention", undefined);
      toolsUsed.push(retentionResult.tool);
      const r = retentionResult.result as {
        fiscalYearLabel: string; retentionRate: number;
        totalDonorsLastYear: number; retainedDonors: number; lostDonors: number; newDonorsThisYear: number;
      };
      lines.push(
        `Donor retention (${r.fiscalYearLabel}): ${r.retentionRate}% — ${r.retainedDonors} of ${r.totalDonorsLastYear} last-year donors gave again, ${r.lostDonors} lapsed, ${r.newDonorsThisYear} new this year`
      );
      recordsUsed.push(`Retention rate: ${r.retentionRate}%`);
    } catch {
      // Non-fatal
    }
  }

  if (/monthly|by month|trend|month.by.month|giving trend/i.test(lower) || intent.reporting) {
    try {
      const monthlyResult = await executeStewardTool(context, "reports.runGivingByMonth", undefined);
      toolsUsed.push(monthlyResult.tool);
      const m = monthlyResult.result as {
        fiscalYearLabel: string; months: Array<{ month: string; amount: number; count: number }>;
        totals: { amount: number; count: number };
      };
      const topMonths = [...m.months].sort((a, b) => b.amount - a.amount).slice(0, 3);
      lines.push(
        `Monthly giving (${m.fiscalYearLabel}): total $${m.totals.amount.toLocaleString()} across ${m.totals.count} gifts`,
        `Top months: ${topMonths.map((mo) => `${mo.month} $${mo.amount.toLocaleString()}`).join(", ")}`
      );
      recordsUsed.push(`Monthly trend: $${m.totals.amount.toLocaleString()} total`);
    } catch {
      // Non-fatal
    }
  }

  if (/lybunt|gave last year|not yet|not this year|re.engag/i.test(lower) || intent.analysis) {
    try {
      const lybuntResult = await executeStewardTool(context, "reports.runLybunt", { limit: 10 });
      toolsUsed.push(lybuntResult.tool);
      const l = lybuntResult.result as {
        fiscalYearLabel: string; totalLybunt: number;
        donors: Array<{ name: string; lastGiftAmount: number; lastGiftDate: string | null }>;
      };
      lines.push(`LYBUNT (${l.fiscalYearLabel}): ${l.totalLybunt} donors gave last year but not yet this year`);
      for (const d of l.donors.slice(0, 5)) {
        lines.push(`- LYBUNT: ${d.name} — last gift $${d.lastGiftAmount.toLocaleString()} on ${d.lastGiftDate ? fmtDate(d.lastGiftDate) : "unknown"}`);
        recordsUsed.push(`${d.name} (LYBUNT, $${d.lastGiftAmount.toLocaleString()})`);
      }
    } catch {
      // Non-fatal
    }
  }

  // RAG search: keyword-grounded CRM lookup for specific people, gifts, or campaigns
  if (intent.specificLookup || /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(params.query) || intent.draftCommunication) {
    try {
      const searchResult = await executeStewardTool(context, "knowledge.searchCrmRecords", {
        query: params.query.slice(0, 200),
        limit: 8,
      });
      toolsUsed.push(searchResult.tool);
      const found = searchResult.result as {
        query: string;
        constituents: Array<{ id: string; name: string; email: string | null; lifetimeGiving: number; lastGiftDate: string | null; status: string }>;
        campaigns: Array<{ name: string; goal: number; active: boolean; startDate: string | null }>;
        recentDonations: Array<{ donorName: string; amount: number; date: string; campaign: string | null }>;
        totalMatches: number;
      };
      if (found.constituents.length > 0) {
        lines.push(`CRM search matched ${found.constituents.length} constituent(s):`);
        for (const c of found.constituents) {
          const record = `${c.name} — $${c.lifetimeGiving.toLocaleString()} lifetime, last gift ${c.lastGiftDate ? fmtDate(c.lastGiftDate) : "none"} (${c.status})`;
          lines.push(`- ${record}`);
          recordsUsed.push(record);
        }
      }
      if (found.campaigns.length > 0) {
        lines.push(`Matched campaigns: ${found.campaigns.map((c) => `${c.name}${c.active ? " (active)" : ""}`).join(", ")}`);
      }
      if (found.recentDonations.length > 0) {
        lines.push(`Recent matched donations: ${found.recentDonations.slice(0, 4).map((d) => `${d.donorName} $${d.amount.toLocaleString()} on ${fmtDate(d.date)}`).join(", ")}`);
      }
    } catch {
      // Non-fatal
    }
  }

  // Active campaigns: triggered by campaign/fundraising keywords
  if (intent.campaigns || intent.reporting) {
    try {
      const campaignsResult = await executeStewardTool(context, "campaigns.listActive", undefined);
      toolsUsed.push(campaignsResult.tool);
      const activeCampaigns = campaignsResult.result as Awaited<ReturnType<typeof getActiveCampaigns>>;
      if (activeCampaigns.length > 0) {
        lines.push(`Active campaigns (${activeCampaigns.length}):`);
        for (const c of activeCampaigns.slice(0, 6)) {
          const progressLabel = c.goal > 0
            ? `$${c.raised.toLocaleString()} of $${c.goal.toLocaleString()} goal (${c.progressPercent}%)`
            : `$${c.raised.toLocaleString()} raised (no goal set)`;
          lines.push(`- Campaign "${c.name}": ${progressLabel}, ${c.giftCount} gifts${c.endDate ? `, ends ${c.endDate}` : ""}`);
          recordsUsed.push(`${c.name}: ${progressLabel}`);
        }
      } else {
        lines.push("No active campaigns found.");
      }
    } catch {
      // Non-fatal
    }
  }

  // Overdue tasks: triggered by task/overdue/follow-up keywords
  if (intent.tasks || intent.helpWorkflow || intent.analysis) {
    try {
      const overdueResult = await executeStewardTool(context, "tasks.listOverdue", { limit: 15 });
      toolsUsed.push(overdueResult.tool);
      const overdueTasks = overdueResult.result as Awaited<ReturnType<typeof getOverdueTasks>>;
      if (overdueTasks.length > 0) {
        lines.push(`Overdue tasks (${overdueTasks.length}):`);
        for (const t of overdueTasks.slice(0, 6)) {
          const donorPart = t.donorName ? ` for ${t.donorName}` : "";
          const assigneePart = t.assigneeName ? ` (assigned to ${t.assigneeName})` : "";
          lines.push(`- OVERDUE ${t.daysOverdue}d: "${t.title}"${donorPart} — due ${t.dueDate}${assigneePart} [${t.priority}]`);
          recordsUsed.push(`${t.title}${donorPart} (${t.daysOverdue}d overdue)`);
        }
      } else {
        lines.push("No overdue tasks found.");
      }
    } catch {
      // Non-fatal
    }
  }

  if (intent.grants || /grant deadline|loi|proposal due|reporting due/i.test(lower)) {
    try {
      const grantsResult = await executeStewardTool(context, "grants.getDeadlineRadar", { limit: 15, windowDays: 120 });
      toolsUsed.push(grantsResult.tool);
      const grants = grantsResult.result as {
        totals: { total: number; highUrgency: number; mediumUrgency: number; lowUrgency: number };
        deadlines: Array<{ title: string; funderName: string; deadlineType: string; dueDate: string; daysUntilDue: number; urgency: string; assignee: string | null }>;
      };
      lines.push(
        `Grant deadline radar: ${grants.totals.total} upcoming deadlines (${grants.totals.highUrgency} high urgency).`
      );
      for (const row of grants.deadlines.slice(0, 6)) {
        const record = `${row.title} (${row.funderName}) — ${row.deadlineType} due ${row.dueDate} in ${row.daysUntilDue} day(s) [${row.urgency}]${row.assignee ? ` owner ${row.assignee}` : ""}`;
        lines.push(`- Grant deadline: ${record}`);
        recordsUsed.push(record);
      }
    } catch {
      // Non-fatal
    }
  }

  if (intent.draftQueue || intent.draftCommunication) {
    try {
      const draftsResult = await executeStewardTool(context, "communications.listDraftsForReview", { limit: 10 });
      toolsUsed.push(draftsResult.tool);
      const drafts = draftsResult.result as {
        totalDrafts: number;
        drafts: Array<{ name: string; subject: string; ageDays: number; deepLink: string }>;
      };

      lines.push(`Communication drafts pending review: ${drafts.totalDrafts}.`);
      for (const row of drafts.drafts.slice(0, 5)) {
        const record = `${row.name} — "${row.subject}" (${row.ageDays} day(s) old) [${row.deepLink}]`;
        lines.push(`- Draft review: ${record}`);
        recordsUsed.push(record);
      }
    } catch {
      // Non-fatal
    }
  }

  // Full profile lookup: triggered when a specific constituentId is provided in the scopePath
  const scopeIds = params.scopePath ? (() => {
    const parts = params.scopePath.split("/").filter(Boolean);
    if (parts[0] === "constituents" && parts[1]) return { constituentId: parts[1] };
    return {};
  })() : {};

  if (scopeIds.constituentId) {
    try {
      const profileResult = await executeStewardTool(context, "donor.getFullProfile", {
        constituentId: scopeIds.constituentId,
      });
      toolsUsed.push(profileResult.tool);
      const profile = profileResult.result as Awaited<ReturnType<typeof getDonorFullProfile>>;
      if (profile) {
        lines.push(
          `Focused donor profile: ${profile.name}`,
          `  Status: ${profile.donorStatus}`,
          `  Lifetime giving: $${profile.totalLifetimeGiving.toLocaleString()} across ${profile.giftCount} gifts`,
          `  Last gift: ${profile.lastGiftDate ?? "none"} (amount: $${profile.lastGiftAmount.toLocaleString()})`,
          `  First gift: ${profile.firstGiftDate ?? "none"}`,
          `  Preferred channel: ${profile.signals.bestChannel}`,
          `  Lapse risk: ${profile.signals.lapseRisk}`,
          `  Opportunity score: ${profile.signals.opportunityScore}`,
          `  Open tasks: ${profile.openTasks.length}`
        );
        lines.push(
          `  Communication preference flags: doNotEmail=${profile.communicationPreferences.doNotEmail ? "yes" : "no"}, emailOptOut=${profile.communicationPreferences.emailOptOut ? "yes" : "no"}, doNotCall=${profile.communicationPreferences.doNotCall ? "yes" : "no"}, doNotMail=${profile.communicationPreferences.doNotMail ? "yes" : "no"}, doNotContact=${profile.communicationPreferences.doNotContact ? "yes" : "no"}`
        );
        if (profile.recentDonations.length > 0) {
          lines.push(`  Recent gifts:`);
          for (const d of profile.recentDonations.slice(0, 5)) {
            lines.push(`    - $${d.amount.toLocaleString()} on ${d.date}${d.campaign ? ` (${d.campaign})` : ""}${d.acknowledged ? " [acknowledged]" : " [not yet acknowledged]"}`);
          }
        }
        if (profile.tags.length > 0) {
          lines.push(`  Tags: ${profile.tags.join(", ")}`);
        }
        const describedTags = profile.tagContexts.filter((tag) => tag.description);
        if (describedTags.length > 0) {
          lines.push(`  Tag context: ${describedTags.map((tag) => `${tag.name} means ${tag.description}`).join("; ")}`);
        }
        recordsUsed.push(`${profile.name} — $${profile.totalLifetimeGiving.toLocaleString()} lifetime, last gift ${profile.lastGiftDate ?? "none"}`);
      }
    } catch {
      // Non-fatal
    }
  }

  // Mention-based donor profiles: load full profile for each @mentioned donor
  if (params.mentionedConstituentIds && params.mentionedConstituentIds.length > 0) {
    for (const cid of params.mentionedConstituentIds.slice(0, 3)) {
      try {
        const profileResult = await executeStewardTool(context, "donor.getFullProfile", {
          constituentId: cid,
        });
        toolsUsed.push(profileResult.tool);
        const profile = profileResult.result as Awaited<ReturnType<typeof getDonorFullProfile>>;
        if (profile) {
          lines.push(
            `@Mentioned donor: ${profile.name} [${profile.donorStatus}]`,
            `  Lifetime giving: $${profile.totalLifetimeGiving.toLocaleString()} across ${profile.giftCount} gifts`,
            `  Last gift: ${profile.lastGiftDate ?? "none"} ($${profile.lastGiftAmount.toLocaleString()})`,
            `  First gift: ${profile.firstGiftDate ?? "none"}`,
            `  Preferred channel: ${profile.signals.bestChannel}`,
            `  Lapse risk: ${profile.signals.lapseRisk}, Opportunity score: ${profile.signals.opportunityScore}`,
            `  Best next step: ${profile.signals.bestNextStep}`,
            `  Open tasks: ${profile.openTasks.length}`
          );
          lines.push(
            `  Communication preference flags: doNotEmail=${profile.communicationPreferences.doNotEmail ? "yes" : "no"}, emailOptOut=${profile.communicationPreferences.emailOptOut ? "yes" : "no"}, doNotCall=${profile.communicationPreferences.doNotCall ? "yes" : "no"}, doNotMail=${profile.communicationPreferences.doNotMail ? "yes" : "no"}, doNotContact=${profile.communicationPreferences.doNotContact ? "yes" : "no"}`
          );
          if (profile.recentDonations.length > 0) {
            lines.push(`  Recent gift history:`);
            for (const d of profile.recentDonations.slice(0, 5)) {
              lines.push(`    - $${d.amount.toLocaleString()} on ${d.date}${d.campaign ? ` via ${d.campaign}` : ""}${d.acknowledged ? " ✓ acknowledged" : " (needs acknowledgment)"}`);
            }
          }
          if (profile.openTasks.length > 0) {
            lines.push(`  Open stewardship tasks:`);
            for (const t of profile.openTasks) {
              lines.push(`    - ${t.title} [${t.priority}]${t.dueDate ? ` due ${t.dueDate}` : ""}`);
            }
          }
          const describedTags = profile.tagContexts.filter((tag) => tag.description);
          if (describedTags.length > 0) {
            lines.push(`  Tag context: ${describedTags.map((tag) => `${tag.name} means ${tag.description}`).join("; ")}`);
          }
          recordsUsed.push(`@${profile.name} — $${profile.totalLifetimeGiving.toLocaleString()} lifetime`);
        }
      } catch {
        // Non-fatal: individual profile failure should not break the full context
      }
    }
  }

  if (intent.numericComputation) {
    const revenue = briefData.summary.ytdRevenue;
    const giftCount = Math.max(briefData.summary.ytdGiftCount, 1);
    const avgGift = Math.round((revenue / giftCount) * 100) / 100;
    const thankYouPct = Math.round((briefData.summary.thankYousNeeded / giftCount) * 10000) / 100;

    lines.push(
      "Verified calculations (deterministic):",
      `- Avg gift = YTD revenue / YTD gift count = ${revenue} / ${giftCount} = ${avgGift}`,
      `- Thank-you coverage gap % = thank-yous needed / YTD gift count = ${briefData.summary.thankYousNeeded} / ${giftCount} = ${thankYouPct}%`
    );
    recordsUsed.push(`Verified avg gift: ${avgGift}`);
  }

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed,
  };
}
