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
import { prisma } from "../lib/prisma.js";

const router = Router();
const ORG_ID = "org_demo";

type AudienceFilter = { type?: string } | null;

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

/** GET /api/email-campaigns — List email campaigns with optional status and name search filters. */
router.get("/", async (req, res) => {
  const { status, search, limit = "50" } = req.query as Record<string, string>;

  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      organizationId: ORG_ID,
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
  const [total, sent, scheduled, draft] = await Promise.all([
    prisma.emailCampaign.count({ where: { organizationId: ORG_ID } }),
    prisma.emailCampaign.findMany({
      where: { organizationId: ORG_ID, status: "SENT" },
      select: { totalRecipients: true, opened: true, clicked: true, delivered: true },
    }),
    prisma.emailCampaign.count({ where: { organizationId: ORG_ID, status: "SCHEDULED" } }),
    prisma.emailCampaign.count({ where: { organizationId: ORG_ID, status: "DRAFT" } }),
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

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId: ORG_ID,
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
    where: { organizationId: ORG_ID },
  });
  if (!settings?.smtpHost || !settings.smtpPort || !settings.smtpFromEmail) {
    res.status(400).json({
      error: "SMTP is not configured. Open Settings and save SMTP host/port/from email before sending.",
    });
    return;
  }

  const filter = campaign.audienceFilter ? (JSON.parse(campaign.audienceFilter) as AudienceFilter) : null;
  const recipients = await prisma.constituent.findMany({
    where: {
      organizationId: ORG_ID,
      doNotEmail: false,
      emailOptOut: false,
      email: { not: null },
      ...(audienceWhere(filter) as object),
    },
    select: { email: true, firstName: true, lastName: true },
    take: 1000,
  });
  const to = recipients.map((r) => r.email).filter((email): email is string => Boolean(email));
  const recipientCount = to.length;

  if (recipientCount === 0) {
    res.status(400).json({ error: "No recipients match this audience filter." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPass ?? "" }
      : undefined,
  });

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

  res.json(updated);
});

/** DELETE /api/email-campaigns/:id — Permanently delete an email campaign. */
router.delete("/:id", async (req, res) => {
  await prisma.emailCampaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
