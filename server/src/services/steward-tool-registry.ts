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
  | "donor.getLapseRisks"
  | "donor.getTopOpportunities"
  | "donor.getProfileDecisionPacket"
  | "donor.getFullProfile"
  | "donor.getDonationHistory"
  | "donor.getGiftSummaryByYear"
  | "campaigns.listActive"
  | "tasks.listOverdue"
  | "reports.getOShareviewDonorSummary"
  | "reports.runSummary"
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
  | "tasks.createFollowUpTask"
  | "communications.createEmailDraft";

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
    name: "reports.runSummary",
    kind: "read",
    description: "Runs the org KPI summary report for the current fiscal year: YTD giving, gift count, constituents, active campaigns, pending tasks, grant awards.",
    requiredPermissions: ["view:reports", "view:donations"],
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
      let undesignated = { amount: 0, count: 0 };
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

  for (const donor of briefData.topDonors.slice(0, 5)) {
    const lastGift = donor.lastGiftDate ? fmtDate(donor.lastGiftDate) : "no date on record";
    const record = `${donor.name} — $${donor.lifetimeGiving.toLocaleString()} lifetime, last gift ${lastGift}`;
    lines.push(`- Top donor: ${record}`);
    recordsUsed.push(record);
  }

  if (/thank|gratitude|acknowledg/i.test(lower)) {
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

  if (/lapse|at risk|retention|lybunt|sybunt|drift/i.test(lower)) {
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

  if (/opportun|monthly|next step|best/i.test(lower)) {
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
  if (/report|ytd|revenue|giving|fiscal|this year|last year|goal|kpi|dashboard/i.test(lower)) {
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

  if (/retention|kept|renew|retained|lapse rate|who gave again/i.test(lower)) {
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

  if (/monthly|by month|trend|month.by.month|giving trend/i.test(lower)) {
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

  if (/lybunt|gave last year|not yet|not this year|re.engag/i.test(lower)) {
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
  if (/who is|tell me about|find|search|look up|show me|what do you know about/i.test(lower) || /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(params.query)) {
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
  if (/campaign|fundrais|goal|progress|raised|appeal/i.test(lower)) {
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
  if (/overdue|task|follow.up|behind|pending|assign/i.test(lower)) {
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

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed,
  };
}
