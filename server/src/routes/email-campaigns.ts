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
 *   POST   /api/email-campaigns/:id/send — trigger campaign send
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
import { loadOrganizationBrandingContext } from "../services/organization-branding.js";
import {
  buildEmailMergePreviewWarnings,
  findUnsupportedEmailMergeTokens,
} from "../services/oyama-email/merge-field-catalog.js";
import {
  applyMergeTokens,
  normalizeEmailTemplateDocument,
  normalizeEmailTemplateSettings,
  renderEmailTemplateDocument,
  type OyamaEmailGlobalChrome,
} from "../services/oyama-email/email-render-service.js";
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
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (normalized === "QUEUED" || normalized === "PROCESSED" || normalized === "ACCEPTED") return "QUEUED";
  if (normalized === "DELIVERED") return "DELIVERED";
  if (normalized === "OPEN" || normalized === "OPENED") return "OPENED";
  if (normalized === "CLICK" || normalized === "CLICKED") return "CLICKED";
  if (normalized === "BOUNCE" || normalized === "BOUNCED" || normalized === "DROPPED" || normalized === "DEFERRED") return "BOUNCED";
  return null;
}

/** True when provider event indicates recipient opted out/unsubscribed. */
function isProviderUnsubscribeEvent(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!normalized) return false;
  return normalized === "UNSUBSCRIBE"
    || normalized === "UNSUBSCRIBED"
    || normalized === "OPT_OUT"
    || normalized === "OPTOUT"
    || normalized === "LIST_UNSUBSCRIBE"
    || normalized === "UNSUBSCRIPTION";
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

/** Returns the first non-empty string value from a candidate list. */
function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Returns the first finite positive number from a candidate list. */
function firstPositiveNumber(values: unknown[]): number | null {
  for (const value of values) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) continue;
    if (numeric > 0) return Math.floor(numeric);
  }
  return null;
}

