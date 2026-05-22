/**
 * Email campaign routes for OyamaCRM.
 * Manages the full lifecycle of bulk email campaigns: drafting, scheduling,
 * SMTP-backed sending (using organization settings), and tracking delivery metrics.
 *
 * Routes:
 *   GET    /api/email-campaigns         — list email campaigns with optional filters
 *   GET    /api/email-campaigns/stats   — aggregate send/open metrics across all campaigns
 *   GET    /api/email-campaigns/:id     — single email campaign detail
 *   POST   /api/email-campaigns         — create a draft or scheduled campaign
 *   PUT    /api/email-campaigns/:id     — update campaign content or metadata
 *   POST   /api/email-campaigns/:id/send — trigger (simulated) campaign send
 *   DELETE /api/email-campaigns/:id     — delete a campaign
 *
 * @module routes/email-campaigns
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmailCategory, EmailPurpose, EmailRecipientEligibilityStatus, Prisma } from "@prisma/client";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import {
  categoryForPurpose,
  evaluateRecipientEligibility,
  getCampaignComplianceIssues,
  hashPublicEmailToken,
  parseEmailPurpose,
  requiresPreferenceCompliance,
} from "../services/email-compliance.js";
import { createOrganizationEmailSender } from "../services/smtp-service.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

const EMAIL_CAMPAIGN_WEBHOOK_SECRET =
  process.env.EMAIL_CAMPAIGN_WEBHOOK_SECRET
  ?? process.env.EMAIL_CAMPAIGNS_WEBHOOK_SECRET
  ?? "";

type DeliveryWebhookPayload = {
  campaignId?: string;
  recipientEmail?: string;
  eventType?: string;
  event?: string;
  metadata?: Record<string, unknown>;
  eventAt?: string;
  timestamp?: string | number;
};

/** Maps provider event labels into canonical delivery event types. */
function mapProviderEventType(raw: unknown): DeliveryEventType | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "QUEUED" || normalized === "PROCESSED" || normalized === "ACCEPTED") return "QUEUED";
  if (normalized === "DELIVERED") return "DELIVERED";
  if (normalized === "OPEN" || normalized === "OPENED") return "OPENED";
  if (normalized === "CLICK" || normalized === "CLICKED") return "CLICKED";
  if (normalized === "BOUNCE" || normalized === "BOUNCED" || normalized === "DROPPED" || normalized === "DEFERRED") return "BOUNCED";
  return null;
}

/** Validates one webhook request against configured secret header or bearer token. */
function hasValidDeliveryWebhookSecret(req: { headers: Record<string, unknown> }): boolean {
  if (!EMAIL_CAMPAIGN_WEBHOOK_SECRET) return false;
  const headerSecret = typeof req.headers["x-oyama-webhook-secret"] === "string"
    ? req.headers["x-oyama-webhook-secret"]
    : null;
  if (headerSecret && headerSecret === EMAIL_CAMPAIGN_WEBHOOK_SECRET) return true;

  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice(7).trim();
  return token.length > 0 && token === EMAIL_CAMPAIGN_WEBHOOK_SECRET;
}

/** Parses provider timestamps from ISO/date-string or epoch seconds/milliseconds. */
function parseWebhookEventAt(value: unknown): Date {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(millis);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date();
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const parsed = new Date(millis);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
}

/**
 * POST /api/email-campaigns/webhooks/delivery
 * Description: Ingests provider delivery/open/click/bounce webhooks into campaign analytics.
 */
router.post("/webhooks/delivery", async (req, res) => {
  if (!EMAIL_CAMPAIGN_WEBHOOK_SECRET) {
    res.status(503).json({ error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Delivery webhook secret is not configured." } });
    return;
  }

  if (!hasValidDeliveryWebhookSecret(req as { headers: Record<string, unknown> })) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook secret." } });
    return;
  }

  const rawBody = req.body as { events?: unknown } | DeliveryWebhookPayload | null;
  const rawEvents = Array.isArray(rawBody)
    ? rawBody
    : Array.isArray(rawBody?.events)
      ? rawBody.events
      : rawBody
        ? [rawBody]
        : [];

  if (rawEvents.length === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide one event or an events array." } });
    return;
  }

  const campaignOrgCache = new Map<string, string>();
  const touchedCampaigns = new Set<string>();
  const errors: Array<{ index: number; reason: string }> = [];
  let processed = 0;

  for (let index = 0; index < rawEvents.length; index += 1) {
    const item = rawEvents[index] as DeliveryWebhookPayload;
    const campaignId = typeof item?.campaignId === "string" ? item.campaignId.trim() : "";
    const recipientEmail = typeof item?.recipientEmail === "string" ? item.recipientEmail.trim().toLowerCase() : "";
    const mappedEventType = mapProviderEventType(item?.eventType ?? item?.event);

    if (!campaignId) {
      errors.push({ index, reason: "campaignId is required" });
      continue;
    }
    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      errors.push({ index, reason: "recipientEmail must be a valid email" });
      continue;
    }
    if (!mappedEventType) {
      errors.push({ index, reason: "eventType/event is unsupported" });
      continue;
    }

    let organizationId = campaignOrgCache.get(campaignId) ?? null;
    if (!organizationId) {
      const campaign = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { organizationId: true },
      });
      if (!campaign) {
        errors.push({ index, reason: "campaign not found" });
        continue;
      }
      organizationId = campaign.organizationId;
      campaignOrgCache.set(campaignId, organizationId);
    }

    const safeEventAt = parseWebhookEventAt(item?.eventAt ?? item?.timestamp);
    const metadataInput = (item?.metadata ?? null) as Prisma.InputJsonValue;

    await prisma.emailCampaignDeliveryEvent.upsert({
      where: {
        campaignId_recipientEmail_eventType: {
          campaignId,
          recipientEmail,
          eventType: mappedEventType,
        },
      },
      update: {
        eventAt: safeEventAt,
        metadata: metadataInput,
      },
      create: {
        organizationId,
        campaignId,
        recipientEmail,
        eventType: mappedEventType,
        eventAt: safeEventAt,
        metadata: metadataInput,
      },
    });

    touchedCampaigns.add(campaignId);
    processed += 1;
  }

  await Promise.all(Array.from(touchedCampaigns).map((campaignId) => recalculateCampaignDeliveryStats(campaignId)));

  res.status(202).json({
    received: rawEvents.length,
    processed,
    rejected: errors.length,
    errors,
    campaignsUpdated: touchedCampaigns.size,
  });
});

// All email-campaign routes require authentication.
router.use(requireAuth);

// Communications permissions: GET endpoints require view access; mutations require edit access.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:communications")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:communications")(req, res, next);
  }
  return next();
});

type AudienceFilter = { type?: string } | null;
type AudienceConstituent = {
  id: string;
  email: string | null;
  doNotEmail: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
};

interface AudiencePreview {
  totalMatched: number;
  validEmail: number;
  missingEmail: number;
  optedOut: number;
  duplicateEmails: number;
  suppressionCount: number;
  categoryOptOut: number;
  doNotContact: number;
  invalidEmail: number;
  suppressed: number;
  finalSendCount: number;
  recipients: string[];
}

interface CampaignSharingSettings {
  ownerId: string | null;
  sharedWithOrganization: boolean;
}

type CampaignPreparationStatus = "NOT_STARTED" | "DRAFT" | "READY";

interface CampaignWorkflowSettings {
  preparationStatus: CampaignPreparationStatus;
}

const CAMPAIGN_PREPARATION_STATUSES: CampaignPreparationStatus[] = ["NOT_STARTED", "DRAFT", "READY"];

type CampaignSendMode = "CAMPAIGN_AUDIENCE" | "SEGMENT" | "SAVED_LIST" | "LIST" | "INDIVIDUAL" | "MULTI_SEGMENT" | "MULTI_LIST";

interface CampaignSendOptions {
  sendMode?: CampaignSendMode;
  audienceFilter?: AudienceFilter | { types?: string[] };
  recipientListId?: string;
  recipientListIds?: string[];
  recipientEmails?: string[];
}

interface ResolvedRecipientPlan {
  sendMode: CampaignSendMode;
  recipients: string[];
  decisions: Array<{
    email: string;
    constituentId: string | null;
    subscriptionId: string | null;
    eligibilityStatus: EmailRecipientEligibilityStatus;
    ineligibilityReason: string | null;
  }>;
  category: EmailCategory;
  audience: Omit<AudiencePreview, "recipients">;
  audienceType: string;
  recipientListId?: string;
}

