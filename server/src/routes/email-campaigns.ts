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
import { requireRole } from "../middleware/requireRole.js";

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
function getTransport(settings: {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
}) {
  if (!settings.smtpHost || !settings.smtpPort) return null;
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass ?? "" } : undefined,
  });
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

  res.json(campaigns);
});

/** GET /api/email-campaigns/stats — Aggregate email engagement metrics (total, sent, open rate, etc.) across all campaigns. */
router.get("/stats", async (req, res) => {
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

  const [total, sent, scheduled, draft] = await Promise.all([
    prisma.emailCampaign.count({ where: { organizationId } }),
    prisma.emailCampaign.findMany({
      where: { organizationId, status: "SENT" },
      select: { totalRecipients: true, opened: true, clicked: true, delivered: true },
    }),
    prisma.emailCampaign.count({ where: { organizationId, status: "SCHEDULED" } }),
    prisma.emailCampaign.count({ where: { organizationId, status: "DRAFT" } }),
  ]);

  // Compute aggregate open rate from all sent campaigns
  const totalSent = sent.reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalOpened = sent.reduce((sum, c) => sum + c.opened, 0);
  const totalDelivered = sent.reduce((sum, c) => sum + c.delivered, 0);
  const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;

  res.json({
    total,
    sent: sent.length,
    scheduled,
    draft,
    totalRecipientsSent: totalSent,
    avgOpenRate,
  });
});

/** GET /api/email-campaigns/:id — Fetch a single email campaign by ID. */
router.get("/:id", async (req, res) => {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: req.params.id },
  });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(campaign);
});

/**
 * POST /api/email-campaigns — Create a new email campaign.
 * Status is automatically set to "SCHEDULED" if `scheduledAt` is provided, otherwise "DRAFT".
 */
router.post("/", async (req, res) => {
  const {
    name, subject, previewText, fromName, fromEmail, replyToEmail,
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter,
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
      // Serialize audience filter criteria as JSON string for flexible query storage
      audienceFilter: audienceFilter ? JSON.stringify(audienceFilter) : null,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
    },
  });

  res.status(201).json(campaign);
});

/** PUT /api/email-campaigns/:id — Update campaign content, scheduling, or audience filter. */
router.put("/:id", async (req, res) => {
  const {
    name, subject, previewText, fromName, fromEmail, replyToEmail,
    bodyHtml, bodyText, templateJson, scheduledAt, audienceFilter, status,
  } = req.body;

  const campaign = await prisma.emailCampaign.update({
    where: { id: req.params.id },
    data: {
      name, subject, previewText, fromName, fromEmail, replyToEmail,
      bodyHtml, bodyText, templateJson,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      audienceFilter: audienceFilter !== undefined ? JSON.stringify(audienceFilter) : undefined,
      status,
    },
  });

  res.json(campaign);
});

/**
 * POST /api/email-campaigns/:id/preview
 * Description: Returns an HTML/text preview payload for review tooling without sending.
 * Request: {}
 * Response: { id, subject, previewText, fromName, fromEmail, bodyHtml, bodyText }
 */
router.post("/:id/preview", async (req, res) => {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
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
  const { toEmail } = req.body as { toEmail?: string };
  if (!toEmail || !isValidEmail(toEmail)) {
    res.status(400).json({ error: "toEmail is required and must be valid." });
    return;
  }

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: campaign.organizationId } });
  if (!settings?.smtpFromEmail) {
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

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
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
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
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
 * Requires SMTP settings in OrganizationSettings. Recipients are filtered by audienceFilter.
 */
router.post("/:id/send", async (req, res) => {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: req.params.id },
  });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.status === "SENT") {
    res.status(400).json({ error: "Campaign already sent" });
    return;
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: campaign.organizationId },
  });
  if (!settings?.smtpHost || !settings.smtpPort || !settings.smtpFromEmail) {
    res.status(400).json({
      error: "SMTP is not configured. Open Settings and save SMTP host/port/from email before sending.",
    });
    return;
  }

  const filter = campaign.audienceFilter ? (JSON.parse(campaign.audienceFilter) as AudienceFilter) : null;
  const preview = computeAudiencePreview(await getAudienceConstituents(filter, campaign.organizationId));
  const to = preview.recipients;
  const recipientCount = to.length;

  if (recipientCount === 0) {
    res.status(400).json({ error: "No recipients match this audience filter." });
    return;
  }

  const transporter = getTransport(settings);
  if (!transporter) {
    res.status(400).json({ error: "SMTP host/port are required before sending campaigns." });
    return;
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
    where: { id: req.params.id },
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
        totalMatched: preview.totalMatched,
        missingEmail: preview.missingEmail,
        optedOut: preview.optedOut,
        duplicateEmails: preview.duplicateEmails,
        finalSendCount: preview.finalSendCount,
      },
    },
  });

  res.json(updated);
});

/** DELETE /api/email-campaigns/:id — Permanently delete an email campaign. Admin-only. */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id as string;
  await prisma.emailCampaign.delete({ where: { id } });
  res.status(204).send();
});

export default router;