/** Merges webhook fields and event metadata into one normalized queue/event metadata payload. */
function buildDeliveryEventMetadata(item: DeliveryWebhookPayload, mappedEventType: DeliveryEventType, eventAt: Date): Prisma.InputJsonValue {
  const incoming = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? { ...(item.metadata as Record<string, unknown>) }
    : {};

  const providerResponse = firstString([
    incoming.providerResponse,
    incoming.smtpResponse,
    incoming.response,
    (item as { providerResponse?: unknown }).providerResponse,
    (item as { smtpResponse?: unknown }).smtpResponse,
    (item as { response?: unknown }).response,
  ]);

  const providerMessageId = firstString([
    incoming.providerMessageId,
    incoming.messageId,
    incoming.providerEventId,
    (item as { providerMessageId?: unknown }).providerMessageId,
    (item as { messageId?: unknown }).messageId,
    (item as { providerEventId?: unknown }).providerEventId,
  ]);

  const attemptCount = firstPositiveNumber([
    incoming.attemptCount,
    incoming.attempt,
    incoming.attempts,
    (item as { attemptCount?: unknown }).attemptCount,
    (item as { attempts?: unknown }).attempts,
  ]);

  const rawSentAt = firstString([
    incoming.sentAt,
    (item as { sentAt?: unknown }).sentAt,
  ]);
  const sentAt = rawSentAt ? parseWebhookEventAt(rawSentAt).toISOString() : eventAt.toISOString();

  return {
    ...incoming,
    rawEventType: typeof item.eventType === "string" ? item.eventType : item.event,
    normalizedEventType: mappedEventType,
    source: "provider_webhook",
    ...(providerResponse ? { providerResponse } : {}),
    ...(providerMessageId ? { providerMessageId } : {}),
    ...(attemptCount ? { attemptCount } : {}),
    sentAt,
  } as Prisma.InputJsonValue;
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
    : rawBody && typeof rawBody === "object" && "events" in rawBody && Array.isArray(rawBody.events)
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
    const rawEventType = item?.eventType ?? item?.event;
    const mappedEventType = mapProviderEventType(rawEventType);
    const unsubscribeEvent = isProviderUnsubscribeEvent(rawEventType);

    if (!campaignId) {
      errors.push({ index, reason: "campaignId is required" });
      continue;
    }
    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      errors.push({ index, reason: "recipientEmail must be a valid email" });
      continue;
    }
    if (!mappedEventType && !unsubscribeEvent) {
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

    if (unsubscribeEvent) {
      const subscription = await prisma.emailSubscription.upsert({
        where: {
          organizationId_email: {
            organizationId,
            email: recipientEmail,
          },
        },
        create: {
          organizationId,
          email: recipientEmail,
          globalStatus: "UNSUBSCRIBED",
          unsubscribedAt: safeEventAt,
          source: "provider-webhook",
        },
        update: {
          globalStatus: "UNSUBSCRIBED",
          unsubscribedAt: safeEventAt,
          source: "provider-webhook",
        },
        select: {
          id: true,
          constituentId: true,
        },
      });

      await prisma.emailConsentEvent.create({
        data: {
          organizationId,
          subscriptionId: subscription.id,
          constituentId: subscription.constituentId,
          email: recipientEmail,
          eventType: "OPT_OUT",
          source: "provider-webhook",
          metadata: {
            campaignId,
            rawEventType: typeof rawEventType === "string" ? rawEventType : null,
            eventAt: safeEventAt.toISOString(),
          },
        },
      });

      touchedCampaigns.add(campaignId);
      processed += 1;
      continue;
    }

    if (!mappedEventType) {
      errors.push({ index, reason: "eventType/event is unsupported" });
      continue;
    }

    const metadataInput = buildDeliveryEventMetadata(item, mappedEventType, safeEventAt);

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

    if (mappedEventType === "QUEUED") {
      await prisma.emailSendRecipient.updateMany({
        where: {
          campaignId,
          email: recipientEmail,
        },
        data: {
          sentAt: safeEventAt,
        },
      });
    }

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

type CampaignQueueState = "ACTIVE" | "PAUSED";

type CampaignWorkspaceStatus =
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "READY"
  | "SCHEDULED"
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "ARCHIVED";

interface CampaignTemplateSnapshot {
  templateId: string | null;
  templateVersion: string | null;
  templateName: string | null;
}

interface CampaignWorkflowSettings {
  preparationStatus: CampaignPreparationStatus;
  needsReview: boolean;
  archivedAt: string | null;
  archivedById: string | null;
  queueState: CampaignQueueState;
  lastQueueActionAt: string | null;
  lastQueueActionById: string | null;
  templateSnapshot: CampaignTemplateSnapshot | null;
}

const CAMPAIGN_PREPARATION_STATUSES: CampaignPreparationStatus[] = ["NOT_STARTED", "DRAFT", "READY"];
const CAMPAIGN_QUEUE_STATES: CampaignQueueState[] = ["ACTIVE", "PAUSED"];
const CAMPAIGN_WORKSPACE_STATUSES: CampaignWorkspaceStatus[] = [
  "DRAFT",
  "NEEDS_REVIEW",
  "READY",
  "SCHEDULED",
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
];

const DEFAULT_CAMPAIGN_WORKFLOW: CampaignWorkflowSettings = {
  preparationStatus: "DRAFT",
  needsReview: false,
  archivedAt: null,
  archivedById: null,
  queueState: "ACTIVE",
  lastQueueActionAt: null,
  lastQueueActionById: null,
  templateSnapshot: null,
};

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

interface CampaignQueueRow {
  recipientLabel: string;
  email: string;
  status: string;
  lastEvent: string;
  attemptCount: string;
  providerResponse: string;
  queuedAt: string;
  sendingStartedAt: string;
  sentAt: string;
  deliveredAt: string;
  openedAt: string;
  clickedAt: string;
  bouncedAt: string;
  unsubscribedAt: string;
  failureReason: string;
}

interface CampaignLiveSnapshotPayload {
  campaignId: string;
  delivery: {
    summary: {
      eligibleRecipients: number;
      processedRecipients: number;
      sendProgressPercent: number;
      queued: number;
      sending: number;
      accepted: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      failed: number;
      suppressed: number;
      unsubscribed: number;
      cancelled: number;
      remaining: number;
      openRate: number;
      clickRate: number;
      bounceRate: number;
    };
    diagnostics: {
      providerWebhookConfigured: boolean;
      lastEventAt: Date | null;
      totalEvents: number;
      uniqueRecipients: number;
      deliveryToQueueRate: number;
      openToDeliveredRate: number;
      clickToOpenRate: number;
    };
    events: Array<{
      id: string;
      recipientEmail: string;
      eventType: string;
      eventAt: Date;
      metadata: Prisma.JsonValue | null;
    }>;
  } | null;
  activity: Array<{
    id: string;
    action: string;
    createdAt: Date;
    metadata: Prisma.JsonValue;
    user: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  queueRows: CampaignQueueRow[];
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

function buildCampaignDeliveryBodies(
  campaign: { id?: string; name?: string | null; bodyHtml: string | null; bodyText: string | null; templateJson?: string | null },
  purpose: EmailPurpose,
  branding?: OyamaEmailGlobalChrome,
) {
  let baseHtml = campaign.bodyHtml?.trim() || `<p>${campaign.bodyText || "No content"}</p>`;
  let baseText = campaign.bodyText?.trim() || "No text content";
  let renderedThroughStructuredTemplate = false;

  if (campaign.templateJson?.trim()) {
    try {
      const parsed = JSON.parse(campaign.templateJson) as unknown;
      const parsedObj = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
      const templateSource = parsedObj.template ?? parsed;
      const settingsSource = parsedObj.settings ?? {};

      const rendered = renderEmailTemplateDocument(
        normalizeEmailTemplateDocument(templateSource),
        normalizeEmailTemplateSettings(settingsSource),
        branding,
      );

      baseHtml = rendered.html;
      baseText = rendered.text || baseText;
      renderedThroughStructuredTemplate = true;
    } catch (error) {
      console.warn("[email-campaigns] Template JSON render failed; falling back to branded legacy body wrapper.", {
        campaignId: campaign.id ?? null,
        campaignName: campaign.name ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!renderedThroughStructuredTemplate && branding) {
    const rendered = renderEmailTemplateDocument(
      normalizeEmailTemplateDocument({
        blocks: [{ id: "legacy_body", type: "html", html: baseHtml }],
        backgroundColor: branding.emailBackgroundColor,
        fontFamily: branding.emailFontFamily,
        contentWidth: branding.emailContentWidth,
        linkColor: branding.primaryColor,
      }),
      normalizeEmailTemplateSettings({
        includeUnsubscribeLink: true,
        includePhysicalAddress: true,
        enablePlainTextVersion: true,
      }),
      branding,
    );
    baseHtml = rendered.html;
    baseText = rendered.text || baseText;
  }

  if (!requiresPreferenceCompliance(purpose)) {
    return { html: baseHtml, text: baseText };
  }

  return {
    html: ensureComplianceFooter(baseHtml, "html"),
    text: ensureComplianceFooter(baseText, "text"),
  };
}

type CampaignPreviewMode = "audience-sample" | "manual-email" | "template-only";

type CampaignPreviewRecipient = {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

type CampaignMergeContext = {
  recipient: CampaignPreviewRecipient | null;
  vars: Record<string, string>;
};

function formatCampaignCurrency(value: Prisma.Decimal | number | null | undefined): string {
  const numeric = Number(value ?? Number.NaN);
  if (!Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatCampaignDate(value: Date | null | undefined): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatRecurringFrequencyLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized === "WEEKLY") return "Weekly";
  if (normalized === "MONTHLY") return "Monthly";
  if (normalized === "QUARTERLY") return "Quarterly";
  if (normalized === "ANNUALLY") return "Annual";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

function buildCampaignAddressBlock(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

async function buildCampaignMergeContext(params: {
  organizationId: string;
  recipientEmail: string;
  constituentId?: string | null;
  campaign: {
    id: string;
    name: string;
    fromName: string;
    fromEmail: string;
  };
}): Promise<CampaignMergeContext> {
  const recipientEmail = params.recipientEmail.trim().toLowerCase();
  const [organization, organizationSettings, constituent] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { name: true },
    }),
    prisma.organizationSettings.findUnique({
      where: { organizationId: params.organizationId },
      select: {
        smtpFromEmail: true,
        smtpFromName: true,
      },
    }),
    prisma.constituent.findFirst({
      where: {
        organizationId: params.organizationId,
        ...(params.constituentId ? { id: params.constituentId } : { email: recipientEmail }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        totalLifetimeGiving: true,
        totalYtdGiving: true,
        giftCount: true,
        firstGiftDate: true,
        lastGiftDate: true,
        lastGiftAmount: true,
      },
    }),
  ]);
  const branding = await loadOrganizationBrandingContext(params.organizationId, organization?.name?.trim() || "");

  const latestDonation = constituent
    ? await prisma.donation.findFirst({
        where: {
          constituentId: constituent.id,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: {
          amount: true,
          date: true,
          isRecurring: true,
          frequency: true,
          receiptNumber: true,
          taxDeductible: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              goal: true,
            },
          },
          event: {
            select: {
              name: true,
              startDate: true,
              location: true,
              city: true,
              state: true,
            },
          },
        },
      })
    : null;

  const campaignRaised = latestDonation?.campaignId
    ? await prisma.donation.aggregate({
        where: { campaignId: latestDonation.campaignId },
        _sum: { amount: true },
      })
    : null;
  const stewardEnrollment = constituent?.id
    ? await prisma.stewardPathEnrollment.findFirst({
        where: {
          organizationId: params.organizationId,
          constituentId: constituent.id,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          nextStepDueAt: true,
          path: { select: { name: true } },
          currentStep: { select: { name: true } },
        },
      })
    : null;

  const firstName = constituent?.firstName?.trim() || "";
  const lastName = constituent?.lastName?.trim() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const organizationName = branding.organizationName || organization?.name?.trim() || params.campaign.fromName.trim() || "Your organization";
  const staffName = params.campaign.fromName.trim() || organizationSettings?.smtpFromName?.trim() || organizationName;
  const staffEmail = params.campaign.fromEmail.trim() || organizationSettings?.smtpFromEmail?.trim() || "";
  const donationCampaignName = latestDonation?.campaign?.name?.trim() || "";
  const donationCampaignGoal = formatCampaignCurrency(latestDonation?.campaign?.goal ?? null);
  const donationCampaignRaised = formatCampaignCurrency(campaignRaised?._sum.amount ?? null);
  const campaignGoalAmount = Number(latestDonation?.campaign?.goal ?? Number.NaN);
  const campaignRaisedAmount = Number(campaignRaised?._sum.amount ?? Number.NaN);
  const progressPercent = Number.isFinite(campaignGoalAmount) && campaignGoalAmount > 0 && Number.isFinite(campaignRaisedAmount)
    ? `${Math.round((campaignRaisedAmount / campaignGoalAmount) * 100)}%`
    : "";
  const addressBlock = branding.addressLine || buildCampaignAddressBlock([]);
  const resolvedLastGiftAmount = formatCampaignCurrency(latestDonation?.amount ?? constituent?.lastGiftAmount ?? null);
  const resolvedLastGiftDate = formatCampaignDate(latestDonation?.date ?? constituent?.lastGiftDate ?? null);
  const donationAmount = formatCampaignCurrency(latestDonation?.amount ?? constituent?.lastGiftAmount ?? null);
  const taxDeductibleAmount = latestDonation?.taxDeductible
    ? donationAmount
    : latestDonation
      ? "$0.00"
      : "";
  const giftAmountType = latestDonation
    ? (latestDonation.isRecurring
      ? `Recurring${latestDonation.frequency ? ` (${formatRecurringFrequencyLabel(latestDonation.frequency)})` : ""}`
      : "One-time")
    : "";
  const previewRecipient = recipientEmail
    ? {
        email: constituent?.email?.trim() || recipientEmail,
        firstName,
        lastName,
        fullName,
      }
    : null;

  return {
    recipient: previewRecipient,
    vars: {
      firstName,
      lastName,
      fullName,
      preferredName: firstName || fullName || "Friend",
      householdGreeting: fullName || firstName || "Friend",
      email: constituent?.email?.trim() || recipientEmail,
      "donor.firstName": firstName,
      "donor.lastName": lastName,
      "donor.fullName": fullName,
      "donor.email": constituent?.email?.trim() || recipientEmail,
      "donor.totalYtdGiving": formatCampaignCurrency(constituent?.totalYtdGiving ?? null),
      "donor.totalLifetimeGiving": formatCampaignCurrency(constituent?.totalLifetimeGiving ?? null),
      "donor.giftCount": constituent?.giftCount != null ? String(constituent.giftCount) : "",
      "donor.firstGiftDate": formatCampaignDate(constituent?.firstGiftDate ?? null),
      "donor.lastGiftDate": resolvedLastGiftDate,
      "donor.lastGiftAmount": resolvedLastGiftAmount,
      lastGiftAmount: resolvedLastGiftAmount,
      lastGiftDate: resolvedLastGiftDate,
      totalYtdGiving: formatCampaignCurrency(constituent?.totalYtdGiving ?? null),
      totalLifetimeGiving: formatCampaignCurrency(constituent?.totalLifetimeGiving ?? null),
      giftCount: constituent?.giftCount != null ? String(constituent.giftCount) : "",
      firstGiftDate: formatCampaignDate(constituent?.firstGiftDate ?? null),
      "gift.amount": donationAmount,
      "gift.amountType": giftAmountType,
      "donation.amountType": giftAmountType,
      "gift.date": resolvedLastGiftDate,
      "gift.receiptNumber": latestDonation?.receiptNumber?.trim() || "",
      "gift.taxDeductibleAmount": taxDeductibleAmount,
      campaignName: donationCampaignName || params.campaign.name,
      campaignGoal: donationCampaignGoal,
      campaignRaised: donationCampaignRaised,
      campaignProgressPercent: progressPercent,
      campaignsSupported: donationCampaignName,
      "campaign.name": donationCampaignName || params.campaign.name,
      "campaign.goal": donationCampaignGoal,
      "campaign.raised": donationCampaignRaised,
      "campaign.progressPercent": progressPercent,
      organizationName,
      organizationPhone: branding.contactPhone,
      organizationWebsite: branding.websiteUrl,
      addressBlock,
      organizationTaxId: branding.taxId,
      "organization.name": organizationName,
      "organization.address": addressBlock,
      "organization.taxId": branding.taxId,
      staffName,
      staffTitle: branding.defaultSignerTitle,
      staffEmail,
      signatureName: staffName,
      "staff.name": staffName,
      "staff.email": staffEmail,
      unsubscribeUrl: "{{unsubscribeUrl}}",
      unsubscribe_url: "{{unsubscribeUrl}}",
      managePreferencesUrl: "{{managePreferencesUrl}}",
      preferencesUrl: "{{managePreferencesUrl}}",
      preferences_url: "{{managePreferencesUrl}}",
      receiptNumber: latestDonation?.receiptNumber?.trim() || "",
      currentYear: String(new Date().getFullYear()),
      currentDate: formatCampaignDate(new Date()),
      donationUrl: branding.websiteUrl,
      donationAmount,
      giftAmountType,
      taxDeductibleAmount,
      organizationAddress: addressBlock,
      "event.name": latestDonation?.event?.name?.trim() || "",
      "event.startDate": formatCampaignDate(latestDonation?.event?.startDate ?? null),
      "event.location": [latestDonation?.event?.location, latestDonation?.event?.city, latestDonation?.event?.state].filter(Boolean).join(", "),
      "stewardPath.name": stewardEnrollment?.path?.name?.trim() || "",
      "stewardPath.status": stewardEnrollment?.status || "",
      "stewardPath.currentStep": stewardEnrollment?.currentStep?.name?.trim() || "",
      "stewardPath.nextStepDueAt": formatCampaignDate(stewardEnrollment?.nextStepDueAt ?? null),
    },
  };
}

async function personalizeCampaignContent(params: {
  organizationId: string;
  category: EmailCategory;
  purpose: EmailPurpose;
  campaign: {
    id: string;
    name: string;
    subject: string;
    previewText: string | null;
    fromName: string;
    fromEmail: string;
  };
  deliveryBodies: {
    html: string;
    text: string;
  };
  mergeRecipientEmail: string;
  deliveryEmail?: string;
  constituentId?: string | null;
}): Promise<{
  recipient: CampaignPreviewRecipient | null;
  subject: string;
  previewText: string;
  html: string;
  text: string;
}> {
  const mergeContext = await buildCampaignMergeContext({
    organizationId: params.organizationId,
    recipientEmail: params.mergeRecipientEmail,
    constituentId: params.constituentId,
    campaign: params.campaign,
  });

  let subject = applyMergeTokens(params.campaign.subject || params.campaign.name, mergeContext.vars);
  const previewText = applyMergeTokens(params.campaign.previewText?.trim() || "", mergeContext.vars);
  let html = applyMergeTokens(params.deliveryBodies.html, mergeContext.vars);
  let text = applyMergeTokens(params.deliveryBodies.text, mergeContext.vars);

  const shouldIssueLinks =
    requiresPreferenceCompliance(params.purpose)
    || COMPLIANCE_TOKEN_PATTERN.test(params.deliveryBodies.html)
    || COMPLIANCE_TOKEN_PATTERN.test(params.deliveryBodies.text);

  if (shouldIssueLinks) {
    const links = await issueRecipientComplianceLinks({
      organizationId: params.organizationId,
      campaignId: params.campaign.id,
      email: (params.deliveryEmail ?? params.mergeRecipientEmail).trim().toLowerCase(),
      category: params.category,
    });
    html = applyComplianceLinkTokens(html, links);
    text = applyComplianceLinkTokens(text, links);
  }

  if (!subject.trim()) {
    subject = params.campaign.name;
  }

  return {
    recipient: mergeContext.recipient,
    subject,
    previewText,
    html,
    text,
  };
}

async function resolveCampaignPreviewTarget(params: {
  organizationId: string;
  purpose: EmailPurpose;
  audienceFilter: string | null;
  recipientEmail?: string | null;
}): Promise<{
  mode: CampaignPreviewMode;
  recipientEmail: string | null;
  constituentId: string | null;
}> {
  const requestedEmail = params.recipientEmail?.trim().toLowerCase() || "";
  if (requestedEmail) {
    const matchingConstituent = await prisma.constituent.findFirst({
      where: {
        organizationId: params.organizationId,
        email: requestedEmail,
      },
      select: { id: true },
    });

    return {
      mode: "manual-email",
      recipientEmail: requestedEmail,
      constituentId: matchingConstituent?.id ?? null,
    };
  }

  const recipientPlan = await resolveRecipientPlan({
    organizationId: params.organizationId,
    audienceFilter: params.audienceFilter,
    purpose: params.purpose,
  });
  const sampleEmail = recipientPlan.recipients[0] ?? null;
  const sampleDecision = sampleEmail
    ? recipientPlan.decisions.find((decision) => decision.email === sampleEmail)
    : null;

  return {
    mode: sampleEmail ? "audience-sample" : "template-only",
    recipientEmail: sampleEmail,
    constituentId: sampleDecision?.constituentId ?? null,
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

    if (sendMode === "INDIVIDUAL" && recipients.length !== 1) {
      throw new CampaignSendError("INDIVIDUAL send mode requires exactly one recipient email.", 400);
    }

    if (sendMode === "LIST" && recipients.length <= 1) {
      throw new CampaignSendError("LIST send mode requires at least two recipient emails.", 400);
    }

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

function normalizeQueueState(raw: unknown, fallback: CampaignQueueState = "ACTIVE"): CampaignQueueState {
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toUpperCase() as CampaignQueueState;
  return CAMPAIGN_QUEUE_STATES.includes(normalized) ? normalized : fallback;
}

function normalizeTemplateSnapshot(raw: unknown): CampaignTemplateSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const templateId = typeof value.templateId === "string" ? value.templateId.trim() : "";
  const templateVersion = typeof value.templateVersion === "string" ? value.templateVersion.trim() : "";
  const templateName = typeof value.templateName === "string" ? value.templateName.trim() : "";
  if (!templateId && !templateVersion && !templateName) return null;
  return {
    templateId: templateId || null,
    templateVersion: templateVersion || null,
    templateName: templateName || null,
  };
}

function normalizeCampaignWorkflow(
  raw: unknown,
  fallback: CampaignWorkflowSettings = DEFAULT_CAMPAIGN_WORKFLOW,
): CampaignWorkflowSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...fallback };
  }
  const value = raw as Record<string, unknown>;
  return {
    preparationStatus: normalizePreparationStatus(value.preparationStatus, fallback.preparationStatus),
    needsReview: typeof value.needsReview === "boolean" ? value.needsReview : fallback.needsReview,
    archivedAt: typeof value.archivedAt === "string" && value.archivedAt.trim() ? value.archivedAt.trim() : fallback.archivedAt,
    archivedById: typeof value.archivedById === "string" && value.archivedById.trim() ? value.archivedById.trim() : fallback.archivedById,
    queueState: normalizeQueueState(value.queueState, fallback.queueState),
    lastQueueActionAt:
      typeof value.lastQueueActionAt === "string" && value.lastQueueActionAt.trim()
        ? value.lastQueueActionAt.trim()
        : fallback.lastQueueActionAt,
    lastQueueActionById:
      typeof value.lastQueueActionById === "string" && value.lastQueueActionById.trim()
        ? value.lastQueueActionById.trim()
        : fallback.lastQueueActionById,
    templateSnapshot: normalizeTemplateSnapshot(value.templateSnapshot) ?? fallback.templateSnapshot,
  };
}

function withWorkflow(
  workflow: Partial<CampaignWorkflowSettings> | null | undefined,
  fallback: CampaignWorkflowSettings = DEFAULT_CAMPAIGN_WORKFLOW,
): CampaignWorkflowSettings {
  return normalizeCampaignWorkflow({ ...fallback, ...(workflow ?? {}) }, fallback);
}

/** Parse audienceFilter JSON into filter + sharing/workflow settings with safe defaults. */
function parseCampaignAudienceFilter(
  raw: string | null,
): { filter: AudienceFilter; sharing: CampaignSharingSettings; workflow: CampaignWorkflowSettings } {
  if (!raw) {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
      workflow: { ...DEFAULT_CAMPAIGN_WORKFLOW },
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

    const filter = { ...parsed };
    delete filter._sharing;
    delete filter._workflow;
    const hasFilterKeys = Object.keys(filter).length > 0;

    return {
      filter: hasFilterKeys ? filter as AudienceFilter : null,
      sharing: {
        ownerId: sharingObj && typeof sharingObj.ownerId === "string" ? sharingObj.ownerId : null,
        sharedWithOrganization:
          sharingObj && typeof sharingObj.sharedWithOrganization === "boolean"
            ? sharingObj.sharedWithOrganization
            : true,
      },
      workflow: normalizeCampaignWorkflow(workflowObj, DEFAULT_CAMPAIGN_WORKFLOW),
    };
  } catch {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
      workflow: { ...DEFAULT_CAMPAIGN_WORKFLOW },
    };
  }
}

/** Serialize filter payload back into audienceFilter JSON while preserving sharing metadata. */
function serializeCampaignAudienceFilter(
  filter: AudienceFilter,
  ownerId: string,
  sharedWithOrganization: boolean,
  workflowOrPreparation: CampaignWorkflowSettings | CampaignPreparationStatus,
): string {
  const safeFilter = filter && typeof filter === "object" ? { ...filter } : {};
  const workflow = typeof workflowOrPreparation === "string"
    ? withWorkflow({ preparationStatus: normalizePreparationStatus(workflowOrPreparation, "DRAFT") })
    : withWorkflow(workflowOrPreparation);

  return JSON.stringify({
    ...safeFilter,
    _sharing: {
      ownerId,
      sharedWithOrganization,
    },
    _workflow: workflow,
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

/** Upserts one per-recipient event row while preserving uniqueness by campaign+recipient+type. */
async function upsertDeliveryEvent(params: {
  organizationId: string;
  campaignId: string;
  recipientEmail: string;
  eventType: DeliveryEventType;
  eventAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const safeRecipientEmail = params.recipientEmail.trim().toLowerCase();
  if (!safeRecipientEmail) return;

  await prisma.emailCampaignDeliveryEvent.upsert({
    where: {
      campaignId_recipientEmail_eventType: {
        campaignId: params.campaignId,
        recipientEmail: safeRecipientEmail,
        eventType: params.eventType,
      },
    },
    update: {
      eventAt: params.eventAt ?? new Date(),
      metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
    },
    create: {
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      recipientEmail: safeRecipientEmail,
      eventType: params.eventType,
      eventAt: params.eventAt ?? new Date(),
      metadata: (params.metadata ?? null) as Prisma.InputJsonValue,
    },
  });
}

function resolveQueueStatusFromEvents(params: {
  eventTypes: Set<string>;
  eligibilityStatus: EmailRecipientEligibilityStatus;
  ineligibilityReason: string | null;
  sentAt: Date | null;
  unsubscribedAt: Date | null;
}): string {
  if (params.unsubscribedAt) return "UNSUBSCRIBED";

  if (!params.sentAt && params.ineligibilityReason?.startsWith("SMTP_SEND_FAILED")) {
    return "FAILED";
  }

  const eventTypes = params.eventTypes;
  if (eventTypes.has("BOUNCED")) return "BOUNCED";
  if (eventTypes.has("CLICKED")) return "CLICKED";
  if (eventTypes.has("OPENED")) return "OPENED";
  if (eventTypes.has("DELIVERED")) return "DELIVERED";
  if (eventTypes.has("QUEUED")) return "QUEUED";
  if (params.sentAt) return "SENT";
  if (params.ineligibilityReason?.startsWith("SMTP_SENDING")) return "SENDING";

  if (params.eligibilityStatus === "SKIPPED_SUPPRESSED") return "SUPPRESSED";
  if (params.eligibilityStatus === "SKIPPED_UNSUBSCRIBED" || params.eligibilityStatus === "SKIPPED_CATEGORY_OPT_OUT") return "UNSUBSCRIBED";
  if (params.eligibilityStatus !== "ELIGIBLE") return "FAILED";
  return "READY";
}

function asIsoOrDash(value: Date | null | undefined): string {
  if (!(value instanceof Date)) return "-";
  if (Number.isNaN(value.getTime())) return "-";
  return value.toISOString();
}

function asProviderMetadata(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

/** Builds campaign queue rows with provider-backed sent/attempt/response fields. */
async function buildCampaignQueueRows(params: {
  organizationId: string;
  campaignId: string;
}): Promise<CampaignQueueRow[]> {
  const [sendRecipients, events] = await Promise.all([
    prisma.emailSendRecipient.findMany({
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      orderBy: { queuedAt: "desc" },
      include: {
        constituent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        subscription: {
          select: {
            unsubscribedAt: true,
          },
        },
      },
    }),
    prisma.emailCampaignDeliveryEvent.findMany({
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      orderBy: { eventAt: "desc" },
    }),
  ]);

  const eventsByEmail = new Map<string, typeof events>();
  for (const event of events) {
    const email = event.recipientEmail.trim().toLowerCase();
    const existing = eventsByEmail.get(email) ?? [];
    existing.push(event);
    eventsByEmail.set(email, existing);
  }

  return sendRecipients.map((recipient) => {
    const email = recipient.email.trim().toLowerCase();
    const recipientEvents = eventsByEmail.get(email) ?? [];
    const eventTypes = new Set(recipientEvents.map((event) => event.eventType));
    const latest = recipientEvents[0] ?? null;

    const queued = recipientEvents.find((event) => event.eventType === "QUEUED") ?? null;
    const delivered = recipientEvents.find((event) => event.eventType === "DELIVERED") ?? null;
    const opened = recipientEvents.find((event) => event.eventType === "OPENED") ?? null;
    const clicked = recipientEvents.find((event) => event.eventType === "CLICKED") ?? null;
    const bounced = recipientEvents.find((event) => event.eventType === "BOUNCED") ?? null;

    const metadata = asProviderMetadata(queued?.metadata ?? latest?.metadata ?? null);
    const attemptCountValue = firstPositiveNumber([metadata.attemptCount, metadata.attempt, metadata.attempts]);
    const providerResponse = firstString([metadata.providerResponse, metadata.smtpResponse, metadata.response])
      ?? (recipient.ineligibilityReason?.startsWith("SMTP_SEND_FAILED") ? "SMTP rejected the message before provider acceptance." : "Not tracked yet");
    const failureReason = firstString([metadata.reason, recipient.ineligibilityReason]) ?? "-";

    const sendingStartedAtRaw = firstString([metadata.sendingStartedAt]);
    const sendingStartedAt = sendingStartedAtRaw ? parseWebhookEventAt(sendingStartedAtRaw) : null;

    const sentAtFromMetadataRaw = firstString([metadata.sentAt]);
    const sentAtFromMetadata = sentAtFromMetadataRaw ? parseWebhookEventAt(sentAtFromMetadataRaw) : null;
    const sentAt = recipient.sentAt ?? sentAtFromMetadata;

    const unsubscribeAtFromMetadataRaw = recipientEvents
      .map((event) => asProviderMetadata(event.metadata))
      .map((eventMetadata) => firstString([
        eventMetadata.unsubscribedAt,
        eventMetadata.unsubscribeAt,
        eventMetadata.optOutAt,
        eventMetadata.optedOutAt,
      ]))
      .find((value): value is string => Boolean(value)) ?? null;
    const unsubscribeAtFromMetadata = unsubscribeAtFromMetadataRaw ? parseWebhookEventAt(unsubscribeAtFromMetadataRaw) : null;
    const unsubscribedAt = recipient.subscription?.unsubscribedAt ?? unsubscribeAtFromMetadata;

    const fullName = [recipient.constituent?.firstName ?? "", recipient.constituent?.lastName ?? ""].join(" ").trim();

    return {
      recipientLabel: fullName || email.split("@")[0] || email,
      email,
      status: resolveQueueStatusFromEvents({
        eventTypes,
        eligibilityStatus: recipient.eligibilityStatus,
        ineligibilityReason: recipient.ineligibilityReason,
        sentAt,
        unsubscribedAt,
      }),
      lastEvent: latest ? `${latest.eventType} @ ${latest.eventAt.toISOString()}` : "Waiting for events",
      attemptCount: attemptCountValue ? String(attemptCountValue) : (sentAt ? "1" : "Not tracked yet"),
      providerResponse,
      queuedAt: asIsoOrDash(recipient.queuedAt ?? queued?.eventAt ?? null),
      sendingStartedAt: asIsoOrDash(sendingStartedAt),
      sentAt: asIsoOrDash(sentAt),
      deliveredAt: asIsoOrDash(delivered?.eventAt ?? null),
      openedAt: asIsoOrDash(opened?.eventAt ?? null),
      clickedAt: asIsoOrDash(clicked?.eventAt ?? null),
      bouncedAt: asIsoOrDash(bounced?.eventAt ?? null),
      unsubscribedAt: unsubscribedAt ? asIsoOrDash(unsubscribedAt) : "Not tracked yet",
      failureReason,
    };
  });
}

/** Loads one campaign snapshot payload used by SSE and fallback queue reads. */
async function buildCampaignLiveSnapshot(params: {
  organizationId: string;
  campaignId: string;
  sendLogLimit?: number;
  eventLimit?: number;
}): Promise<CampaignLiveSnapshotPayload> {
  const sendLogLimit = Math.min(Math.max(params.sendLogLimit ?? 120, 1), 300);
  const eventLimit = Math.min(Math.max(params.eventLimit ?? 250, 1), 1000);

  const [events, grouped, latestEvent, distinctRecipients, auditLog, queueRows] = await Promise.all([
    prisma.emailCampaignDeliveryEvent.findMany({
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      orderBy: { eventAt: "desc" },
      take: eventLimit,
    }),
    prisma.emailCampaignDeliveryEvent.groupBy({
      by: ["eventType"],
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      _count: { eventType: true },
    }),
    prisma.emailCampaignDeliveryEvent.findFirst({
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      orderBy: { eventAt: "desc" },
      select: { eventAt: true },
    }),
    prisma.emailCampaignDeliveryEvent.findMany({
      where: {
        organizationId: params.organizationId,
        campaignId: params.campaignId,
      },
      distinct: ["recipientEmail"],
      select: { recipientEmail: true },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        entity: "EmailCampaign",
        entityId: params.campaignId,
        action: {
          in: [
            "EMAIL_CAMPAIGN_CREATED",
            "EMAIL_CAMPAIGN_UPDATED",
            "EMAIL_CAMPAIGN_SENT",
            "EMAIL_CAMPAIGN_SEND_PARTIAL",
            "EMAIL_CAMPAIGN_SEND_FAILED",
            "EMAIL_CAMPAIGN_TEST_SENT",
            "EMAIL_CAMPAIGN_SCHEDULED",
            "EMAIL_CAMPAIGN_CANCELLED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: sendLogLimit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    buildCampaignQueueRows({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
    }),
  ]);

  const byType = Object.fromEntries(grouped.map((row) => [row.eventType, row._count.eventType])) as Record<string, number>;
  const queueCounts = queueRows.reduce((acc, row) => {
    acc.total += 1;
    const status = row.status.toUpperCase();
    if (status === "QUEUED") acc.queued += 1;
    else if (status === "SENDING") acc.sending += 1;
    else if (status === "SENT") acc.accepted += 1;
    else if (status === "DELIVERED") {
      acc.accepted += 1;
      acc.delivered += 1;
    } else if (status === "OPENED") {
      acc.accepted += 1;
      acc.delivered += 1;
      acc.opened += 1;
    } else if (status === "CLICKED") {
      acc.accepted += 1;
      acc.delivered += 1;
      acc.opened += 1;
      acc.clicked += 1;
    } else if (status === "BOUNCED") acc.bounced += 1;
    else if (status === "FAILED") acc.failed += 1;
    else if (status === "SUPPRESSED") acc.suppressed += 1;
    else if (status === "UNSUBSCRIBED") acc.unsubscribed += 1;
    else if (status === "CANCELLED") acc.cancelled += 1;
    return acc;
  }, {
    total: 0,
    queued: 0,
    sending: 0,
    accepted: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
    suppressed: 0,
    unsubscribed: 0,
    cancelled: 0,
  });

  const delivered = byType.DELIVERED ?? 0;
  const opened = byType.OPENED ?? 0;
  const clicked = byType.CLICKED ?? 0;
  const bounced = byType.BOUNCED ?? 0;
  const eligibleRecipients = queueCounts.total;
  const processedRecipients = queueCounts.accepted + queueCounts.failed + queueCounts.bounced + queueCounts.suppressed + queueCounts.cancelled;
  const sendProgressPercent = eligibleRecipients > 0
    ? Math.min(100, Math.round((processedRecipients / eligibleRecipients) * 100))
    : 0;
  const remaining = Math.max(0, eligibleRecipients - processedRecipients);

  return {
    campaignId: params.campaignId,
    delivery: {
      summary: {
        eligibleRecipients,
        processedRecipients,
        sendProgressPercent,
        queued: queueCounts.queued,
        sending: queueCounts.sending,
        accepted: queueCounts.accepted,
        delivered,
        opened,
        clicked,
        bounced,
        failed: queueCounts.failed,
        suppressed: queueCounts.suppressed,
        unsubscribed: queueCounts.unsubscribed,
        cancelled: queueCounts.cancelled,
        remaining,
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
      events: events.map((event) => ({
        id: event.id,
        recipientEmail: event.recipientEmail,
        eventType: event.eventType,
        eventAt: event.eventAt,
        metadata: event.metadata,
      })),
    },
    activity: auditLog.map((entry) => ({
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
    })),
    queueRows,
  };
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

interface CampaignEventStats {
  queued: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

function emptyCampaignEventStats(): CampaignEventStats {
  return {
    queued: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
  };
}

function isEnumWorkspaceStatus(value: string): value is CampaignWorkspaceStatus {
  return CAMPAIGN_WORKSPACE_STATUSES.includes(value as CampaignWorkspaceStatus);
}

function resolveWorkspaceStatus(params: {
  status: string;
  workflow: CampaignWorkflowSettings;
  scheduledAt: Date | null;
  sentAt: Date | null;
  eventStats: CampaignEventStats;
  hasRecentSendFailure: boolean;
}): CampaignWorkspaceStatus {
  if (params.workflow.archivedAt) return "ARCHIVED";

  const status = params.status.toUpperCase();
  const { eventStats } = params;

  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SENDING") return "SENDING";

  if (status === "SCHEDULED") {
    if (params.workflow.queueState === "PAUSED") return "QUEUED";
    if (eventStats.queued > 0) return "QUEUED";
    return "SCHEDULED";
  }

  if (status === "SENT") {
    if (eventStats.delivered > 0 || eventStats.opened > 0 || eventStats.clicked > 0) return "DELIVERED";
    if (eventStats.bounced > 0 && eventStats.delivered === 0) return "FAILED";
    if (eventStats.queued > 0) return "SENT";
    if (params.sentAt) return "SENT";
  }

  if (params.hasRecentSendFailure) return "FAILED";

  if (status === "DRAFT") {
    if (params.workflow.preparationStatus === "READY") {
      if (params.workflow.needsReview) return "NEEDS_REVIEW";
      return "READY";
    }
    return "DRAFT";
  }

  if (isEnumWorkspaceStatus(status)) return status;
  return "DRAFT";
}

function nextActionForWorkspaceStatus(status: CampaignWorkspaceStatus): string {
  if (status === "DRAFT") return "Continue Setup";
  if (status === "NEEDS_REVIEW") return "Queue for Review";
  if (status === "READY") return "Schedule";
  if (status === "SCHEDULED") return "Monitor Schedule";
  if (status === "QUEUED") return "View Queue";
  if (status === "SENDING") return "Monitor Queue";
  if (status === "SENT" || status === "DELIVERED") return "View Analytics";
  if (status === "FAILED") return "Fix and Retry";
  if (status === "CANCELLED") return "Duplicate Campaign";
  if (status === "ARCHIVED") return "Duplicate Campaign";
  return "Open Campaign";
}

async function fetchCampaignEventStatsMap(organizationId: string, campaignIds: string[]): Promise<Map<string, CampaignEventStats>> {
  if (campaignIds.length === 0) return new Map();
  const grouped = await prisma.emailCampaignDeliveryEvent.groupBy({
    by: ["campaignId", "eventType"],
    where: {
      organizationId,
      campaignId: { in: campaignIds },
    },
    _count: { eventType: true },
  });

  const map = new Map<string, CampaignEventStats>();
  for (const row of grouped) {
    const existing = map.get(row.campaignId) ?? emptyCampaignEventStats();
    if (row.eventType === "QUEUED") existing.queued = row._count.eventType;
    if (row.eventType === "DELIVERED") existing.delivered = row._count.eventType;
    if (row.eventType === "OPENED") existing.opened = row._count.eventType;
    if (row.eventType === "CLICKED") existing.clicked = row._count.eventType;
    if (row.eventType === "BOUNCED") existing.bounced = row._count.eventType;
    map.set(row.campaignId, existing);
  }
  return map;
}

async function fetchRecentSendFailureMap(organizationId: string, campaignIds: string[]): Promise<Map<string, boolean>> {
  if (campaignIds.length === 0) return new Map();
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      entity: "EmailCampaign",
      action: "EMAIL_CAMPAIGN_SEND_FAILED",
      entityId: { in: campaignIds },
    },
    select: {
      entityId: true,
    },
    distinct: ["entityId"],
  });
  const map = new Map<string, boolean>();
  for (const row of rows) {
    if (typeof row.entityId === "string" && row.entityId.trim()) {
      map.set(row.entityId, true);
    }
  }
  return map;
}

function withCampaignWorkspaceFields<T extends {
  id: string;
  status: string;
  audienceFilter: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
}>(
  campaign: T,
  options: {
    eventStats?: CampaignEventStats;
    hasRecentSendFailure?: boolean;
  } = {},
) {
  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  const workspaceStatus = resolveWorkspaceStatus({
    status: campaign.status,
    workflow: parsed.workflow,
    scheduledAt: campaign.scheduledAt,
    sentAt: campaign.sentAt,
    eventStats: options.eventStats ?? emptyCampaignEventStats(),
    hasRecentSendFailure: Boolean(options.hasRecentSendFailure),
  });

  return {
    ...campaign,
    ownerId: parsed.sharing.ownerId,
    sharedWithOrganization: parsed.sharing.sharedWithOrganization,
    preparationStatus: parsed.workflow.preparationStatus,
    workflow: parsed.workflow,
    templateSnapshot: parsed.workflow.templateSnapshot,
    workspaceStatus,
    nextRecommendedAction: nextActionForWorkspaceStatus(workspaceStatus),
  };
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

interface CampaignValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
}

interface CampaignValidationResult {
  valid: boolean;
  checks: CampaignValidationCheck[];
  blockers: string[];
  audience: Omit<AudiencePreview, "recipients">;
}

async function validateCampaignSendReadiness(params: {
  campaign: {
    id: string;
    organizationId: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    replyToEmail: string | null;
    bodyHtml: string | null;
    bodyText: string | null;
    templateJson: string | null;
    purpose: EmailPurpose;
    audienceFilter: string | null;
  };
  sendOptions?: CampaignSendOptions;
}): Promise<CampaignValidationResult> {
  const purpose = parseEmailPurpose(params.campaign.purpose);
  const branding = await loadOrganizationBrandingContext(params.campaign.organizationId);
  const deliveryBodies = buildCampaignDeliveryBodies(params.campaign, purpose, branding);

  const requiredFieldsChecks: CampaignValidationCheck[] = [
    {
      key: "subject",
      label: "Subject",
      passed: Boolean(params.campaign.subject?.trim()),
      detail: params.campaign.subject?.trim() ? "Subject is set." : "Campaign subject is required.",
      blocking: true,
    },
    {
      key: "fromEmail",
      label: "Sender Email",
      passed: Boolean(params.campaign.fromEmail?.trim()) && isValidEmail(params.campaign.fromEmail),
      detail: isValidEmail(params.campaign.fromEmail || "") ? "Sender email is valid." : "fromEmail must be a valid email address.",
      blocking: true,
    },
    {
      key: "replyToEmail",
      label: "Reply-To Email",
      passed: !params.campaign.replyToEmail || isValidEmail(params.campaign.replyToEmail),
      detail: !params.campaign.replyToEmail || isValidEmail(params.campaign.replyToEmail)
        ? "Reply-to is valid."
        : "replyToEmail must be a valid email address.",
      blocking: true,
    },
    {
      key: "body",
      label: "Template Body",
      passed: Boolean(deliveryBodies.html?.trim()) || Boolean(deliveryBodies.text?.trim()),
      detail: (deliveryBodies.html?.trim() || deliveryBodies.text?.trim())
        ? "Template body is present."
        : "Campaign body content is required.",
      blocking: true,
    },
  ];

  const recipientPlan = await resolveRecipientPlan({
    organizationId: params.campaign.organizationId,
    audienceFilter: params.campaign.audienceFilter,
    purpose,
  }, params.sendOptions);

  const complianceIssues = getCampaignComplianceIssues({
    purpose,
    subject: params.campaign.subject,
    bodyHtml: deliveryBodies.html,
    bodyText: deliveryBodies.text,
    fromEmail: params.campaign.fromEmail,
    replyToEmail: params.campaign.replyToEmail,
  });

  const complianceChecks = complianceIssues.length === 0
    ? [{
        key: "compliance",
        label: "Compliance",
        passed: true,
        detail: "Compliance checks passed.",
        blocking: true,
      } satisfies CampaignValidationCheck]
    : complianceIssues.map((issue, index) => ({
        key: `compliance-${index + 1}`,
        label: "Compliance",
        passed: false,
        detail: issue,
        blocking: true,
      } satisfies CampaignValidationCheck));

  const unsupportedMergeTokens = findUnsupportedEmailMergeTokens([
    params.campaign.subject,
    deliveryBodies.html,
    deliveryBodies.text,
  ]);
  const mergeFieldCheck: CampaignValidationCheck = unsupportedMergeTokens.length === 0
    ? {
        key: "merge-fields",
        label: "Merge Fields",
        passed: true,
        detail: "All merge fields are supported by campaign preview and send.",
        blocking: true,
      }
    : {
        key: "merge-fields",
        label: "Merge Fields",
        passed: false,
        detail: `Unsupported merge fields: ${unsupportedMergeTokens.map((token) => `{{${token}}}`).join(", ")}.`,
        blocking: true,
      };

  let smtpCheck: CampaignValidationCheck;
  try {
    await createOrganizationEmailSender(params.campaign.organizationId);
    smtpCheck = {
      key: "smtp",
      label: "SMTP / Provider",
      passed: true,
      detail: "Outbound provider is configured.",
      blocking: true,
    };
  } catch (error) {
    smtpCheck = {
      key: "smtp",
      label: "SMTP / Provider",
      passed: false,
      detail: error instanceof Error ? error.message : "Outbound email provider is not ready.",
      blocking: true,
    };
  }

  const audienceChecks: CampaignValidationCheck[] = [
    {
      key: "audience-valid",
      label: "Audience Valid Recipients",
      passed: recipientPlan.audience.finalSendCount > 0,
      detail: recipientPlan.audience.finalSendCount > 0
        ? `${recipientPlan.audience.finalSendCount} recipients are eligible.`
        : "No recipients are eligible for send.",
      blocking: true,
    },
    {
      key: "audience-optout",
      label: "Unsubscribe / Suppression",
      passed: true,
      detail: `Opted out: ${recipientPlan.audience.optedOut + recipientPlan.audience.categoryOptOut}, suppressed: ${recipientPlan.audience.suppressed}, do-not-contact: ${recipientPlan.audience.doNotContact}.`,
      blocking: false,
    },
  ];

  const checks = [...requiredFieldsChecks, mergeFieldCheck, ...complianceChecks, smtpCheck, ...audienceChecks];
  const blockers = checks.filter((check) => check.blocking && !check.passed).map((check) => check.detail);

  return {
    valid: blockers.length === 0,
    checks,
    blockers,
    audience: {
      totalMatched: recipientPlan.audience.totalMatched,
      validEmail: recipientPlan.audience.validEmail,
      missingEmail: recipientPlan.audience.missingEmail,
      optedOut: recipientPlan.audience.optedOut,
      duplicateEmails: recipientPlan.audience.duplicateEmails,
      suppressionCount: recipientPlan.audience.suppressionCount,
      categoryOptOut: recipientPlan.audience.categoryOptOut,
      doNotContact: recipientPlan.audience.doNotContact,
      invalidEmail: recipientPlan.audience.invalidEmail,
      suppressed: recipientPlan.audience.suppressed,
      finalSendCount: recipientPlan.audience.finalSendCount,
    },
  };
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
  const branding = await loadOrganizationBrandingContext(campaign.organizationId);
  const deliveryBodies = buildCampaignDeliveryBodies(campaign, purpose, branding);
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

    const recipientDecisions = new Map(recipientPlan.decisions.map((decision) => [decision.email, decision]));

    const acceptedRecipients: string[] = [];
    const failedRecipients: Array<{ email: string; reason: string }> = [];

    for (const recipientEmail of to) {
      const recipientDecision = recipientDecisions.get(recipientEmail);
      const personalizedContent = await personalizeCampaignContent({
        organizationId: campaign.organizationId,
        category: recipientPlan.category,
        purpose,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject || campaign.name,
          previewText: campaign.previewText,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
        },
        deliveryBodies,
        mergeRecipientEmail: recipientEmail,
        constituentId: recipientDecision?.constituentId ?? null,
      });

      const sendingStartedAt = new Date();

      await prisma.emailSendRecipient.updateMany({
        where: {
          campaignId: campaign.id,
          email: recipientEmail,
        },
        data: {
          ineligibilityReason: `SMTP_SENDING:${sendingStartedAt.toISOString()}`,
        },
      });

      try {
        const sendResult = await sender.send({
          to: recipientEmail,
          subject: personalizedContent.subject,
          text: personalizedContent.text,
          html: personalizedContent.html,
          fromNameOverride: campaign.fromName,
        });

        await prisma.emailSendRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            email: recipientEmail,
          },
          data: {
            sentAt: sendResult.acceptedAt,
            ineligibilityReason: null,
          },
        });

        await upsertDeliveryEvent({
          organizationId: campaign.organizationId,
          campaignId: campaign.id,
          recipientEmail,
          eventType: "QUEUED",
          eventAt: sendResult.acceptedAt,
          metadata: {
            trigger,
            sendMode: recipientPlan.sendMode,
            audienceType: recipientPlan.audienceType,
            attemptCount: 1,
            providerResponse: sendResult.providerResponse,
            providerMessageId: sendResult.providerMessageId,
            sentAt: sendResult.acceptedAt.toISOString(),
            sendingStartedAt: sendingStartedAt.toISOString(),
            source: "smtp_acceptance",
          },
        });

        acceptedRecipients.push(recipientEmail);
      } catch (recipientError) {
        const reason = recipientError instanceof Error ? recipientError.message : String(recipientError);
        failedRecipients.push({ email: recipientEmail, reason });

        await prisma.emailSendRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            email: recipientEmail,
          },
          data: {
            sentAt: null,
            ineligibilityReason: `SMTP_SEND_FAILED:${reason}`,
          },
        });
      }
    }

    if (acceptedRecipients.length === 0) {
      throw new CampaignSendError("All recipient send attempts failed before provider acceptance.", 502);
    }

    await writeRecipientTimelineActivities({
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      subject: campaign.subject || campaign.name,
      recipients: acceptedRecipients,
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

    if (failedRecipients.length > 0) {
      await prisma.auditLog.create({
        data: {
          organizationId: campaign.organizationId,
          action: "EMAIL_CAMPAIGN_SEND_PARTIAL",
          entity: "EmailCampaign",
          entityId: campaign.id,
          metadata: {
            trigger,
            sendMode: recipientPlan.sendMode,
            audienceType: recipientPlan.audienceType,
            acceptedRecipientCount: acceptedRecipients.length,
            failedRecipientCount: failedRecipients.length,
            failedRecipients: failedRecipients.slice(0, 50),
          },
        },
      });
    }

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
          acceptedRecipientCount: acceptedRecipients.length,
          failedRecipientCount: failedRecipients.length,
          failedRecipients: failedRecipients.slice(0, 50),
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

    await recalculateCampaignDeliveryStats(campaign.id).catch(() => {
      // Best-effort stat rebuild for failed sends.
    });

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
          "EMAIL_CAMPAIGN_SEND_PARTIAL",
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
  const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
  if (!allowedImageMimeTypes.has(mimeType.toLowerCase())) {
    res.status(400).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Email image uploads must be PNG, JPG, WEBP, or GIF." } });
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
  const snapshot = await buildCampaignLiveSnapshot({
    organizationId,
    campaignId: campaign.id,
    eventLimit: limit,
  });

  res.json(snapshot.delivery ?? {
    summary: {
      queued: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    },
    diagnostics: {
      providerWebhookConfigured: Boolean(EMAIL_CAMPAIGN_WEBHOOK_SECRET),
      lastEventAt: null,
      totalEvents: 0,
      uniqueRecipients: 0,
      deliveryToQueueRate: 0,
      openToDeliveredRate: 0,
      clickToOpenRate: 0,
    },
    events: [],
  });
});

/**
 * GET /api/email-campaigns/:id/queue
 * Description: Returns campaign queue rows with provider-backed attempt/response/sent fields.
 */
router.get("/:id/queue", async (req, res) => {
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

  const rows = await buildCampaignQueueRows({
    organizationId,
    campaignId: campaign.id,
  });

  res.json({ rows });
});

/**
 * GET /api/email-campaigns/:id/stream
 * Description: Streams live campaign snapshot updates over SSE for overview/queue/analytics/activity tabs.
 */
router.get("/:id/stream", async (req, res) => {
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;

  const sendSnapshot = async () => {
    const snapshot = await buildCampaignLiveSnapshot({
      organizationId,
      campaignId: campaign.id,
      eventLimit: 300,
      sendLogLimit: 160,
    });
    if (closed) return;
    res.write(`event: snapshot\n`);
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  await sendSnapshot();

  const heartbeatTimer = setInterval(() => {
    if (closed) return;
    res.write(`event: ping\n`);
    res.write(`data: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  }, 15000);

  const snapshotTimer = setInterval(() => {
    void sendSnapshot().catch(() => {
      if (closed) return;
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: "snapshot_failed" })}\n\n`);
    });
  }, 5000);

  req.on("close", () => {
    closed = true;
    clearInterval(heartbeatTimer);
    clearInterval(snapshotTimer);
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
  const normalizedRecipient = recipientEmail.trim().toLowerCase();
  const metadataInput = {
    ...(metadata ?? {}),
    source: "manual_event",
    normalizedEventType: safeType,
    sentAt: safeType === "QUEUED" ? safeEventAt.toISOString() : firstString([metadata?.sentAt]),
  } as Record<string, unknown>;

  await upsertDeliveryEvent({
    organizationId,
    campaignId: campaign.id,
    recipientEmail: normalizedRecipient,
    eventType: safeType,
    eventAt: safeEventAt,
    metadata: metadataInput,
  });

  if (safeType === "QUEUED") {
    await prisma.emailSendRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        email: normalizedRecipient,
      },
      data: {
        sentAt: safeEventAt,
      },
    });
  }

  await recalculateCampaignDeliveryStats(campaign.id);

  const refreshed = await prisma.emailCampaignDeliveryEvent.findUnique({
    where: {
      campaignId_recipientEmail_eventType: {
        campaignId: campaign.id,
        recipientEmail: normalizedRecipient,
        eventType: safeType,
      },
    },
  });

  res.status(201).json(refreshed);
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

  const {
    status,
    search,
    ownerId,
    sortBy = "updatedAt",
    sortDirection = "desc",
    limit = "50",
  } = req.query as Record<string, string>;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 250);
  const statusFilters = (status ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { subject: { contains: search } },
              { fromName: { contains: search } },
              { fromEmail: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: safeLimit,
  });

  const visibleCampaigns = campaigns
    .filter((campaign) => canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role));

  const campaignIds = visibleCampaigns.map((campaign) => campaign.id);
  const [eventStatsMap, failedMap] = await Promise.all([
    fetchCampaignEventStatsMap(organizationId, campaignIds),
    fetchRecentSendFailureMap(organizationId, campaignIds),
  ]);

  const enriched = visibleCampaigns.map((campaign) => withCampaignWorkspaceFields(campaign, {
    eventStats: eventStatsMap.get(campaign.id) ?? emptyCampaignEventStats(),
    hasRecentSendFailure: failedMap.get(campaign.id) ?? false,
  }));

  const ownerFiltered = ownerId
    ? enriched.filter((campaign) => (campaign.ownerId ?? "") === ownerId)
    : enriched;

  const statusFiltered = statusFilters.length > 0
    ? ownerFiltered.filter((campaign) => {
        const legacyStatus = campaign.status.toUpperCase();
        const workspaceStatus = campaign.workspaceStatus.toUpperCase();
        return statusFilters.includes(legacyStatus) || statusFilters.includes(workspaceStatus);
      })
    : ownerFiltered;

  const searched = search
    ? statusFiltered.filter((campaign) => {
        const needle = search.toLowerCase();
        const templateName = campaign.templateSnapshot?.templateName ?? "";
        const owner = campaign.ownerId ?? "";
        return [
          campaign.name,
          campaign.subject,
          campaign.status,
          campaign.workspaceStatus,
          templateName,
          owner,
        ].join(" ").toLowerCase().includes(needle);
      })
    : statusFiltered;

  const sorted = [...searched].sort((a, b) => {
    const direction = sortDirection.toLowerCase() === "asc" ? 1 : -1;

    const safeDate = (value: Date | string | null | undefined) => {
      if (!value) return 0;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    const safeRate = (opened: number, delivered: number) => (delivered > 0 ? opened / delivered : 0);
    const byUpdated = safeDate(a.updatedAt) - safeDate(b.updatedAt);
    const byScheduled = safeDate(a.scheduledAt) - safeDate(b.scheduledAt);
    const bySent = safeDate(a.sentAt) - safeDate(b.sentAt);
    const byOpenRate = safeRate(a.opened, a.delivered) - safeRate(b.opened, b.delivered);
    const byClickRate = safeRate(a.clicked, a.delivered) - safeRate(b.clicked, b.delivered);
    const byAudience = (a.totalRecipients ?? 0) - (b.totalRecipients ?? 0);

    if (sortBy === "scheduledAt") return byScheduled * direction;
    if (sortBy === "sentAt") return bySent * direction;
    if (sortBy === "openRate") return byOpenRate * direction;
    if (sortBy === "clickRate") return byClickRate * direction;
    if (sortBy === "audienceSize") return byAudience * direction;
    return byUpdated * direction;
  });

  res.json(sorted.slice(0, safeLimit));
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

/**
 * GET /api/email-campaigns/calendar
 * Description: Returns calendar events for campaign planning and an unscheduled drafts rail.
 * Query: from?: ISO datetime, to?: ISO datetime
 */
router.get("/calendar", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      range: { from: null, to: null },
      events: [],
      unscheduledDrafts: [],
    });
    return;
  }

  const fromRaw = typeof req.query.from === "string" ? req.query.from : "";
  const toRaw = typeof req.query.to === "string" ? req.query.to : "";
  const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const to = toRaw ? new Date(toRaw) : new Date(Date.now() + (90 * 24 * 60 * 60 * 1000));

  const safeFrom = Number.isNaN(from.getTime()) ? new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) : from;
  const safeTo = Number.isNaN(to.getTime()) ? new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)) : to;

  const campaigns = await prisma.emailCampaign.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });

  const visibleCampaigns = campaigns.filter((campaign) =>
    canAccessCampaign(parseCampaignAudienceFilter(campaign.audienceFilter).sharing, userId, role)
  );

  const ids = visibleCampaigns.map((campaign) => campaign.id);
  const [eventStatsMap, failedMap] = await Promise.all([
    fetchCampaignEventStatsMap(organizationId, ids),
    fetchRecentSendFailureMap(organizationId, ids),
  ]);

  const enriched = visibleCampaigns.map((campaign) => withCampaignWorkspaceFields(campaign, {
    eventStats: eventStatsMap.get(campaign.id) ?? emptyCampaignEventStats(),
    hasRecentSendFailure: failedMap.get(campaign.id) ?? false,
  }));

  const events = enriched.flatMap((campaign) => {
    const status = campaign.workspaceStatus;
    const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
    const sentAt = campaign.sentAt ? new Date(campaign.sentAt) : null;

    if (["SCHEDULED", "QUEUED", "SENDING"].includes(status) && scheduledAt && scheduledAt >= safeFrom && scheduledAt <= safeTo) {
      return [{
        id: `${campaign.id}:scheduled`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        status,
        at: scheduledAt.toISOString(),
        kind: "scheduled",
        draggable: !["SENDING", "SENT", "DELIVERED", "CANCELLED", "ARCHIVED"].includes(status),
      }];
    }

    if (["SENT", "DELIVERED"].includes(status) && sentAt && sentAt >= safeFrom && sentAt <= safeTo) {
      return [{
        id: `${campaign.id}:sent`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        status,
        at: sentAt.toISOString(),
        kind: "sent",
        draggable: false,
      }];
    }

    return [];
  });

  const unscheduledDrafts = enriched
    .filter((campaign) => ["DRAFT", "READY", "NEEDS_REVIEW"].includes(campaign.workspaceStatus) && !campaign.scheduledAt)
    .map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      subject: campaign.subject,
      status: campaign.workspaceStatus,
      updatedAt: campaign.updatedAt,
      audienceCount: campaign.totalRecipients,
    }));

  res.json({
    range: {
      from: safeFrom.toISOString(),
      to: safeTo.toISOString(),
    },
    events,
    unscheduledDrafts,
  });
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

  const [eventStatsMap, failedMap] = await Promise.all([
    fetchCampaignEventStatsMap(organizationId, [campaign.id]),
    fetchRecentSendFailureMap(organizationId, [campaign.id]),
  ]);

  res.json(withCampaignWorkspaceFields(campaign, {
    eventStats: eventStatsMap.get(campaign.id) ?? emptyCampaignEventStats(),
    hasRecentSendFailure: failedMap.get(campaign.id) ?? false,
  }));
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
  const templateSnapshot = normalizeTemplateSnapshot(
    req.body?.templateSnapshot
    ?? {
      templateId: typeof req.body?.templateId === "string" ? req.body.templateId : null,
      templateVersion: typeof req.body?.templateVersion === "string" ? req.body.templateVersion : null,
      templateName: typeof req.body?.templateName === "string" ? req.body.templateName : null,
    },
  );

  const workflow = withWorkflow({
    preparationStatus: normalizePreparationStatus(preparationStatus, defaultPreparationStatus),
    needsReview: false,
    templateSnapshot,
  });

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
        workflow,
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

  res.status(201).json(withCampaignWorkspaceFields(campaign));
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

  const requestedWorkflow = req.body?.workflow && typeof req.body.workflow === "object" && !Array.isArray(req.body.workflow)
    ? (req.body.workflow as Partial<CampaignWorkflowSettings>)
    : null;
  const requestedTemplateSnapshot = normalizeTemplateSnapshot(
    req.body?.templateSnapshot
    ?? {
      templateId: typeof req.body?.templateId === "string" ? req.body.templateId : null,
      templateVersion: typeof req.body?.templateVersion === "string" ? req.body.templateVersion : null,
      templateName: typeof req.body?.templateName === "string" ? req.body.templateName : null,
    },
  );

  const nextWorkflow = withWorkflow({
    ...parsedExisting.workflow,
    ...(requestedWorkflow ?? {}),
    preparationStatus: nextPreparationStatus,
    needsReview:
      typeof req.body?.needsReview === "boolean"
        ? req.body.needsReview
        : (requestedWorkflow?.needsReview ?? parsedExisting.workflow.needsReview),
    queueState:
      req.body?.queueState !== undefined
        ? normalizeQueueState(req.body.queueState, parsedExisting.workflow.queueState)
        : (requestedWorkflow?.queueState
          ? normalizeQueueState(requestedWorkflow.queueState, parsedExisting.workflow.queueState)
          : parsedExisting.workflow.queueState),
    archivedAt:
      req.body?.archivedAt === null
        ? null
        : (typeof req.body?.archivedAt === "string" && req.body.archivedAt.trim()
          ? req.body.archivedAt.trim()
          : (requestedWorkflow?.archivedAt ?? parsedExisting.workflow.archivedAt)),
    archivedById:
      req.body?.archivedById === null
        ? null
        : (typeof req.body?.archivedById === "string" && req.body.archivedById.trim()
          ? req.body.archivedById.trim()
          : (requestedWorkflow?.archivedById ?? parsedExisting.workflow.archivedById)),
    templateSnapshot: requestedTemplateSnapshot ?? requestedWorkflow?.templateSnapshot ?? parsedExisting.workflow.templateSnapshot,
  });

  const campaign = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      name, subject, previewText, fromName, fromEmail, replyToEmail,
      purpose: nextPurpose,
      bodyHtml, bodyText, templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      audienceFilter: serializeCampaignAudienceFilter(nextFilter, ownerId, nextSharing, nextWorkflow),
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

  res.json(withCampaignWorkspaceFields(campaign));
});

