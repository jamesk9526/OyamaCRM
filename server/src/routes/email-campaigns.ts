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
import nodemailer from "nodemailer";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// All email-campaign routes require authentication.
router.use(requireAuth);

type AudienceFilter = { type?: string } | null;
type AudienceConstituent = {
  id: string;
  email: string | null;
  doNotEmail: boolean;
  emailOptOut: boolean;
};

interface AudiencePreview {
  totalMatched: number;
  validEmail: number;
  missingEmail: number;
  optedOut: number;
  duplicateEmails: number;
  suppressionCount: number;
  finalSendCount: number;
  recipients: string[];
}

interface SmtpSettingsSnapshot {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFromName?: string | null;
  smtpFromEmail?: string | null;
}

interface CampaignSharingSettings {
  ownerId: string | null;
  sharedWithOrganization: boolean;
}

// RFC 5322-inspired practical pattern for application-level email validation.
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Basic email format check for send-test and from/reply fields. */
function isValidEmail(value: string): boolean {
  const email = value.trim();
  return EMAIL_PATTERN.test(email);
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
      emailOptOut: true,
    },
    take: 5000,
  });
  return rows;
}

/**
 * Computes recipient preview counts and de-duplicates valid email recipients.
 * This powers pre-send confirmations and keeps send behavior consistent with preview.
 */
function computeAudiencePreview(rows: AudienceConstituent[]): AudiencePreview {
  const validCandidates: string[] = [];
  const seen = new Set<string>();
  const uniqueRecipients: string[] = [];
  let missingEmail = 0;
  let optedOut = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email) {
      missingEmail += 1;
      continue;
    }
    if (row.doNotEmail || row.emailOptOut) {
      optedOut += 1;
      continue;
    }
    validCandidates.push(email);
    if (!seen.has(email)) {
      seen.add(email);
      uniqueRecipients.push(email);
    }
  }

  const duplicateEmails = validCandidates.length - uniqueRecipients.length;
  const suppressionCount = missingEmail + optedOut + duplicateEmails;

  return {
    totalMatched: rows.length,
    validEmail: validCandidates.length,
    missingEmail,
    optedOut,
    duplicateEmails,
    suppressionCount,
    finalSendCount: uniqueRecipients.length,
    recipients: uniqueRecipients,
  };
}

/** Builds an SMTP transport from organization settings, returning null when SMTP is incomplete. */
function getTransport(settings: SmtpSettingsSnapshot) {
  if (!settings.smtpHost || !settings.smtpPort) return null;
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass ?? "" } : undefined,
  });
}

/** Parses truthy environment values like "1", "true", or "yes". */
function parseEnvBool(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

/** Coerces environment SMTP values into one effective settings snapshot. */
function resolveSmtpSettings(settings: SmtpSettingsSnapshot | null): SmtpSettingsSnapshot {
  const envPortRaw = (process.env.SMTP_PORT ?? "").trim();
  const envPort = envPortRaw ? Number.parseInt(envPortRaw, 10) : NaN;
  const envPortSafe = Number.isFinite(envPort) ? envPort : null;

  return {
    smtpHost: settings?.smtpHost?.trim() || process.env.SMTP_HOST?.trim() || null,
    smtpPort: settings?.smtpPort ?? envPortSafe,
    smtpSecure: settings?.smtpSecure ?? parseEnvBool(process.env.SMTP_SECURE),
    smtpUser: settings?.smtpUser?.trim() || process.env.SMTP_USER?.trim() || null,
    smtpPass: settings?.smtpPass || process.env.SMTP_PASS || null,
    smtpFromName: settings?.smtpFromName?.trim() || process.env.SMTP_FROM_NAME?.trim() || null,
    smtpFromEmail: settings?.smtpFromEmail?.trim() || process.env.SMTP_FROM_EMAIL?.trim() || null,
  };
}

/** Parse audienceFilter JSON into filter + sharing settings with safe defaults. */
function parseCampaignAudienceFilter(raw: string | null): { filter: AudienceFilter; sharing: CampaignSharingSettings } {
  if (!raw) {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sharing = parsed._sharing;
    const sharingObj = sharing && typeof sharing === "object" && !Array.isArray(sharing)
      ? (sharing as Record<string, unknown>)
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
    };
  } catch {
    return {
      filter: null,
      sharing: { ownerId: null, sharedWithOrganization: true },
    };
  }
}

