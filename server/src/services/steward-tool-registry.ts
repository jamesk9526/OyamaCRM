/**
 * Steward tool registry enforcing organization scope, permissions, and confirm-first write actions.
 */
import type { PermissionKey } from "../lib/permissions.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  getDailyBrief,
  getLapseRisks,
  getOShareviewDonorSummary,
  getProfileDecisionPacket,
  getThankYousNeeded,
  getTopOpportunities,
  type DonorCommunicationPreferences,
} from "./steward-donor-context.js";

export type StewardToolName =
  | "donor.getDailyBrief"
  | "donor.getThankYousNeeded"
  | "donor.getLapseRisks"
  | "donor.getTopOpportunities"
  | "donor.getProfileDecisionPacket"
  | "reports.getOShareviewDonorSummary"
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
];

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
    const record = `${donor.name} ($${donor.lifetimeGiving.toLocaleString()})`;
    lines.push(`- Top donor: ${record}`);
    recordsUsed.push(record);
  }

  if (/thank|gratitude|acknowledg/i.test(lower)) {
    const thanks = await executeStewardTool(context, "donor.getThankYousNeeded", { limit: 12 });
    toolsUsed.push(thanks.tool);
    const thankRows = thanks.result as Awaited<ReturnType<typeof getThankYousNeeded>>;
    lines.push(`Donors needing thank-you: ${thankRows.length}`);
    for (const row of thankRows.slice(0, 6)) {
      const record = `${row.donorName} $${row.amount.toLocaleString()} (${row.suggestedChannel})`;
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

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed,
  };
}