/**
 * POST /api/email-campaigns/:id/preview
 * Description: Returns an HTML/text preview payload for review tooling without sending.
 * Request: { recipientEmail?: string }
 * Response: { id, subject, previewText, fromName, fromEmail, bodyHtml, bodyText, previewMode, previewRecipient }
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

  const { recipientEmail } = req.body as { recipientEmail?: string };
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    res.status(400).json({ error: { code: "INVALID_RECIPIENT", message: "recipientEmail must be a valid email address." } });
    return;
  }

  const purpose = parseEmailPurpose((campaign as { purpose?: unknown }).purpose);
  const branding = await loadOrganizationBrandingContext(organizationId);
  const deliveryBodies = buildCampaignDeliveryBodies(campaign, purpose, branding);
  let previewTarget: Awaited<ReturnType<typeof resolveCampaignPreviewTarget>>;
  try {
    previewTarget = await resolveCampaignPreviewTarget({
      organizationId,
      purpose,
      audienceFilter: campaign.audienceFilter,
      recipientEmail: recipientEmail ?? null,
    });
  } catch {
    previewTarget = {
      mode: "template-only",
      recipientEmail: recipientEmail?.trim().toLowerCase() || null,
      constituentId: null,
    };
  }

  let subject = campaign.subject;
  let previewText = campaign.previewText;
  let bodyHtml = deliveryBodies.html;
  let bodyText = deliveryBodies.text;
  let previewRecipient: CampaignPreviewRecipient | null = null;
  const unsupportedPreviewTokens = findUnsupportedEmailMergeTokens([
    campaign.subject,
    campaign.previewText,
    deliveryBodies.html,
    deliveryBodies.text,
  ]);
  let warnings = unsupportedPreviewTokens.length > 0
    ? [`Unsupported merge fields: ${unsupportedPreviewTokens.map((token) => `{{${token}}}`).join(", ")}.`]
    : [];

  if (previewTarget.recipientEmail) {
    const mergeContext = await buildCampaignMergeContext({
      organizationId,
      recipientEmail: previewTarget.recipientEmail,
      constituentId: previewTarget.constituentId,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
      },
    });
    const personalizedContent = await personalizeCampaignContent({
      organizationId,
      category: categoryForPurpose(purpose),
      purpose,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject || campaign.name,
        previewText: campaign.previewText,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
      },
      deliveryBodies,
      mergeRecipientEmail: previewTarget.recipientEmail,
      constituentId: previewTarget.constituentId,
    });
    subject = personalizedContent.subject;
    previewText = personalizedContent.previewText;
    bodyHtml = personalizedContent.html;
    bodyText = personalizedContent.text;
    previewRecipient = personalizedContent.recipient;
    warnings = buildEmailMergePreviewWarnings([
      campaign.subject,
      campaign.previewText,
      deliveryBodies.html,
      deliveryBodies.text,
    ], mergeContext.vars);
  }

  res.json({
    id: campaign.id,
    subject,
    previewText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    bodyHtml,
    bodyText,
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
    previewMode: previewTarget.mode,
    previewRecipient,
    warnings,
  });
});

/**
 * POST /api/email-campaigns/:id/validate
 * Description: Validates campaign readiness for send/schedule actions.
 */