/** Serialize filter payload back into audienceFilter JSON while preserving sharing metadata. */
function serializeCampaignAudienceFilter(filter: AudienceFilter, ownerId: string, sharedWithOrganization: boolean): string {
  const safeFilter = filter && typeof filter === "object" ? { ...filter } : {};
  return JSON.stringify({
    ...safeFilter,
    _sharing: {
      ownerId,
      sharedWithOrganization,
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
export async function sendCampaignNow(campaignId: string, trigger: "MANUAL" | "QUEUE" = "MANUAL") {
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

  const previousStatus = campaign.status;
  const claimed = await prisma.emailCampaign.updateMany({
    where: { id: campaign.id, status: previousStatus },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) {
    throw new CampaignSendError("Campaign is currently being processed.", 409);
  }

  try {
    const settingsRaw = await prisma.organizationSettings.findUnique({
      where: { organizationId: campaign.organizationId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPass: true,
        smtpFromName: true,
        smtpFromEmail: true,
      },
    });
    const settings = resolveSmtpSettings(settingsRaw);
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpFromEmail) {
      throw new CampaignSendError(
        "SMTP is not configured. Open Settings and save SMTP host/port/from email before sending.",
        400
      );
    }

    const filter = parseCampaignAudienceFilter(campaign.audienceFilter).filter;
    const preview = computeAudiencePreview(await getAudienceConstituents(filter, campaign.organizationId));
    const to = preview.recipients;
    const recipientCount = to.length;

    if (recipientCount === 0) {
      throw new CampaignSendError("No recipients match this audience filter.", 400);
    }

    const transporter = getTransport(settings);
    if (!transporter) {
      throw new CampaignSendError("SMTP host/port are required before sending campaigns.", 400);
    }

    await transporter.sendMail({
      from: `"${settings.smtpFromName || campaign.fromName}" <${settings.smtpFromEmail}>`,
      to: settings.smtpFromEmail,
      bcc: to,
      subject: campaign.subject || campaign.name,
      text: campaign.bodyText || "No text content",
      html: campaign.bodyHtml || `<p>${campaign.bodyText || "No content"}</p>`,
    });

    const updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        totalRecipients: recipientCount,
        delivered: recipientCount,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: campaign.organizationId,
        action: "EMAIL_CAMPAIGN_SENT",
        entity: "EmailCampaign",
        entityId: campaign.id,
        metadata: {
          trigger,
          totalMatched: preview.totalMatched,
          missingEmail: preview.missingEmail,
          optedOut: preview.optedOut,
          duplicateEmails: preview.duplicateEmails,
          finalSendCount: preview.finalSendCount,
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
    throw err;
  }
}

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
        finalSendCount: 0,
      },
      recipientsSample: [],
    });
    return;
  }

  const filter = (req.body?.audienceFilter ?? null) as AudienceFilter;
  const rows = await getAudienceConstituents(filter, organizationId);
  const preview = computeAudiencePreview(rows);

  res.json({
    audience: {
      totalMatched: preview.totalMatched,
      validEmail: preview.validEmail,
      missingEmail: preview.missingEmail,
      optedOut: preview.optedOut,
      duplicateEmails: preview.duplicateEmails,
      suppressionCount: preview.suppressionCount,
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
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter, sharedWithOrganization = false,
  } = req.body;
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

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: name ?? "Untitled Campaign",
      subject: subject ?? "",
      previewText, fromName, fromEmail, replyToEmail,
      bodyHtml, bodyText,
      templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      // Serialize audience filter criteria and sharing visibility together.
      audienceFilter: serializeCampaignAudienceFilter(
        (audienceFilter ?? null) as AudienceFilter,
        userId,
        Boolean(sharedWithOrganization),
      ),
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
    },
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
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter, status, sharedWithOrganization,
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
  const nextSharing = typeof sharedWithOrganization === "boolean"
    ? sharedWithOrganization
    : parsedExisting.sharing.sharedWithOrganization;
  const nextFilter = audienceFilter !== undefined
    ? (audienceFilter as AudienceFilter)
    : parsedExisting.filter;

  const campaign = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      name, subject, previewText, fromName, fromEmail, replyToEmail,
      bodyHtml, bodyText, templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      audienceFilter: serializeCampaignAudienceFilter(nextFilter, ownerId, nextSharing),
      status,
    },
  });

  res.json({
    ...campaign,
    ownerId,
    sharedWithOrganization: nextSharing,
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

  const settingsRaw = await prisma.organizationSettings.findUnique({
    where: { organizationId: campaign.organizationId },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPass: true,
      smtpFromName: true,
      smtpFromEmail: true,
    },
  });
  const settings = resolveSmtpSettings(settingsRaw);
  if (!settings.smtpFromEmail) {
    res.status(400).json({
      error: "SMTP from email is not configured. Save SMTP settings before sending test emails.",
    });
    return;
  }
  const transporter = getTransport(settings);
  if (!transporter) {
    res.status(400).json({ error: "SMTP host/port are required before sending test emails." });
    return;
  }

  await transporter.sendMail({
    from: `"${settings.smtpFromName || campaign.fromName}" <${settings.smtpFromEmail}>`,
    to: toEmail.trim().toLowerCase(),
    subject: `[TEST] ${campaign.subject || campaign.name}`,
    text: campaign.bodyText || "No text content",
    html: campaign.bodyHtml || `<p>${campaign.bodyText || "No content"}</p>`,
  });

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

    const updated = await sendCampaignNow(req.params.id as string, "MANUAL");
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