type DeliveryEventType = "QUEUED" | "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED";

const DELIVERY_EVENT_TYPES: DeliveryEventType[] = ["QUEUED", "DELIVERED", "OPENED", "CLICKED", "BOUNCED"];

/** Validates and normalizes delivery event type strings from request payloads. */
function parseDeliveryEventType(raw: unknown): DeliveryEventType | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase() as DeliveryEventType;
  return DELIVERY_EVENT_TYPES.includes(normalized) ? normalized : null;
}

// RFC 5322-inspired practical pattern for application-level email validation.
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const COMPLIANCE_TOKEN_PATTERN = /\{\{\s*(unsubscribe(?:Url|_url)|managePreferencesUrl|preferences(?:Url|_url))\s*\}\}/i;
const UNSUBSCRIBE_LINK_PATTERN = /\{\{\s*unsubscribe(?:Url|_url)\s*\}\}|\/unsubscribe\//i;
const PREFERENCES_LINK_PATTERN = /\{\{\s*(managePreferencesUrl|preferences(?:Url|_url))\s*\}\}|\/preferences\//i;

/** Basic email format check for send-test and from/reply fields. */
function isValidEmail(value: string): boolean {
  const email = value.trim();
  return EMAIL_PATTERN.test(email);
}

function buildAutomaticComplianceFooterHtml(missingUnsubscribe: boolean, missingPreferences: boolean): string {
  const controls: string[] = [];
  if (missingUnsubscribe) {
    controls.push('<a href="{{unsubscribeUrl}}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>');
  }
  if (missingPreferences) {
    controls.push('<a href="{{managePreferencesUrl}}" style="color:#4b5563;text-decoration:underline;">Manage Preferences</a>');
  }

  if (controls.length === 0) return "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background:#f9fafb;border-top:1px solid #e5e7eb;">
  <tr>
    <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#4b5563;text-align:center;">
      Email preferences: ${controls.join(" · ")}
    </td>
  </tr>
</table>`.trim();
}

function buildAutomaticComplianceFooterText(missingUnsubscribe: boolean, missingPreferences: boolean): string {
  const controls: string[] = [];
  if (missingUnsubscribe) controls.push("Unsubscribe: {{unsubscribeUrl}}");
  if (missingPreferences) controls.push("Manage Preferences: {{managePreferencesUrl}}");
  if (controls.length === 0) return "";
  return `\n\nEmail preferences: ${controls.join(" | ")}`;
}

function ensureComplianceFooter(content: string, format: "html" | "text"): string {
  const safeContent = content.trim();
  const hasUnsubscribeControl = UNSUBSCRIBE_LINK_PATTERN.test(safeContent);
  const hasPreferencesControl = PREFERENCES_LINK_PATTERN.test(safeContent);

  const missingUnsubscribe = !hasUnsubscribeControl;
  const missingPreferences = !hasPreferencesControl;
  if (!missingUnsubscribe && !missingPreferences) return safeContent;

  if (format === "html") {
    const footer = buildAutomaticComplianceFooterHtml(missingUnsubscribe, missingPreferences);
    return `${safeContent}\n${footer}`;
  }

  return `${safeContent}${buildAutomaticComplianceFooterText(missingUnsubscribe, missingPreferences)}`;
}

function buildCampaignDeliveryBodies(campaign: { bodyHtml: string | null; bodyText: string | null }, purpose: EmailPurpose) {
  const baseHtml = campaign.bodyHtml?.trim() || `<p>${campaign.bodyText || "No content"}</p>`;
  const baseText = campaign.bodyText?.trim() || "No text content";

  if (!requiresPreferenceCompliance(purpose)) {
    return { html: baseHtml, text: baseText };
  }

  return {
    html: ensureComplianceFooter(baseHtml, "html"),
    text: ensureComplianceFooter(baseText, "text"),
  };
}

/** Resolves audience filters into a Prisma where clause for constituents. */
function audienceWhere(filter: AudienceFilter) {
  const type = filter?.type ?? "all";
  if (type === "active") return { donorStatus: "ACTIVE" as const };
  if (type === "lapsed") return { donorStatus: "LAPSED" as const };
  if (type === "new") return { donorStatus: "NEW" as const };
  if (type === "major") return { donorStatus: "MAJOR_DONOR" as const };
  if (type === "volunteers") return { type: "VOLUNTEER" as const };
  return {};
}

/** Returns all audience-matching constituents with email preferences for preview/sending flows. */
async function getAudienceConstituents(filter: AudienceFilter, organizationId: string): Promise<AudienceConstituent[]> {
  const rows = await prisma.constituent.findMany({
    where: {
      organizationId,
      ...(audienceWhere(filter) as object),
    },
    select: {
      id: true,
      email: true,
      doNotEmail: true,
      doNotContact: true,
      emailOptOut: true,
    },
    take: 5000,
  });
  return rows;
}

/**
 * Computes recipient preview counts after applying shared subscription/suppression compliance rules.
 * This keeps preview and actual send eligibility behavior aligned.
 */
async function computeAudiencePreview(
  rows: AudienceConstituent[],
  organizationId: string,
  purpose: EmailPurpose,
): Promise<AudiencePreview> {
  const evaluation = await evaluateRecipientEligibility({
    organizationId,
    purpose,
    candidates: rows.map((row) => ({
      email: row.email ?? "",
      constituentId: row.id,
      doNotEmail: row.doNotEmail,
      doNotContact: row.doNotContact,
      emailOptOut: row.emailOptOut,
    })),
  });

  return {
    totalMatched: evaluation.summary.totalMatched,
    validEmail: evaluation.summary.validEmail,
    missingEmail: evaluation.summary.missingEmail,
    optedOut: evaluation.summary.optedOut,
    duplicateEmails: evaluation.summary.duplicateEmails,
    suppressionCount: evaluation.summary.suppressionCount,
    categoryOptOut: evaluation.summary.categoryOptOut,
    doNotContact: evaluation.summary.doNotContact,
    invalidEmail: evaluation.summary.invalidEmail,
    suppressed: evaluation.summary.suppressed,
    finalSendCount: evaluation.summary.finalSendCount,
    recipients: evaluation.recipients,
  };
}

/** Normalizes and validates recipient emails from manual list payloads. */
function normalizeRecipientEmails(raw: string[] | undefined): string[] {
  if (!raw || raw.length === 0) return [];

  const flattened = raw
    .flatMap((value) => String(value).split(/[\n,;]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of flattened) {
    if (!isValidEmail(email)) {
      throw new CampaignSendError(`Invalid recipient email: ${email}`, 400);
    }
    if (!seen.has(email)) {
      seen.add(email);
      unique.push(email);
    }
  }

  return unique;
}

/** Loads multiple saved recipient lists and combines their recipients with deduplication. */
async function resolveMultiSavedListRecipients(
  listIds: string[] | undefined,
  organizationId: string,
): Promise<{ listIds: string[]; recipients: string[]; names: string[] }> {
  if (!listIds || listIds.length === 0) {
    throw new CampaignSendError("At least one recipientListId is required for multi-list sends.", 400);
  }

  const lists = await prisma.emailRecipientList.findMany({
    where: {
      id: { in: listIds },
      organizationId,
    },
    include: {
      recipients: {
        select: { email: true },
      },
    },
  });

  if (lists.length === 0) {
    throw new CampaignSendError("No saved recipient lists found.", 404);
  }

  // Combine all recipients and deduplicate
  const recipientSet = new Set<string>();
  for (const list of lists) {
    for (const recipient of list.recipients) {
      if (recipient.email) {
        recipientSet.add(recipient.email.trim().toLowerCase());
      }
    }
  }

  return {
    listIds: lists.map((l) => l.id),
    names: lists.map((l) => l.name),
    recipients: Array.from(recipientSet),
  };
}

/** Gets all constituents matching multiple segment types and combines with deduplication. */
async function getMultiSegmentConstituents(
  types: string[],
  organizationId: string,
): Promise<AudienceConstituent[]> {
  if (!types || types.length === 0) {
    return [];
  }

  const whereConditions = types.map((type) => audienceWhere({ type }));
  const uniqueConstituents = new Map<string, AudienceConstituent>();

  for (const where of whereConditions) {
    const rows = await prisma.constituent.findMany({
      where: {
        organizationId,
        ...where,
      },
      select: {
        id: true,
        email: true,
        doNotEmail: true,
        doNotContact: true,
        emailOptOut: true,
      },
      take: 5000,
    });

    for (const row of rows) {
      if (!uniqueConstituents.has(row.id)) {
        uniqueConstituents.set(row.id, row);
      }
    }
  }

  return Array.from(uniqueConstituents.values());
}

/** Loads one saved recipient list and normalizes member emails for sending. */
async function resolveSavedListRecipients(
  listId: string | undefined,
  organizationId: string,
): Promise<{ listId: string; recipients: string[]; name: string }> {
  if (!listId) {
    throw new CampaignSendError("recipientListId is required for saved-list sends.", 400);
  }

  const list = await prisma.emailRecipientList.findFirst({
    where: {
      id: listId,
      organizationId,
    },
    include: {
      recipients: {
        select: { email: true },
      },
    },
  });

  if (!list) {
    throw new CampaignSendError("Saved recipient list not found.", 404);
  }

  const recipients = normalizeRecipientEmails(list.recipients.map((row) => row.email));
  return {
    listId: list.id,
    name: list.name,
    recipients,
  };
}

/** Resolves recipients for one send operation from campaign audience, segment, list, or individual modes. */
async function resolveRecipientPlan(
  campaign: { organizationId: string; audienceFilter: string | null; purpose: EmailPurpose },
  options?: CampaignSendOptions,
): Promise<ResolvedRecipientPlan> {
  const sendMode = options?.sendMode ?? "CAMPAIGN_AUDIENCE";

  if (sendMode === "MULTI_LIST") {
    const multi = await resolveMultiSavedListRecipients(options?.recipientListIds, campaign.organizationId);
    const evaluation = await evaluateRecipientEligibility({
      organizationId: campaign.organizationId,
      purpose: campaign.purpose,
      candidates: multi.recipients.map((email) => ({ email })),
    });

    return {
      sendMode,
      recipients: evaluation.recipients,
      decisions: evaluation.decisions,
      category: evaluation.category,
      audience: {
        totalMatched: evaluation.summary.totalMatched,
        validEmail: evaluation.summary.validEmail,
        missingEmail: evaluation.summary.missingEmail,
        optedOut: evaluation.summary.optedOut,
        duplicateEmails: evaluation.summary.duplicateEmails,
        suppressionCount: evaluation.summary.suppressionCount,
        categoryOptOut: evaluation.summary.categoryOptOut,
        doNotContact: evaluation.summary.doNotContact,
        invalidEmail: evaluation.summary.invalidEmail,
        suppressed: evaluation.summary.suppressed,
        finalSendCount: evaluation.summary.finalSendCount,
      },
      audienceType: `multi-lists:${multi.names.join(", ")}`,
    };
  }

  if (sendMode === "SAVED_LIST") {
    const saved = await resolveSavedListRecipients(options?.recipientListId, campaign.organizationId);
    const evaluation = await evaluateRecipientEligibility({
      organizationId: campaign.organizationId,
      purpose: campaign.purpose,
      candidates: saved.recipients.map((email) => ({ email })),
    });

    return {
      sendMode,
      recipients: evaluation.recipients,
      decisions: evaluation.decisions,
      category: evaluation.category,
      audience: {
        totalMatched: evaluation.summary.totalMatched,
        validEmail: evaluation.summary.validEmail,
        missingEmail: evaluation.summary.missingEmail,
        optedOut: evaluation.summary.optedOut,
        duplicateEmails: evaluation.summary.duplicateEmails,
        suppressionCount: evaluation.summary.suppressionCount,
        categoryOptOut: evaluation.summary.categoryOptOut,
        doNotContact: evaluation.summary.doNotContact,
        invalidEmail: evaluation.summary.invalidEmail,
        suppressed: evaluation.summary.suppressed,
        finalSendCount: evaluation.summary.finalSendCount,
      },
      audienceType: `saved-list:${saved.name}`,
      recipientListId: saved.listId,
    };
  }

  if (sendMode === "LIST" || sendMode === "INDIVIDUAL") {
    const recipients = normalizeRecipientEmails(options?.recipientEmails);
    const evaluation = await evaluateRecipientEligibility({
      organizationId: campaign.organizationId,
      purpose: campaign.purpose,
      candidates: recipients.map((email) => ({ email })),
    });

    return {
      sendMode,
      recipients: evaluation.recipients,
      decisions: evaluation.decisions,
      category: evaluation.category,
      audience: {
        totalMatched: evaluation.summary.totalMatched,
        validEmail: evaluation.summary.validEmail,
        missingEmail: evaluation.summary.missingEmail,
        optedOut: evaluation.summary.optedOut,
        duplicateEmails: evaluation.summary.duplicateEmails,
        suppressionCount: evaluation.summary.suppressionCount,
        categoryOptOut: evaluation.summary.categoryOptOut,
        doNotContact: evaluation.summary.doNotContact,
        invalidEmail: evaluation.summary.invalidEmail,
        suppressed: evaluation.summary.suppressed,
        finalSendCount: evaluation.summary.finalSendCount,
      },
      audienceType: sendMode === "INDIVIDUAL" ? "individual" : "manual-list",
    };
  }

  // Handle MULTI_SEGMENT and SEGMENT/CAMPAIGN_AUDIENCE
  const stored = parseCampaignAudienceFilter(campaign.audienceFilter);
  let types: string[] = [];

  if (sendMode === "MULTI_SEGMENT") {
    const filterObj = options?.audienceFilter as { types?: string[] } | undefined;
    types = filterObj?.types ?? [];
    if (types.length === 0) {
      throw new CampaignSendError("At least one segment type is required for multi-segment sends.", 400);
    }
  }

  if (sendMode === "MULTI_SEGMENT" && types.length > 0) {
    const rows = await getMultiSegmentConstituents(types, campaign.organizationId);
    const evaluation = await evaluateRecipientEligibility({
      organizationId: campaign.organizationId,
      purpose: campaign.purpose,
      candidates: rows.map((row) => ({
        email: row.email ?? "",
        constituentId: row.id,
        doNotEmail: row.doNotEmail,
        doNotContact: row.doNotContact,
        emailOptOut: row.emailOptOut,
      })),
    });

    return {
      sendMode,
      recipients: evaluation.recipients,
      decisions: evaluation.decisions,
      category: evaluation.category,
      audience: {
        totalMatched: evaluation.summary.totalMatched,
        validEmail: evaluation.summary.validEmail,
        missingEmail: evaluation.summary.missingEmail,
        optedOut: evaluation.summary.optedOut,
        duplicateEmails: evaluation.summary.duplicateEmails,
        suppressionCount: evaluation.summary.suppressionCount,
        categoryOptOut: evaluation.summary.categoryOptOut,
        doNotContact: evaluation.summary.doNotContact,
        invalidEmail: evaluation.summary.invalidEmail,
        suppressed: evaluation.summary.suppressed,
        finalSendCount: evaluation.summary.finalSendCount,
      },
      audienceType: `multi-segments:${types.join(", ")}`,
    };
  }

  // SEGMENT or CAMPAIGN_AUDIENCE
  // For SEGMENT mode, use options.audienceFilter as AudienceFilter; otherwise use stored filter
  const segmentFilter = sendMode === "SEGMENT" ? (options?.audienceFilter as AudienceFilter | undefined) : undefined;
  const effectiveFilter = segmentFilter ?? stored.filter;

  const rows = await getAudienceConstituents(effectiveFilter, campaign.organizationId);
  const evaluation = await evaluateRecipientEligibility({
    organizationId: campaign.organizationId,
    purpose: campaign.purpose,
    candidates: rows.map((row) => ({
      email: row.email ?? "",
      constituentId: row.id,
      doNotEmail: row.doNotEmail,
      doNotContact: row.doNotContact,
      emailOptOut: row.emailOptOut,
    })),
  });

  return {
    sendMode,
    recipients: evaluation.recipients,
    decisions: evaluation.decisions,
    category: evaluation.category,
    audience: {
      totalMatched: evaluation.summary.totalMatched,
      validEmail: evaluation.summary.validEmail,
      missingEmail: evaluation.summary.missingEmail,
      optedOut: evaluation.summary.optedOut,
      duplicateEmails: evaluation.summary.duplicateEmails,
      suppressionCount: evaluation.summary.suppressionCount,
      categoryOptOut: evaluation.summary.categoryOptOut,
      doNotContact: evaluation.summary.doNotContact,
      invalidEmail: evaluation.summary.invalidEmail,
      suppressed: evaluation.summary.suppressed,
      finalSendCount: evaluation.summary.finalSendCount,
    },
    audienceType:
      effectiveFilter && typeof effectiveFilter === "object" && typeof effectiveFilter.type === "string"
        ? effectiveFilter.type
        : "all",
  };
}

/** Validates preparation status values and returns a safe fallback for unknown inputs. */
function normalizePreparationStatus(
  raw: unknown,
  fallback: CampaignPreparationStatus = "DRAFT",
): CampaignPreparationStatus {
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toUpperCase() as CampaignPreparationStatus;
  return CAMPAIGN_PREPARATION_STATUSES.includes(normalized) ? normalized : fallback;
}

/** Parse audienceFilter JSON into filter + sharing/workflow settings with safe defaults. */
function parseCampaignAudienceFilter(
  raw: string | null,
): { filter: AudienceFilter; sharing: CampaignSharingSettings; workflow: CampaignWorkflowSettings } {
  if (!raw) {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
      workflow: { preparationStatus: "DRAFT" },
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sharing = parsed._sharing;
    const sharingObj = sharing && typeof sharing === "object" && !Array.isArray(sharing)
      ? (sharing as Record<string, unknown>)
      : null;
    const workflow = parsed._workflow;
    const workflowObj = workflow && typeof workflow === "object" && !Array.isArray(workflow)
      ? (workflow as Record<string, unknown>)
      : null;

    return {
      filter: { type: typeof parsed.type === "string" ? parsed.type : undefined },
      sharing: {
        ownerId: sharingObj && typeof sharingObj.ownerId === "string" ? sharingObj.ownerId : null,
        sharedWithOrganization:
          sharingObj && typeof sharingObj.sharedWithOrganization === "boolean"
            ? sharingObj.sharedWithOrganization
            : true,
      },
      workflow: {
        preparationStatus: normalizePreparationStatus(
          workflowObj?.preparationStatus,
          "DRAFT",
        ),
      },
    };
  } catch {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
      workflow: { preparationStatus: "DRAFT" },
    };
  }
}

/** Serialize filter payload back into audienceFilter JSON while preserving sharing metadata. */
function serializeCampaignAudienceFilter(
  filter: AudienceFilter,
  ownerId: string,
  sharedWithOrganization: boolean,
  preparationStatus: CampaignPreparationStatus,
): string {
  const safeFilter = filter && typeof filter === "object" ? { ...filter } : {};
  return JSON.stringify({
    ...safeFilter,
    _sharing: {
      ownerId,
      sharedWithOrganization,
    },
    _workflow: {
      preparationStatus,
    },
  });
}

/** Replaces compliance merge tokens with recipient-specific URLs. */
function applyComplianceLinkTokens(
  content: string,
  links: { unsubscribeUrl: string; preferencesUrl: string },
): string {
  const replaceToken = (input: string, token: string, value: string) => input.split(token).join(value);
  let normalized = content;
  normalized = replaceToken(normalized, "{{unsubscribeUrl}}", links.unsubscribeUrl);
  normalized = replaceToken(normalized, "{{unsubscribe_url}}", links.unsubscribeUrl);
  normalized = replaceToken(normalized, "{{managePreferencesUrl}}", links.preferencesUrl);
  normalized = replaceToken(normalized, "{{preferencesUrl}}", links.preferencesUrl);
  normalized = replaceToken(normalized, "{{preferences_url}}", links.preferencesUrl);
  return normalized;
}

/** Issues one tokenized unsubscribe/preferences link pair for a specific recipient and campaign. */
async function issueRecipientComplianceLinks(params: {
  organizationId: string;
  campaignId: string;
  email: string;
  category: EmailCategory;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const subscription = await prisma.emailSubscription.upsert({
    where: {
      organizationId_email: {
        organizationId: params.organizationId,
        email: normalizedEmail,
      },
    },
    create: {
      organizationId: params.organizationId,
      email: normalizedEmail,
      globalStatus: "UNKNOWN",
      source: "campaign-send",
    },
    update: {},
  });

  const rawToken = `${randomUUID()}${randomUUID()}`;
  const tokenHash = hashPublicEmailToken(rawToken);
  const expiresAt = new Date(Date.now() + (180 * 24 * 60 * 60 * 1000));

  await prisma.emailUnsubscribeToken.create({
    data: {
      organizationId: params.organizationId,
      subscriptionId: subscription.id,
      tokenHash,
      email: normalizedEmail,
      category: params.category,
      campaignId: params.campaignId,
      expiresAt,
    },
  });

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    unsubscribeUrl: `${appBase}/unsubscribe/${rawToken}`,
    preferencesUrl: `${appBase}/preferences/${rawToken}`,
  };
}

/** Writes one event row per recipient for delivery analytics and send forensics. */
async function createDeliveryEvents(params: {
  organizationId: string;
  campaignId: string;
  recipients: string[];
  eventType: DeliveryEventType;
  metadata?: Record<string, unknown>;
}) {
  const uniqueRecipients = Array.from(new Set(params.recipients.map((email) => email.trim().toLowerCase())));
  if (uniqueRecipients.length === 0) return;
  const metadataInput = params.metadata as Prisma.InputJsonValue | undefined;

  await prisma.emailCampaignDeliveryEvent.createMany({
    data: uniqueRecipients.map((recipientEmail) => ({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      recipientEmail,
      eventType: params.eventType,
      eventAt: new Date(),
      metadata: metadataInput,
    })),
    skipDuplicates: true,
  });
}

/** Persists one eligibility snapshot row per campaign recipient for compliance and reporting. */
async function persistSendRecipients(params: {
  organizationId: string;
  campaignId: string;
  purpose: EmailPurpose;
  category: EmailCategory;
  decisions: Array<{
    email: string;
    constituentId: string | null;
    subscriptionId: string | null;
    eligibilityStatus: EmailRecipientEligibilityStatus;
    ineligibilityReason: string | null;
  }>;
}) {
  const byEmail = new Map<string, {
    email: string;
    constituentId: string | null;
    subscriptionId: string | null;
    eligibilityStatus: EmailRecipientEligibilityStatus;
    ineligibilityReason: string | null;
  }>();

  for (const decision of params.decisions) {
    const email = decision.email.trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, { ...decision, email });
  }

  if (byEmail.size === 0) return;

  await prisma.emailSendRecipient.createMany({
    data: Array.from(byEmail.values()).map((decision) => ({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      subscriptionId: decision.subscriptionId,
      constituentId: decision.constituentId,
      email: decision.email,
      category: params.category,
      purpose: params.purpose,
      eligibilityStatus: decision.eligibilityStatus,
      ineligibilityReason: decision.ineligibilityReason,
      queuedAt: decision.eligibilityStatus === "ELIGIBLE" ? new Date() : null,
      sentAt: null,
    })),
    skipDuplicates: true,
  });
}

/** Writes recipient-level timeline rows after a campaign send so constituent history stays complete. */
async function writeRecipientTimelineActivities(params: {
  organizationId: string;
  campaignId: string;
  campaignName: string;
  subject: string;
  recipients: string[];
  trigger: "MANUAL" | "QUEUE";
  sendMode: CampaignSendMode;
  audienceType: string;
}) {
  const normalizedRecipients = Array.from(new Set(params.recipients.map((email) => email.trim().toLowerCase())));
  if (normalizedRecipients.length === 0) return;

  const constituents = await prisma.constituent.findMany({
    where: {
      organizationId: params.organizationId,
      email: {
        in: normalizedRecipients,
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (constituents.length === 0) return;

  const byEmail = new Map<string, string>();
  for (const constituent of constituents) {
    const email = constituent.email?.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, constituent.id);
  }

  const activityRows = normalizedRecipients.flatMap((recipientEmail) => {
    const constituentId = byEmail.get(recipientEmail);
    if (!constituentId) return [];

    return [{
      constituentId,
      type: "EMAIL_SENT" as const,
      description: `Campaign delivered: ${params.campaignName}`,
      metadata: {
        source: "api/email-campaigns:send",
        campaignId: params.campaignId,
        campaignName: params.campaignName,
        subject: params.subject,
        recipientEmail,
        trigger: params.trigger,
        sendMode: params.sendMode,
        audienceType: params.audienceType,
      },
    }];
  });

  if (activityRows.length === 0) return;
  await prisma.activity.createMany({ data: activityRows });
}

/** Safely chooses a file extension from mime type or original file name for campaign media storage. */
function resolveMediaExtension(mimeType: string, fileName: string): string {
  const safeMime = mimeType.toLowerCase();
  if (safeMime.includes("jpeg")) return "jpg";
  if (safeMime.includes("png")) return "png";
  if (safeMime.includes("gif")) return "gif";
  if (safeMime.includes("webp")) return "webp";
  if (safeMime.includes("svg")) return "svg";

  const extFromName = path.extname(fileName || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return extFromName || "bin";
}

/** Rebuilds campaign-level delivery counters from event rows. */
async function recalculateCampaignDeliveryStats(campaignId: string) {
  const [queued, delivered, opened, clicked, bounced] = await Promise.all([
    prisma.emailCampaignDeliveryEvent.count({ where: { campaignId, eventType: "QUEUED" } }),
    prisma.emailCampaignDeliveryEvent.count({ where: { campaignId, eventType: "DELIVERED" } }),
    prisma.emailCampaignDeliveryEvent.count({ where: { campaignId, eventType: "OPENED" } }),
    prisma.emailCampaignDeliveryEvent.count({ where: { campaignId, eventType: "CLICKED" } }),
    prisma.emailCampaignDeliveryEvent.count({ where: { campaignId, eventType: "BOUNCED" } }),
  ]);

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients: queued > 0 ? queued : delivered,
      delivered,
      opened,
      clicked,
      bounced,
    },
  });
}

/** True when user can view campaign. */
function canAccessCampaign(sharing: CampaignSharingSettings, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  if (!sharing.ownerId) return true;
  if (sharing.ownerId === userId) return true;
  return sharing.sharedWithOrganization;
}

/** True when user can edit/send/delete campaign. */
function canManageCampaign(sharing: CampaignSharingSettings, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  if (!sharing.ownerId) return true;
  return sharing.ownerId === userId;
}

/** Typed HTTP-friendly error for campaign send flows. */
class CampaignSendError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CampaignSendError";
    this.status = status;
  }
}

/**
 * Sends one email campaign immediately and writes send metrics/audit.
 * Used by both manual send route and the scheduled queue worker.
 */
export async function sendCampaignNow(
  campaignId: string,
  trigger: "MANUAL" | "QUEUE" = "MANUAL",
  options?: CampaignSendOptions,
) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    throw new CampaignSendError("Campaign not found", 404);
  }
  if (campaign.status === "SENT") {
    throw new CampaignSendError("Campaign already sent", 400);
  }
  if (campaign.status === "CANCELLED") {
    throw new CampaignSendError("Cancelled campaigns cannot be sent.", 400);
  }
  if (campaign.status === "SENDING") {
    throw new CampaignSendError("Campaign send is already in progress.", 409);
  }
  if (trigger === "QUEUE" && campaign.status !== "SCHEDULED") {
    throw new CampaignSendError("Only scheduled campaigns can be processed by the queue worker.", 400);
  }

  const purpose = parseEmailPurpose((campaign as { purpose?: unknown }).purpose);
  const deliveryBodies = buildCampaignDeliveryBodies(campaign, purpose);
  const complianceIssues = getCampaignComplianceIssues({
    purpose,
    subject: campaign.subject,
    bodyHtml: deliveryBodies.html,
    bodyText: deliveryBodies.text,
    fromEmail: campaign.fromEmail,
    replyToEmail: campaign.replyToEmail,
  });
  if (complianceIssues.length > 0) {
    throw new CampaignSendError(`Campaign failed compliance checks: ${complianceIssues.join(" ")}`, 400);
  }

  const previousStatus = campaign.status;
  const claimed = await prisma.emailCampaign.updateMany({
    where: { id: campaign.id, status: previousStatus },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) {
    throw new CampaignSendError("Campaign is currently being processed.", 409);
  }

  let resolvedPlan: ResolvedRecipientPlan | null = null;

  try {
    const sender = await createOrganizationEmailSender(campaign.organizationId).catch((error) => {
      const message = error instanceof Error ? error.message : "Outbound email provider is not ready.";
      throw new CampaignSendError(message, 400);
    });

    const recipientPlan = await resolveRecipientPlan({
      organizationId: campaign.organizationId,
      audienceFilter: campaign.audienceFilter,
      purpose,
    }, options);
    resolvedPlan = recipientPlan;

    await persistSendRecipients({
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      purpose,
      category: recipientPlan.category,
      decisions: recipientPlan.decisions,
    });

    const to = recipientPlan.recipients;
    const recipientCount = to.length;

    if (recipientCount === 0) {
      throw new CampaignSendError("No recipients match this audience filter.", 400);
    }

    await createDeliveryEvents({
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      recipients: to,
      eventType: "QUEUED",
      metadata: {
        trigger,
        sendMode: recipientPlan.sendMode,
        audienceType: recipientPlan.audienceType,
      },
    });

    await prisma.emailSendRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        email: { in: to },
      },
      data: {
        sentAt: new Date(),
      },
    });

    for (const recipientEmail of to) {
      const links = await issueRecipientComplianceLinks({
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        email: recipientEmail,
        category: recipientPlan.category,
      });

      await sender.send({
        to: recipientEmail,
        subject: campaign.subject || campaign.name,
        text: applyComplianceLinkTokens(deliveryBodies.text, links),
        html: applyComplianceLinkTokens(deliveryBodies.html, links),
        fromNameOverride: campaign.fromName,
      });
    }

    await createDeliveryEvents({
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      recipients: to,
      eventType: "DELIVERED",
      metadata: {
        trigger,
        sendMode: recipientPlan.sendMode,
      },
    });

    await writeRecipientTimelineActivities({
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      subject: campaign.subject || campaign.name,
      recipients: to,
      trigger,
      sendMode: recipientPlan.sendMode,
      audienceType: recipientPlan.audienceType,
    });

    const updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        unsubscribed: 0,
      },
    });

    await recalculateCampaignDeliveryStats(campaign.id);

    await prisma.auditLog.create({
      data: {
        organizationId: campaign.organizationId,
        action: "EMAIL_CAMPAIGN_SENT",
        entity: "EmailCampaign",
        entityId: campaign.id,
        metadata: {
          trigger,
          sendMode: recipientPlan.sendMode,
          audienceType: recipientPlan.audienceType,
          totalMatched: recipientPlan.audience.totalMatched,
          missingEmail: recipientPlan.audience.missingEmail,
          optedOut: recipientPlan.audience.optedOut,
          duplicateEmails: recipientPlan.audience.duplicateEmails,
          categoryOptOut: recipientPlan.audience.categoryOptOut,
          doNotContact: recipientPlan.audience.doNotContact,
          invalidEmail: recipientPlan.audience.invalidEmail,
          suppressed: recipientPlan.audience.suppressed,
          finalSendCount: recipientPlan.audience.finalSendCount,
          recipientListId: recipientPlan.recipientListId,
          purpose,
          category: recipientPlan.category,
        },
      },
    });

    return updated;
  } catch (err) {
    // Return campaign to its previous state when send fails after claim.
    await prisma.emailCampaign.updateMany({
      where: { id: campaign.id, status: "SENDING" },
      data: { status: previousStatus },
    });

    if (resolvedPlan && resolvedPlan.recipients.length > 0) {
      await createDeliveryEvents({
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        recipients: resolvedPlan.recipients,
        eventType: "BOUNCED",
        metadata: {
          trigger,
          reason: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {
        // Best-effort event write for failed sends.
      });

      await recalculateCampaignDeliveryStats(campaign.id).catch(() => {
        // Best-effort stat rebuild for failed sends.
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: campaign.organizationId,
        action: "EMAIL_CAMPAIGN_SEND_FAILED",
        entity: "EmailCampaign",
        entityId: campaign.id,
        metadata: {
          trigger,
          message: err instanceof Error ? err.message : String(err),
        },
      },
    }).catch(() => {
      // Best-effort logging only.
    });

    throw err;
  }
}

/**
 * GET /api/email-campaigns/:id/send-log
 * Description: Returns revision + send/test/schedule/cancel activity entries for one campaign.
 */
router.get("/:id/send-log", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, audienceFilter: true },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this campaign" } });
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

  const items = await prisma.auditLog.findMany({
    where: {
      organizationId,
      entity: "EmailCampaign",
      entityId: campaign.id,
      action: {
        in: [
          "EMAIL_CAMPAIGN_CREATED",
          "EMAIL_CAMPAIGN_UPDATED",
          "EMAIL_CAMPAIGN_SENT",
          "EMAIL_CAMPAIGN_SEND_FAILED",
          "EMAIL_CAMPAIGN_TEST_SENT",
          "EMAIL_CAMPAIGN_SCHEDULED",
          "EMAIL_CAMPAIGN_CANCELLED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  res.json(items.map((entry) => ({
    id: entry.id,
    action: entry.action,
    createdAt: entry.createdAt,
    metadata: entry.metadata,
    user: entry.user
      ? {
          id: entry.user.id,
          name: `${entry.user.firstName ?? ""} ${entry.user.lastName ?? ""}`.trim() || entry.user.email,
          email: entry.user.email,
        }
      : null,
  })));
});

/**
 * POST /api/email-campaigns/:id/media
 * Description: Uploads one media file for an email campaign and returns a static asset URL for template blocks.
 * Body: { fileName: string, mimeType: string, dataBase64: string }
 */
router.post("/:id/media", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, name: true, audienceFilter: true },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to modify this campaign" } });
    return;
  }

  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : "application/octet-stream";
  const dataBase64 = typeof req.body?.dataBase64 === "string" ? req.body.dataBase64.trim() : "";
  if (!fileName || !dataBase64) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "fileName and dataBase64 are required" } });
    return;
  }

  const normalizedData = dataBase64.includes(",") ? dataBase64.split(",").pop() ?? "" : dataBase64;
  const buffer = Buffer.from(normalizedData, "base64");
  if (!buffer || buffer.byteLength === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid base64 payload" } });
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Media upload must be 5MB or smaller" } });
    return;
  }

  const ext = resolveMediaExtension(mimeType, fileName);
  const safeName = `${randomUUID()}.${ext}`;
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "email-media", organizationId);
  const targetPath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const publicUrl = `/uploads/email-media/${organizationId}/${safeName}`;

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_MEDIA_UPLOADED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: {
        fileName,
        mimeType,
        sizeBytes: buffer.byteLength,
        publicUrl,
      },
    },
  });

  res.status(201).json({
    url: publicUrl,
    fileName,
    mimeType,
    sizeBytes: buffer.byteLength,
  });
});

/**
 * GET /api/email-campaigns/:id/delivery-events
 * Description: Returns delivery analytics summary and recent per-recipient events.
 */
router.get("/:id/delivery-events", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, audienceFilter: true },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this campaign" } });
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "200", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 1000) : 200;

  const [events, grouped] = await Promise.all([
    prisma.emailCampaignDeliveryEvent.findMany({
      where: {
        organizationId,
        campaignId: campaign.id,
      },
      orderBy: { eventAt: "desc" },
      take: limit,
    }),
    prisma.emailCampaignDeliveryEvent.groupBy({
      by: ["eventType"],
      where: {
        organizationId,
        campaignId: campaign.id,
      },
      _count: { eventType: true },
    }),
  ]);

  const [latestEvent, distinctRecipients] = await Promise.all([
    prisma.emailCampaignDeliveryEvent.findFirst({
      where: {
        organizationId,
        campaignId: campaign.id,
      },
      orderBy: { eventAt: "desc" },
      select: { eventAt: true },
    }),
    prisma.emailCampaignDeliveryEvent.findMany({
      where: {
        organizationId,
        campaignId: campaign.id,
      },
      distinct: ["recipientEmail"],
      select: { recipientEmail: true },
    }),
  ]);

  const byType = Object.fromEntries(grouped.map((row) => [row.eventType, row._count.eventType])) as Record<string, number>;
  const delivered = byType.DELIVERED ?? 0;
  const opened = byType.OPENED ?? 0;
  const clicked = byType.CLICKED ?? 0;
  const bounced = byType.BOUNCED ?? 0;

  res.json({
    summary: {
      queued: byType.QUEUED ?? 0,
      delivered,
      opened,
      clicked,
      bounced,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickRate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
      bounceRate: delivered > 0 ? Math.round((bounced / delivered) * 100) : 0,
    },
    diagnostics: {
      providerWebhookConfigured: Boolean(EMAIL_CAMPAIGN_WEBHOOK_SECRET),
      lastEventAt: latestEvent?.eventAt ?? null,
      totalEvents: events.length,
      uniqueRecipients: distinctRecipients.length,
      deliveryToQueueRate: (byType.QUEUED ?? 0) > 0 ? Math.round((delivered / (byType.QUEUED ?? 0)) * 100) : 0,
      openToDeliveredRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickToOpenRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
    },
    events,
  });
});

/**
 * POST /api/email-campaigns/:id/delivery-events
 * Description: Records one per-recipient delivery event for provider webhooks or manual reconciliation.
 */
router.post("/:id/delivery-events", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, audienceFilter: true },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can write delivery events" } });
    return;
  }

  const { recipientEmail, eventType, metadata, eventAt } = req.body as {
    recipientEmail?: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
    eventAt?: string;
  };

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    res.status(400).json({ error: { code: "INVALID_RECIPIENT", message: "recipientEmail must be a valid email." } });
    return;
  }

  const safeType = parseDeliveryEventType(eventType);
  if (!safeType) {
    res.status(400).json({ error: { code: "INVALID_EVENT_TYPE", message: "eventType must be one of QUEUED, DELIVERED, OPENED, CLICKED, BOUNCED." } });
    return;
  }

  const safeEventAt = eventAt ? new Date(eventAt) : new Date();
  if (Number.isNaN(safeEventAt.getTime())) {
    res.status(400).json({ error: { code: "INVALID_EVENT_AT", message: "eventAt must be a valid ISO datetime." } });
    return;
  }
  const metadataInput = metadata as Prisma.InputJsonValue | undefined;

  const event = await prisma.emailCampaignDeliveryEvent.upsert({
    where: {
      campaignId_recipientEmail_eventType: {
        campaignId: campaign.id,
        recipientEmail: recipientEmail.trim().toLowerCase(),
        eventType: safeType,
      },
    },
    update: {
      eventAt: safeEventAt,
      metadata: metadataInput,
    },
    create: {
      organizationId,
      campaignId: campaign.id,
      recipientEmail: recipientEmail.trim().toLowerCase(),
      eventType: safeType,
      eventAt: safeEventAt,
      metadata: metadataInput,
    },
  });

  await recalculateCampaignDeliveryStats(campaign.id);

  res.status(201).json(event);
});

/**
 * POST /api/email-campaigns/audience-preview
 * Description: Returns audience eligibility counts used in send confirmations.
 * Request: { audienceFilter?: { type?: string } }
 * Response: { audience: { totalMatched, validEmail, missingEmail, optedOut, duplicateEmails, finalSendCount } }
 */
router.post("/audience-preview", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      audience: {
        totalMatched: 0,
        validEmail: 0,
        missingEmail: 0,
        optedOut: 0,
        duplicateEmails: 0,
        suppressionCount: 0,
        categoryOptOut: 0,
        doNotContact: 0,
        invalidEmail: 0,
        suppressed: 0,
        finalSendCount: 0,
      },
      recipientsSample: [],
    });
    return;
  }

  const filter = (req.body?.audienceFilter ?? null) as AudienceFilter;
  const purpose = parseEmailPurpose(req.body?.purpose);
  const rows = await getAudienceConstituents(filter, organizationId);
  const preview = await computeAudiencePreview(rows, organizationId, purpose);

  res.json({
    audience: {
      totalMatched: preview.totalMatched,
      validEmail: preview.validEmail,
      missingEmail: preview.missingEmail,
      optedOut: preview.optedOut,
      duplicateEmails: preview.duplicateEmails,
      suppressionCount: preview.suppressionCount,
      categoryOptOut: preview.categoryOptOut,
      doNotContact: preview.doNotContact,
      invalidEmail: preview.invalidEmail,
      suppressed: preview.suppressed,
      finalSendCount: preview.finalSendCount,
    },
    recipientsSample: preview.recipients.slice(0, 25),
  });
});

/** GET /api/email-campaigns — List email campaigns with optional status and name search filters. */
router.get("/", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const { status, search, limit = "50" } = req.query as Record<string, string>;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      organizationId,
      ...(status && { status: status as never }),
      ...(search && { name: { contains: search } }),
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(parseInt(limit), 200),
  });

  const visible = campaigns
    .filter((campaign) => canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role))
    .map((campaign) => {
      const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
      return {
        ...campaign,
        ownerId: parsed.sharing.ownerId,
        sharedWithOrganization: parsed.sharing.sharedWithOrganization,
        preparationStatus: parsed.workflow.preparationStatus,
      };
    });

  res.json(visible);
});

/** GET /api/email-campaigns/stats — Aggregate email engagement metrics (total, sent, open rate, etc.) across all campaigns. */
router.get("/stats", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      total: 0,
      sent: 0,
      scheduled: 0,
      draft: 0,
      totalRecipientsSent: 0,
      avgOpenRate: 0,
    });
    return;
  }

  const campaigns = await prisma.emailCampaign.findMany({
    where: { organizationId },
    select: {
      status: true,
      audienceFilter: true,
      totalRecipients: true,
      opened: true,
      clicked: true,
      delivered: true,
    },
  });

  const visible = campaigns.filter((campaign) =>
    canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)
  );
  const sent = visible.filter((campaign) => campaign.status === "SENT");
  const scheduled = visible.filter((campaign) => campaign.status === "SCHEDULED").length;
  const draft = visible.filter((campaign) => campaign.status === "DRAFT").length;

  // Compute aggregate open rate from all sent campaigns
  const totalSent = sent.reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalOpened = sent.reduce((sum, c) => sum + c.opened, 0);
  const totalDelivered = sent.reduce((sum, c) => sum + c.delivered, 0);
  const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;

  res.json({
    total: visible.length,
    sent: sent.length,
    scheduled,
    draft,
    totalRecipientsSent: totalSent,
    avgOpenRate,
  });
});

/** GET /api/email-campaigns/lists — List saved recipient lists with recipient counts. */
router.get("/lists", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const lists = await prisma.emailRecipientList.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { recipients: true },
      },
    },
  });

  res.json(lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    createdById: list.createdById,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    recipientsCount: list._count.recipients,
  })));
});

/** GET /api/email-campaigns/lists/:listId — One saved list including recipient emails. */
router.get("/lists/:listId", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const list = await prisma.emailRecipientList.findFirst({
    where: {
      id: req.params.listId,
      organizationId,
    },
    include: {
      recipients: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!list) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Saved recipient list not found." } });
    return;
  }

  res.json(list);
});

/** POST /api/email-campaigns/lists — Create a saved list with recipient emails. */
router.post("/lists", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { name, description, recipientEmails } = req.body as {
    name?: string;
    description?: string;
    recipientEmails?: string[];
  };

  const safeName = (name ?? "").trim();
  if (!safeName) {
    res.status(400).json({ error: { code: "INVALID_NAME", message: "List name is required." } });
    return;
  }

  const recipients = normalizeRecipientEmails(recipientEmails);

  const created = await prisma.emailRecipientList.create({
    data: {
      organizationId,
      name: safeName,
      description: description?.trim() || null,
      createdById: userId,
      recipients: {
        createMany: {
          data: recipients.map((email) => ({ email })),
          skipDuplicates: true,
        },
      },
    },
    include: {
      _count: {
        select: { recipients: true },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_RECIPIENT_LIST_CREATED",
      entity: "EmailRecipientList",
      entityId: created.id,
      metadata: { recipientsCount: created._count.recipients },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    description: created.description,
    createdById: created.createdById,
    recipientsCount: created._count.recipients,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  });
});

/** PUT /api/email-campaigns/lists/:listId — Rename/update a saved list and optionally replace recipients. */
router.put("/lists/:listId", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.emailRecipientList.findFirst({
    where: {
      id: req.params.listId,
      organizationId,
    },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Saved recipient list not found." } });
    return;
  }

  const { name, description, recipientEmails } = req.body as {
    name?: string;
    description?: string;
    recipientEmails?: string[];
  };

  const safeName = typeof name === "string" ? name.trim() : undefined;
  if (safeName !== undefined && !safeName) {
    res.status(400).json({ error: { code: "INVALID_NAME", message: "List name cannot be empty." } });
    return;
  }

  if (recipientEmails) {
    const normalized = normalizeRecipientEmails(recipientEmails);
    await prisma.emailRecipientListMember.deleteMany({ where: { listId: existing.id } });
    if (normalized.length > 0) {
      await prisma.emailRecipientListMember.createMany({
        data: normalized.map((email) => ({ listId: existing.id, email })),
        skipDuplicates: true,
      });
    }
  }

  const updated = await prisma.emailRecipientList.update({
    where: { id: existing.id },
    data: {
      ...(safeName !== undefined ? { name: safeName } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    },
    include: {
      _count: {
        select: { recipients: true },
      },
    },
  });

  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    createdById: updated.createdById,
    recipientsCount: updated._count.recipients,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

/** DELETE /api/email-campaigns/lists/:listId — Remove a saved recipient list and all members. */
router.delete("/lists/:listId", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.emailRecipientList.findFirst({
    where: {
      id: req.params.listId,
      organizationId,
    },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Saved recipient list not found." } });
    return;
  }

  await prisma.emailRecipientList.delete({ where: { id: existing.id } });
  res.status(204).send();
});

/** GET /api/email-campaigns/:id — Fetch a single email campaign by ID. */
router.get("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canAccessCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this campaign" } });
    return;
  }

  res.json({
    ...campaign,
    ownerId: parsed.sharing.ownerId,
    sharedWithOrganization: parsed.sharing.sharedWithOrganization,
    preparationStatus: parsed.workflow.preparationStatus,
  });
});

/**
 * POST /api/email-campaigns — Create a new email campaign.
 * Status is automatically set to "SCHEDULED" if `scheduledAt` is provided, otherwise "DRAFT".
 */
router.post("/", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const {
    name, subject, previewText, fromName, fromEmail, replyToEmail,
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter, sharedWithOrganization = false, preparationStatus,
  } = req.body;
  const purpose = parseEmailPurpose(req.body?.purpose);
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: "No organization is configured for this installation." });
    return;
  }

  if (fromEmail && !isValidEmail(fromEmail)) {
    res.status(400).json({ error: "fromEmail must be a valid email address." });
    return;
  }
  if (replyToEmail && !isValidEmail(replyToEmail)) {
    res.status(400).json({ error: "replyToEmail must be a valid email address." });
    return;
  }

  const defaultPreparationStatus = bodyHtml || bodyText || templateJson ? "DRAFT" : "NOT_STARTED";

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: name ?? "Untitled Campaign",
      subject: subject ?? "",
      purpose,
      previewText, fromName, fromEmail, replyToEmail,
      bodyHtml, bodyText,
      templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      // Serialize audience filter criteria and sharing visibility together.
      audienceFilter: serializeCampaignAudienceFilter(
        (audienceFilter ?? null) as AudienceFilter,
        userId,
        Boolean(sharedWithOrganization),
        normalizePreparationStatus(preparationStatus, defaultPreparationStatus),
      ),
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_CREATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: {
        status: campaign.status,
        purpose: campaign.purpose,
      },
    },
  }).catch(() => {
    // Best-effort logging for revision-history surfaces.
  });

  res.status(201).json(campaign);
});

/** PUT /api/email-campaigns/:id — Update campaign content, scheduling, or audience filter. */
router.put("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const {
    name, subject, previewText, fromName, fromEmail, replyToEmail,
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter, status, sharedWithOrganization, preparationStatus,
  } = req.body;

  const existing = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsedExisting = parseCampaignAudienceFilter(existing.audienceFilter);
  if (!canManageCampaign(parsedExisting.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can edit this campaign" } });
    return;
  }

  const ownerId = parsedExisting.sharing.ownerId ?? userId;
  const nextPurpose = req.body?.purpose !== undefined
    ? parseEmailPurpose(req.body?.purpose, parseEmailPurpose((existing as { purpose?: unknown }).purpose))
    : parseEmailPurpose((existing as { purpose?: unknown }).purpose);
  const nextSharing = typeof sharedWithOrganization === "boolean"
    ? sharedWithOrganization
    : parsedExisting.sharing.sharedWithOrganization;
  const nextPreparationStatus = normalizePreparationStatus(preparationStatus, parsedExisting.workflow.preparationStatus);
  const nextFilter = audienceFilter !== undefined
    ? (audienceFilter as AudienceFilter)
    : parsedExisting.filter;

  const campaign = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      name, subject, previewText, fromName, fromEmail, replyToEmail,
      purpose: nextPurpose,
      bodyHtml, bodyText, templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      audienceFilter: serializeCampaignAudienceFilter(nextFilter, ownerId, nextSharing, nextPreparationStatus),
      status,
    },
  });

  const changedFields = [
    "name", "subject", "previewText", "fromName", "fromEmail", "replyToEmail",
    "purpose", "bodyHtml", "bodyText", "templateJson", "scheduledAt", "audienceFilter",
    "status", "sharedWithOrganization", "preparationStatus",
  ].filter((field) => Object.prototype.hasOwnProperty.call(req.body ?? {}, field));

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: {
        changedFields,
        status: campaign.status,
      },
    },
  }).catch(() => {
    // Best-effort logging for revision-history surfaces.
  });

  res.json({
    ...campaign,
    ownerId,
    sharedWithOrganization: nextSharing,
    preparationStatus: nextPreparationStatus,
  });
});

/**
 * POST /api/email-campaigns/:id/preview
 * Description: Returns an HTML/text preview payload for review tooling without sending.
 * Request: {}
 * Response: { id, subject, previewText, fromName, fromEmail, bodyHtml, bodyText }
 */
router.post("/:id/preview", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this campaign" } });
    return;
  }

  res.json({
    id: campaign.id,
    subject: campaign.subject,
    previewText: campaign.previewText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    bodyHtml: campaign.bodyHtml,
    bodyText: campaign.bodyText,
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
  });
});

/**
 * POST /api/email-campaigns/:id/send-test
 * Description: Sends a single test email for campaign review without changing campaign send stats.
 * Request: { toEmail: string }
 * Response: { success: true }
 */
router.post("/:id/send-test", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const { toEmail } = req.body as { toEmail?: string };
  if (!toEmail || !isValidEmail(toEmail)) {
    res.status(400).json({ error: "toEmail is required and must be valid." });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can send test emails" } });
    return;
  }

  try {
    const sender = await createOrganizationEmailSender(campaign.organizationId);
    const purpose = parseEmailPurpose((campaign as { purpose?: unknown }).purpose);
    const deliveryBodies = buildCampaignDeliveryBodies(campaign, purpose);
    const shouldIssueLinks =
      requiresPreferenceCompliance(purpose)
      || COMPLIANCE_TOKEN_PATTERN.test(deliveryBodies.html)
      || COMPLIANCE_TOKEN_PATTERN.test(deliveryBodies.text);

    let htmlContent = deliveryBodies.html;
    let textContent = deliveryBodies.text;
    if (shouldIssueLinks) {
      const links = await issueRecipientComplianceLinks({
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        email: toEmail.trim().toLowerCase(),
        category: categoryForPurpose(purpose),
      });
      htmlContent = applyComplianceLinkTokens(htmlContent, links);
      textContent = applyComplianceLinkTokens(textContent, links);
    }

    await sender.send({
      to: toEmail.trim().toLowerCase(),
      subject: `[TEST] ${campaign.subject || campaign.name}`,
      text: textContent,
      html: htmlContent,
      fromNameOverride: campaign.fromName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outbound email provider is not ready.";
    res.status(400).json({ error: message });
    return;
  }

  await prisma.auditLog.create({
    data: {
      organizationId: campaign.organizationId,
      action: "EMAIL_CAMPAIGN_TEST_SENT",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { toEmail: toEmail.trim().toLowerCase() },
    },
  });

  res.json({ success: true });
});

/**
 * POST /api/email-campaigns/:id/schedule
 * Description: Schedules or reschedules a campaign send time and marks status as SCHEDULED.
 * Request: { scheduledAt: ISO string, timezone?: string }
 * Response: campaign
 */
router.post("/:id/schedule", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const { scheduledAt, timezone } = req.body as { scheduledAt?: string; timezone?: string };
  if (!scheduledAt) {
    res.status(400).json({ error: "scheduledAt is required." });
    return;
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
    res.status(400).json({ error: "scheduledAt must be a valid future datetime." });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can schedule this campaign" } });
    return;
  }

  const schedulePurpose = parseEmailPurpose((campaign as { purpose?: unknown }).purpose);
  const scheduleBodies = buildCampaignDeliveryBodies(campaign, schedulePurpose);
  const scheduleComplianceIssues = getCampaignComplianceIssues({
    purpose: schedulePurpose,
    subject: campaign.subject,
    bodyHtml: scheduleBodies.html,
    bodyText: scheduleBodies.text,
    fromEmail: campaign.fromEmail,
    replyToEmail: campaign.replyToEmail,
  });
  if (scheduleComplianceIssues.length > 0) {
    res.status(400).json({
      error: {
        code: "CAMPAIGN_NOT_READY",
        message: `Campaign failed compliance checks: ${scheduleComplianceIssues.join(" ")}`,
      },
    });
    return;
  }

  const updated = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      status: "SCHEDULED",
      scheduledAt: scheduledDate,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: campaign.organizationId,
      action: "EMAIL_CAMPAIGN_SCHEDULED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { scheduledAt: scheduledDate.toISOString(), timezone: timezone ?? "UTC" },
    },
  });

  res.json(updated);
});

/**
 * POST /api/email-campaigns/:id/cancel
 * Description: Cancels a scheduled campaign and clears the scheduled send time.
 * Request: {}
 * Response: campaign
 */
router.post("/:id/cancel", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can cancel this campaign" } });
    return;
  }

  if (campaign.status !== "SCHEDULED") {
    res.status(400).json({ error: "Only scheduled campaigns can be cancelled." });
    return;
  }

  const updated = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      status: "CANCELLED",
      scheduledAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: campaign.organizationId,
      action: "EMAIL_CAMPAIGN_CANCELLED",
      entity: "EmailCampaign",
      entityId: campaign.id,
    },
  });

  res.json(updated);
});

/**
 * POST /api/email-campaigns/:id/send — Send a campaign to opted-in constituents via SMTP.
 * Uses the shared send helper so manual and queued sending stay aligned.
 */
router.post("/:id/send", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const role = req.user?.role;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId || !organizationId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const campaign = await prisma.emailCampaign.findFirst({
      where: {
        id: req.params.id,
        organizationId,
      },
      select: { id: true, audienceFilter: true },
    });
    if (!campaign) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
      return;
    }
    if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can send this campaign" } });
      return;
    }

    const body = (req.body ?? {}) as {
      sendMode?: CampaignSendMode;
      audienceFilter?: AudienceFilter;
      recipientListId?: string;
      recipientEmails?: string[];
    };

    const sendOptions: CampaignSendOptions = {
      sendMode: body.sendMode,
      audienceFilter: body.audienceFilter,
      recipientListId: typeof body.recipientListId === "string" ? body.recipientListId : undefined,
      recipientEmails: Array.isArray(body.recipientEmails) ? body.recipientEmails : undefined,
    };

    const updated = await sendCampaignNow(req.params.id as string, "MANUAL", sendOptions);
    res.json(updated);
  } catch (err) {
    if (err instanceof CampaignSendError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[email-campaigns] POST /:id/send error:", err);
    res.status(500).json({ error: "Failed to send campaign." });
  }
});

/** DELETE /api/email-campaigns/:id — Permanently delete an email campaign (owner/admin). */
router.delete("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, audienceFilter: true },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }
  if (!canManageCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can delete this campaign" } });
    return;
  }

  await prisma.emailCampaign.delete({ where: { id: campaign.id } });
  res.status(204).send();
});

export default router;