router.post("/:id/validate", async (req, res) => {
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

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can validate this campaign" } });
    return;
  }

  try {
    const result = await validateCampaignSendReadiness({
      campaign: {
        id: campaign.id,
        organizationId: campaign.organizationId,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyToEmail: campaign.replyToEmail,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
        templateJson: campaign.templateJson,
        purpose: campaign.purpose,
        audienceFilter: campaign.audienceFilter,
      },
      sendOptions: req.body as CampaignSendOptions,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate campaign.";
    res.status(400).json({ error: { code: "VALIDATION_FAILED", message } });
  }
});

/** POST /api/email-campaigns/:id/ready — marks campaign preparation as READY. */
router.post("/:id/ready", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can update this campaign" } });
    return;
  }

  const workflow = withWorkflow({
    ...parsed.workflow,
    preparationStatus: "READY",
    needsReview: false,
  });

  const updated = await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
      status: campaign.status === "CANCELLED" ? "DRAFT" : campaign.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { action: "SET_READY" },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.json(withCampaignWorkspaceFields(updated));
});

/** POST /api/email-campaigns/:id/queue — sets campaign to ready + needs review. */
router.post("/:id/queue", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can queue this campaign" } });
    return;
  }

  const workflow = withWorkflow({
    ...parsed.workflow,
    preparationStatus: "READY",
    needsReview: true,
  });

  const updated = await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
      status: "DRAFT",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { action: "QUEUE_FOR_REVIEW" },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.json(withCampaignWorkspaceFields(updated));
});

/** POST /api/email-campaigns/:id/unschedule — removes scheduled send time. */
router.post("/:id/unschedule", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can unschedule this campaign" } });
    return;
  }

  if (!campaign.scheduledAt && campaign.status !== "SCHEDULED") {
    res.status(400).json({ error: { code: "NOT_SCHEDULED", message: "Campaign is not scheduled." } });
    return;
  }

  const updated = await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: campaign.status === "SCHEDULED" ? "DRAFT" : campaign.status,
      scheduledAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { action: "UNSCHEDULED" },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.json(withCampaignWorkspaceFields(updated));
});

/**
 * POST /api/email-campaigns/:id/queue-control
 * Request: { action: "PAUSE" | "RESUME" | "CANCEL_REMAINING" }
 */
router.post("/:id/queue-control", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const action = typeof req.body?.action === "string" ? req.body.action.trim().toUpperCase() : "";
  if (!["PAUSE", "RESUME", "CANCEL_REMAINING"].includes(action)) {
    res.status(400).json({ error: { code: "INVALID_ACTION", message: "Action must be PAUSE, RESUME, or CANCEL_REMAINING." } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can control this queue" } });
    return;
  }

  const nowIso = new Date().toISOString();
  const workflowBase = withWorkflow(parsed.workflow);
  let updated = campaign;

  if (action === "PAUSE") {
    const workflow = withWorkflow({
      ...workflowBase,
      queueState: "PAUSED",
      lastQueueActionAt: nowIso,
      lastQueueActionById: userId,
    });

    updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
      },
    });
  }

  if (action === "RESUME") {
    const workflow = withWorkflow({
      ...workflowBase,
      queueState: "ACTIVE",
      lastQueueActionAt: nowIso,
      lastQueueActionById: userId,
    });

    updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
      },
    });
  }

  if (action === "CANCEL_REMAINING") {
    await prisma.emailSendRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        sentAt: null,
      },
      data: {
        eligibilityStatus: "SKIPPED_SUPPRESSED",
        ineligibilityReason: "Cancelled remaining sends by operator.",
      },
    });

    const workflow = withWorkflow({
      ...workflowBase,
      queueState: "PAUSED",
      lastQueueActionAt: nowIso,
      lastQueueActionById: userId,
    });

    updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "CANCELLED",
        scheduledAt: null,
        audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: action === "CANCEL_REMAINING" ? "EMAIL_CAMPAIGN_CANCELLED" : "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { action: `QUEUE_CONTROL_${action}` },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.json(withCampaignWorkspaceFields(updated));
});

/** POST /api/email-campaigns/:id/archive — archives campaign from active workflow lanes. */
router.post("/:id/archive", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canManageCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can archive this campaign" } });
    return;
  }

  const workflow = withWorkflow({
    ...parsed.workflow,
    archivedAt: new Date().toISOString(),
    archivedById: userId,
  });

  const updated = await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: campaign.status === "SCHEDULED" ? "CANCELLED" : campaign.status,
      scheduledAt: campaign.status === "SCHEDULED" ? null : campaign.scheduledAt,
      audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, workflow),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_UPDATED",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { action: "ARCHIVED" },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.json(withCampaignWorkspaceFields(updated));
});

/** POST /api/email-campaigns/:id/duplicate — duplicates campaign into a fresh draft. */
router.post("/:id/duplicate", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({ where: { id: req.params.id, organizationId } });
  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
    return;
  }

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);
  if (!canAccessCampaign(parsed.sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to duplicate this campaign" } });
    return;
  }

  const duplicatedWorkflow = withWorkflow({
    ...parsed.workflow,
    archivedAt: null,
    archivedById: null,
    needsReview: false,
    queueState: "ACTIVE",
    lastQueueActionAt: null,
    lastQueueActionById: null,
    preparationStatus: "DRAFT",
  });

  const duplicate = await prisma.emailCampaign.create({
    data: {
      organizationId: campaign.organizationId,
      name: `${campaign.name} (Copy)`,
      subject: campaign.subject,
      purpose: campaign.purpose,
      previewText: campaign.previewText,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyToEmail: campaign.replyToEmail,
      bodyHtml: campaign.bodyHtml,
      bodyText: campaign.bodyText,
      templateJson: campaign.templateJson,
      status: "DRAFT",
      scheduledAt: null,
      sentAt: null,
      totalRecipients: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, duplicatedWorkflow),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: "EMAIL_CAMPAIGN_CREATED",
      entity: "EmailCampaign",
      entityId: duplicate.id,
      metadata: {
        sourceCampaignId: campaign.id,
        action: "DUPLICATED",
      },
    },
  }).catch(() => {
    // Best-effort audit write.
  });

  res.status(201).json(withCampaignWorkspaceFields(duplicate));
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
    const branding = await loadOrganizationBrandingContext(campaign.organizationId);
    const deliveryBodies = buildCampaignDeliveryBodies(campaign, purpose, branding);
    const unsupportedTokens = findUnsupportedEmailMergeTokens([
      campaign.subject,
      campaign.previewText,
      deliveryBodies.html,
      deliveryBodies.text,
    ]);
    if (unsupportedTokens.length > 0) {
      res.status(400).json({
        error: {
          code: "UNSUPPORTED_MERGE_FIELDS",
          message: `Unsupported merge fields: ${unsupportedTokens.map((token) => `{{${token}}}`).join(", ")}.`,
        },
      });
      return;
    }
    let previewTarget: Awaited<ReturnType<typeof resolveCampaignPreviewTarget>>;
    try {
      previewTarget = await resolveCampaignPreviewTarget({
        organizationId,
        purpose,
        audienceFilter: campaign.audienceFilter,
      });
    } catch {
      previewTarget = {
        mode: "template-only",
        recipientEmail: null,
        constituentId: null,
      };
    }

    const mergeRecipientEmail = previewTarget.recipientEmail ?? toEmail.trim().toLowerCase();
    const personalizedContent = await personalizeCampaignContent({
      organizationId: campaign.organizationId,
      category: categoryForPurpose(purpose),
      purpose,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject || campaign.name,
        previewText: campaign.previewText,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
      },
      deliveryBodies,
      mergeRecipientEmail,
      deliveryEmail: toEmail.trim().toLowerCase(),
      constituentId: previewTarget.constituentId,
    });

    await sender.send({
      to: toEmail.trim().toLowerCase(),
      subject: `[TEST] ${personalizedContent.subject}`,
      text: personalizedContent.text,
      html: personalizedContent.html,
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

  const parsed = parseCampaignAudienceFilter(campaign.audienceFilter);

  const validation = await validateCampaignSendReadiness({
    campaign: {
      id: campaign.id,
      organizationId: campaign.organizationId,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyToEmail: campaign.replyToEmail,
      bodyHtml: campaign.bodyHtml,
      bodyText: campaign.bodyText,
      templateJson: campaign.templateJson,
      purpose: campaign.purpose,
      audienceFilter: campaign.audienceFilter,
    },
  }).catch((error) => ({
    valid: false,
    checks: [],
    blockers: [error instanceof Error ? error.message : "Campaign failed validation."],
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
  }));

  if (!validation.valid) {
    res.status(400).json({
      error: {
        code: "CAMPAIGN_NOT_READY",
        message: `Campaign failed validation: ${validation.blockers.join(" ")}`,
      },
      validation,
    });
    return;
  }

  const nextWorkflow = withWorkflow({
    ...parsed.workflow,
    needsReview: false,
    queueState: "ACTIVE",
  });

  const updated = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      status: "SCHEDULED",
      scheduledAt: scheduledDate,
      audienceFilter: serializeCampaignAudienceFilter(parsed.filter, parsed.sharing.ownerId ?? userId, parsed.sharing.sharedWithOrganization, nextWorkflow),
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

  res.json(withCampaignWorkspaceFields(updated));
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

  res.json(withCampaignWorkspaceFields(updated));
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
      audienceFilter?: AudienceFilter | { types?: string[] };
      recipientListId?: string;
      recipientListIds?: string[];
      recipientEmails?: string[];
    };

    const sendOptions: CampaignSendOptions = {
      sendMode: body.sendMode,
      audienceFilter: body.audienceFilter,
      recipientListId: typeof body.recipientListId === "string" ? body.recipientListId : undefined,
      recipientListIds: Array.isArray(body.recipientListIds)
        ? body.recipientListIds.map((value) => String(value)).filter(Boolean)
        : undefined,
      recipientEmails: Array.isArray(body.recipientEmails) ? body.recipientEmails : undefined,
    };

    const validation = await validateCampaignSendReadiness({
      campaign: {
        id: campaign.id,
        organizationId: campaign.organizationId,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyToEmail: campaign.replyToEmail,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
        templateJson: campaign.templateJson,
        purpose: campaign.purpose,
        audienceFilter: campaign.audienceFilter,
      },
      sendOptions,
    });

    if (!validation.valid) {
      res.status(400).json({
        error: {
          code: "CAMPAIGN_NOT_READY",
          message: `Campaign failed validation: ${validation.blockers.join(" ")}`,
        },
        validation,
      });
      return;
    }

    const updated = await sendCampaignNow(req.params.id as string, "MANUAL", sendOptions);
    const [eventStatsMap, failedMap] = await Promise.all([
      fetchCampaignEventStatsMap(organizationId, [updated.id]),
      fetchRecentSendFailureMap(organizationId, [updated.id]),
    ]);
    const enriched = withCampaignWorkspaceFields(updated, {
      eventStats: eventStatsMap.get(updated.id) ?? emptyCampaignEventStats(),
      hasRecentSendFailure: failedMap.get(updated.id) ?? false,
    });

    res.json({
      ...enriched,
      sendSummary: {
        trigger: "MANUAL",
        sendMode: sendOptions.sendMode ?? "CAMPAIGN_AUDIENCE",
        status: enriched.workspaceStatus,
        totalRecipients: enriched.totalRecipients,
        delivered: enriched.delivered,
        opened: enriched.opened,
        clicked: enriched.clicked,
        bounced: enriched.bounced,
        sentAt: enriched.sentAt,
      },
    });
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
